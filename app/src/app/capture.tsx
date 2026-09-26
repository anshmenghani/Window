// Capture: take (or pick) today's photo, add a handwritten caption and a ≤15 s voice note, send.
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { BARS, Waveform } from '@/components/Waveform';
import { CloseIcon, FlipIcon, MicIcon, PhotosIcon, SendIcon } from '@/components/Icons';
import { Button, IconButton, T } from '@/components/ui';
import { getMatches, newWindowId, sendWindow } from '@/lib/data';
import { useSession } from '@/lib/session';
import { reportSendError } from '@/lib/outbox';
import { languageName } from '@/lib/cities';
import { localDate, timeIn } from '@/lib/time';
import { colors, fonts, radius } from '@/lib/theme';
import type { Match } from '@/lib/types';

const MAX_MS = 15000;

export default function Capture() {
  const { match: matchId } = useLocalSearchParams<{ match?: string }>();
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

  // voice note
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rec = useAudioRecorderState(recorder, 100);
  const [levels, setLevels] = useState<number[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioMs, setAudioMs] = useState(0);

  useEffect(() => {
    getMatches().then((ms) => setMatch(ms.find((m) => m.id === matchId) ?? ms[0] ?? null));
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

  const startRecording = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setLevels([]);
    setAudioUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      }).catch((e) => reportSendError(id, e instanceof Error ? e.message : 'Upload failed.'));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/sending', params: { window: id, match: match.id, caption: caption.trim() } });
    } catch {
      setSending(false);
    }
  };

  const partner = match?.partner;
  const archW = Math.min(316, screenW - 44);
  const archH = Math.min(380, Math.round(screenH * 0.36));
  const recMs = rec.isRecording ? rec.durationMillis : audioMs;
  const mmss = (ms: number) => `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}`;

  return (
    <Screen dark scroll gap={14}>
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
        <Arch width={archW} height={archH} border={8} bottomRadius={20} lifted={false} maskColor={colors.night}>
          {photo ? (
            <Image source={{ uri: photo }} style={{ flex: 1 }} contentFit="cover" />
          ) : permission?.granted ? (
            <CameraView ref={cam} style={{ flex: 1 }} facing={facing} />
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.nightCard, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
              <T style={{ color: colors.postcard, textAlign: 'center' }}>Window needs your camera to take today&apos;s photo.</T>
              <Button title="Allow camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
            </View>
          )}
          {!photo && permission?.granted ? (
            <>
              <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,253,248,0.35)' }} />
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '46%', height: 1, backgroundColor: 'rgba(255,253,248,0.35)' }} />
            </>
          ) : photo ? (
            <View style={{ position: 'absolute', right: 12, bottom: 12, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(20,24,58,0.7)' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.postcard }}>Tap to retake</Text>
            </View>
          ) : null}
        </Arch>
      </Pressable>

      {!photo ? (
        <Pressable onPress={pickPhoto} style={{ flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8, padding: 6 }}>
          <PhotosIcon size={18} color={colors.nightMuted} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.nightMuted }}>Choose from library</Text>
        </Pressable>
      ) : null}

      <TextInput
        value={caption}
        onChangeText={setCaption}
        maxLength={120}
        placeholder="write a caption…"
        placeholderTextColor={colors.dash}
        style={{ height: 50, borderRadius: radius.md, backgroundColor: colors.postcard, paddingHorizontal: 16, fontFamily: fonts.handBold, fontSize: 23, color: colors.hand }}
      />
      <TextInput
        value={spot}
        onChangeText={setSpot}
        maxLength={60}
        placeholder="Where? (optional, like 'Klaus atrium')"
        placeholderTextColor={colors.nightMuted}
        style={{ height: 44, borderRadius: radius.md, backgroundColor: colors.nightCard, paddingHorizontal: 16, fontFamily: fonts.medium, fontSize: 15, color: colors.postcard }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.nightCard }}>
        <RecDot active={rec.isRecording} ready={!!audioUri} />
        <Waveform levels={levels} progress={Math.min(1, recMs / MAX_MS)} />
        <Text style={{ marginLeft: 'auto', fontFamily: fonts.medium, fontSize: 13, color: colors.nightMuted }}>
          {mmss(recMs)} / 0:15
        </Text>
        {audioUri && !rec.isRecording ? (
          <Pressable hitSlop={8} accessibilityLabel="Delete voice note" onPress={() => { setAudioUri(null); setLevels([]); setAudioMs(0); }}>
            <CloseIcon size={14} color={colors.nightMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <Pressable
          accessibilityLabel="Hold to record a voice note"
          onPressIn={startRecording}
          onPressOut={stopRecording}
          style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: rec.isRecording ? '#F26B55' : colors.nightCard }}
        >
          <MicIcon />
        </Pressable>
        {!photo ? (
          <Pressable
            accessibilityLabel="Take photo"
            onPress={takePhoto}
            disabled={!permission?.granted}
            style={({ pressed }) => [{ width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: colors.light, padding: 5 }, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <View style={{ flex: 1, borderRadius: 40, backgroundColor: colors.postcard }} />
          </Pressable>
        ) : (
          <View style={{ width: 84 }} />
        )}
        <Pressable
          accessibilityLabel="Send window"
          onPress={send}
          disabled={!photo || sending || !match}
          style={({ pressed }) => [
            { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light, opacity: photo ? 1 : 0.35 },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <SendIcon />
        </Pressable>
      </View>
      <T variant="small" style={{ textAlign: 'center', color: colors.nightMuted }}>
        {rec.isRecording
          ? 'Recording… let go to stop'
          : `Hold the mic to talk. ${partner?.name ?? 'They'} will hear it in ${languageName(partner?.languages[0])}.`}
      </T>
    </Screen>
  );
}

function RecDot({ active, ready }: { active: boolean; ready: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = active ? withRepeat(withTiming(0.2, { duration: 500 }), -1, true) : withTiming(1);
  }, [active, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: active ? '#F26B55' : ready ? colors.light : '#4A5290' }, style]} />;
}
