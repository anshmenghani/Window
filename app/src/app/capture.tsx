// Capture: take (or pick) today's photo, add a handwritten caption and a ≤15 s voice note, send.
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { BARS, Waveform } from '@/components/Waveform';
import { CheckIcon, CloseIcon, FlipIcon, MicIcon, PhotosIcon } from '@/components/Icons';
import { Wood } from '@/components/materials';
import { Button, IconButton, T } from '@/components/ui';
import { getMatches, getTodayPrompt, newWindowId, sendWindow } from '@/lib/data';
import { useSession } from '@/lib/session';
import { reportSendError } from '@/lib/outbox';
import { languageName } from '@/lib/cities';
import { localDate, timeIn } from '@/lib/time';
import { colors, fonts, radius, shadow } from '@/lib/theme';
import type { DailyPrompt, Match } from '@/lib/types';

const MAX_MS = 15000;

export default function Capture() {
  const { match: matchId, prompt: promptParam } = useLocalSearchParams<{ match?: string; prompt?: string }>();
  const { profile } = useSession();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [match, setMatch] = useState<Match | null>(null);

  const cam = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [spot, setSpot] = useState('');
  const [sending, setSending] = useState(false);
  // today's shared prompt: attached when you came from the prompt slip, and you can untick it
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);
  const [forPrompt, setForPrompt] = useState(!!promptParam);

  // voice note
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rec = useAudioRecorderState(recorder, 100);
  const [levels, setLevels] = useState<number[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioMs, setAudioMs] = useState(0);

  useEffect(() => {
    getMatches().then((ms) => {
      const m = ms.find((x) => x.id === matchId) ?? ms[0] ?? null;
      setMatch(m);
      if (m) getTodayPrompt(m.id).then((p) => setPrompt(p && !p.answered_by_me ? p : null)).catch(() => {});
    });
  }, [matchId]);

  useEffect(() => {
    if (rec.isRecording && typeof rec.metering === 'number') {
      // metering is in decibels (about -60 quiet … 0 loud) → 0..1
      const level = Math.min(1, Math.max(0, (rec.metering + 60) / 60));
      setLevels((l) => [...l.slice(-BARS), level]);
    }
    if (rec.isRecording && rec.durationMillis >= MAX_MS) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.metering, rec.durationMillis, rec.isRecording]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/today'));

  const takePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const shot = await cam.current?.takePictureAsync({ quality: 0.9 });
    if (shot?.uri) setPhoto(shot.uri);
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  // true while a finger is held on the record key (it can slide around; only lifting it stops)
  const holding = useRef(false);
  const [held, setHeld] = useState(false);

  const startRecording = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted || !holding.current) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setLevels([]);
    setAudioUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // let go while the recorder was still warming up: stop right away
    if (!holding.current) stopRecording();
  };

  const press = () => {
    holding.current = true;
    setHeld(true);
    startRecording();
  };
  const release = () => {
    holding.current = false;
    setHeld(false);
    stopRecording();
  };

  const stopRecording = async () => {
    if (!recorder.isRecording) return;
    const ms = rec.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (ms < 700) {
      setAudioUri(null); // too short, probably a tap
      return;
    }
    setAudioUri(recorder.uri);
    setAudioMs(ms);
  };

  const send = async () => {
    if (!photo || !match || !profile) return;
    setSending(true);
    try {
      // Resize to 1440 px wide JPEG: faster upload, cheaper AI
      const ctx = ImageManipulator.manipulate(photo).resize({ width: 1440 });
      const img = await ctx.renderAsync();
      const saved = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });

      const id = newWindowId();
      sendWindow({
        id, matchId: match.id, recipientId: match.partner.id,
        photoUri: saved.uri, audioUri: audioUri ?? undefined,
        caption: caption.trim(), spot: spot.trim() || undefined, localDate: localDate(profile.tz),
        promptId: prompt && forPrompt ? prompt.id : undefined,
      }).catch((e) => reportSendError(id, e instanceof Error ? e.message : 'Upload failed.'));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/sending', params: { window: id, match: match.id, caption: caption.trim() } });
    } catch {
      setSending(false);
    }
  };

  const partner = match?.partner;
  const archW = Math.min(316, screenW - 44);
  const archH = Math.min(370, Math.round(screenH * 0.35));
  const recMs = rec.isRecording ? rec.durationMillis : audioMs;
  const mmss = (ms: number) => `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}`;

  return (
    <Screen dark scroll scrollEnabled={!held} gap={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton dark label="Close" onPress={close}>
          <CloseIcon color={colors.postcard} />
        </IconButton>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.postcard }}>To {partner?.name ?? '…'}</Text>
          {partner ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.nightMuted }}>It&apos;s {timeIn(partner.tz)} in {partner.home_city}</Text> : null}
        </View>
        <IconButton dark label="Flip camera" onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
          <FlipIcon />
        </IconButton>
      </View>

      <Pressable onPress={photo ? () => setPhoto(null) : undefined} style={{ alignSelf: 'center' }}>
        {/* a dark walnut arch with a faint amber edge glow, like light from a lamp behind you */}
        <View style={{ shadowColor: colors.amber, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
          <Arch width={archW} height={archH} border={10} bottomRadius={6} lifted={false} dark glass
            // Android's camera ignores rounded clipping, so only there do we paint over the corners.
            // On iPhone the mask would make the lamp glow trace a square instead of the arch.
            maskColor={Platform.OS === 'android' ? colors.night : undefined}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={{ flex: 1 }} contentFit="cover" />
            ) : permission?.granted ? (
              <CameraView ref={cam} style={{ flex: 1 }} facing={facing} />
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.nightCard, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
                <T style={{ color: colors.nightSoft, textAlign: 'center' }}>Window needs your camera to take today&apos;s photo.</T>
                <Button dark title="Allow camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
              </View>
            )}
            {photo ? (
              <View style={{ position: 'absolute', right: 12, bottom: 12, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 4, backgroundColor: 'rgba(30,28,34,0.72)' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.nightSoft }}>tap to retake</Text>
              </View>
            ) : null}
          </Arch>
        </View>
      </Pressable>

      {prompt ? (
        // today's prompt, as a tag you can tick or untick
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: forPrompt }}
          onPress={() => setForPrompt((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: forPrompt ? colors.amber : colors.nightLine }}
        >
          <View style={{ width: 18, height: 18, borderRadius: 3, borderWidth: 1.2, borderColor: forPrompt ? colors.amber : colors.nightMuted, alignItems: 'center', justifyContent: 'center', backgroundColor: forPrompt ? colors.amber : 'transparent' }}>
            {forPrompt ? <CheckIcon size={10} color={colors.night} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, color: colors.nightMuted }}>TODAY&apos;S PROMPT</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.nightSoft }}>{prompt.text}</Text>
          </View>
        </Pressable>
      ) : null}

      {!photo ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22 }}>
          <Pressable
            accessibilityLabel={facing === 'back' ? 'Switch to selfie camera' : 'Switch to back camera'}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4 }}
          >
            <FlipIcon size={18} color={colors.nightMuted} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.nightMuted }}>{facing === 'back' ? 'selfie' : 'back camera'}</Text>
          </Pressable>
          <Pressable onPress={pickPhoto} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4 }}>
            <PhotosIcon size={18} color={colors.nightMuted} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.nightMuted }}>choose from library</Text>
          </Pressable>
        </View>
      ) : null}

      {/* the caption, handwritten on a cream note strip */}
      <View style={[{ borderRadius: 3, backgroundColor: colors.postcard, overflow: 'hidden', transform: [{ rotate: '-0.8deg' }] }, shadow.card]}>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          maxLength={120}
          placeholder="write a little note…"
          placeholderTextColor={colors.dash}
          style={{ height: 50, paddingHorizontal: 14, fontFamily: fonts.handBold, fontSize: 24, color: colors.hand }}
        />
      </View>
      <TextInput
        value={spot}
        onChangeText={setSpot}
        maxLength={60}
        placeholder="where? (optional, like 'Klaus atrium')"
        placeholderTextColor={colors.nightMuted}
        style={{ height: 42, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.nightLine, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 14, color: colors.nightSoft }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.nightCard, borderWidth: 1, borderColor: colors.nightLine }}>
        <RecDot active={rec.isRecording} ready={!!audioUri} />
        <Waveform levels={levels} progress={Math.min(1, recMs / MAX_MS)} />
        <Text style={{ marginLeft: 'auto', fontFamily: fonts.medium, fontSize: 13, color: colors.nightMuted, fontVariant: ['tabular-nums'] }}>
          {mmss(recMs)} / 0:15
        </Text>
        {audioUri && !rec.isRecording ? (
          <Pressable hitSlop={8} accessibilityLabel="Delete voice note" onPress={() => { setAudioUri(null); setLevels([]); setAudioMs(0); }}>
            <CloseIcon size={14} color={colors.nightMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        {/* an old dictaphone key: hold to talk */}
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Hold to record a voice note"
          onStartShouldSetResponder={() => true}
          onResponderGrant={press}
          onResponderRelease={release}
          onResponderTerminationRequest={() => false}
          onResponderTerminate={release}
          hitSlop={12}
          style={{ alignItems: 'center', gap: 4 }}
        >
          <View style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: rec.isRecording ? colors.amber : colors.nightLine }}>
            <LinearGradient colors={rec.isRecording ? ['#5A4632', '#3A2C22'] : ['#3B3740', '#26232B']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <MicIcon color={rec.isRecording ? colors.amber : colors.nightSoft} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, color: colors.nightMuted }}>HOLD</Text>
        </View>
        {!photo ? (
          <Pressable
            accessibilityLabel="Take photo"
            onPress={takePhoto}
            disabled={!permission?.granted}
            style={({ pressed }) => [{ width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: colors.amber, padding: 5 }, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            <View style={{ flex: 1, borderRadius: 40, backgroundColor: colors.postcard }} />
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
        {/* the mail slot: drop the postcard in */}
        <Pressable
          accessibilityLabel="Post your window"
          onPress={send}
          disabled={!photo || sending || !match}
          style={({ pressed }) => [{ alignItems: 'center', gap: 4, opacity: photo ? 1 : 0.35 }, pressed && { transform: [{ translateY: 2 }] }]}
        >
          <View style={[{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, shadow.soft]}>
            <Wood />
            <View style={{ width: 40, height: 7, borderRadius: 2, backgroundColor: '#1A0F08', borderTopWidth: 1, borderTopColor: '#000', borderBottomWidth: 1, borderBottomColor: 'rgba(255,225,190,0.25)' }} />
            <View style={{ position: 'absolute', bottom: 9, width: 18, height: 2, borderRadius: 1, backgroundColor: colors.amber }} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, color: colors.amber }}>POST</Text>
        </Pressable>
      </View>
      <T variant="small" style={{ textAlign: 'center', color: colors.nightMuted }}>
        {rec.isRecording
          ? 'recording… let go to stop'
          : `Hold to talk. ${partner?.name ?? 'They'} will hear it in ${languageName(partner?.languages[0])}.`}
      </T>
    </Screen>
  );
}

function RecDot({ active, ready }: { active: boolean; ready: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = active ? withRepeat(withTiming(0.35, { duration: 700 }), -1, true) : withTiming(1);
  }, [active, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: active ? colors.amber : ready ? colors.dusk : colors.nightLine }, style]} />;
}
