// Opened window: the payoff. See their world, understand it, reply.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { WordSticker } from '@/components/WordSticker';
import { VoicePlayer } from '@/components/VoicePlayer';
import { PaperGrain } from '@/components/materials';
import Svg, { Circle, Path } from 'react-native-svg';
import { BackButton, Button, T } from '@/components/ui';
import { getMatches, getWall, getWindow, saveWindow } from '@/lib/data';
import { Envelope, Postmark } from '@/components/Cozy';
import { COZY } from '@/lib/config';
import { useSession } from '@/lib/session';
import { openedWindows, unsealedWindows } from '@/lib/seen';
import { languageName } from '@/lib/cities';
import { timeIn } from '@/lib/time';
import { colors, fonts, motion, shadow } from '@/lib/theme';
import type { Match, WindowItem } from '@/lib/types';

export default function OpenedWindow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const { width: screenW } = useWindowDimensions();
  const [w, setW] = useState<WindowItem | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [letterNo, setLetterNo] = useState<number | null>(null);
  // a new window arrives sealed; the envelope opens once, the first time you look
  const [sealed, setSealed] = useState(() => COZY.envelope && !!id && !unsealedWindows.has(id));

  useEffect(() => {
    if (!id) return;
    openedWindows.add(id);
    getWindow(id).then(async (win) => {
      setW(win);
      setSaved(win.saved);
      const ms = await getMatches();
      setMatch(ms.find((m) => m.id === win.match_id) ?? null);
      // count their letters so far: "Letter No. 4"
      const wall = await getWall(win.match_id).catch(() => []);
      const i = wall.findIndex((x) => x.id === win.id);
      if (i >= 0) setLetterNo(wall.length - i);
    });
  }, [id]);

  if (!w) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.dusk} />
      </Screen>
    );
  }

  const fromMe = w.sender_id === profile?.id;
  const sender = fromMe ? profile : match?.partner;
  const archW = screenW - 40;
  const archH = Math.round(archW * 0.95);
  const translated = !!w.caption_t && w.caption_t !== w.caption;
  const shownCaption = showOriginal || !w.caption_t ? w.caption : w.caption_t;
  const myLang = languageName(profile?.languages[0]);
  const showEnvelope = sealed && !fromMe;
  const postDate = sender ? new Intl.DateTimeFormat('en-US', { timeZone: sender.tz, month: 'short', day: 'numeric' }).format(new Date(w.created_at)) : '';

  return (
    <Screen scroll gap={14} style={{ paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))} />
        <View style={{ flex: 1, gap: 1 }}>
          <T variant="heading" style={{ fontSize: 19, lineHeight: 24 }}>{fromMe ? 'Your window' : `From ${sender?.name ?? '…'}`}</T>
          {sender ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted }}>
              {letterNo && !fromMe ? `Letter No. ${letterNo} · ` : ''}{timeIn(sender.tz, new Date(w.created_at))} in {sender.home_city}
            </Text>
          ) : null}
        </View>
        {sender ? <Postmark city={sender.home_city} date={postDate} size={40} /> : null}
      </View>

      <View>
        <Arch width={archW} height={archH} border={10} bottomRadius={6} glass>
          <Image source={{ uri: w.photo_url }} style={{ flex: 1 }} contentFit="cover" transition={250} />
          {/* the word labels are pinned up once the envelope is open */}
          {!showEnvelope ? w.stickers.map((s, i) => (
            <WordSticker key={`${s.word}-${i}`} sticker={s} index={i} lang={w.src_lang} boxW={archW - 20} boxH={archH - 20} />
          )) : null}
        </Arch>
        {showEnvelope ? (
          <>
            {/* the window waits behind the sealed envelope */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: colors.mist, opacity: 0.55 }} />
            <Envelope
              width={Math.round(archW * 0.84)}
              height={Math.round(archW * 0.56)}
              initial={sender?.name?.[0] ?? '·'}
              onOpened={() => {
                unsealedWindows.add(w.id);
                setSealed(false);
              }}
            />
          </>
        ) : null}
      </View>

      {w.status === 'blocked' ? (
        <T style={{ color: colors.danger }}>This window was held back by our safety check.</T>
      ) : null}

      {shownCaption ? (
        // handwritten in the margin of a sheet of writing paper
        <View style={[{ backgroundColor: colors.postcard, borderRadius: 3, paddingVertical: 12, paddingLeft: 26, paddingRight: 14, overflow: 'hidden' }, shadow.soft]}>
          <PaperGrain />
          <View style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(185,88,61,0.45)' }} />
          <T variant="hand" style={{ fontSize: 26, lineHeight: 30 }}>{shownCaption}</T>
          {translated ? (
            <Pressable onPress={() => setShowOriginal((s) => !s)} style={{ paddingTop: 6, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textDecorationLine: 'underline', textDecorationColor: colors.dash }}>
                {showOriginal ? `Show in ${myLang}` : `translated from ${languageName(w.src_lang)} · show original`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {w.transcript_t || w.transcript ? (
        <T style={{ fontSize: 15, color: colors.muted }}>
          “{showOriginal ? w.transcript : w.transcript_t ?? w.transcript}”
        </T>
      ) : null}

      <VoicePlayer name={sender?.name ?? 'Their'} dubUrl={w.dub_url} originalUrl={w.audio_url} langName={myLang} />

      {w.context_note ? (
        <Animated.View
          entering={FadeInDown.delay(350).duration(motion.arrive)}
          style={[{ backgroundColor: colors.oldPaper, borderRadius: 2, padding: 14, paddingTop: 12, gap: 6, overflow: 'hidden', transform: [{ rotate: '0.6deg' }] }, shadow.card]}
        >
          <PaperGrain />
          {/* the fold crease */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: 'rgba(110,68,41,0.12)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CompassStar />
            <T variant="eyebrow">Travel note</T>
          </View>
          <T style={{ fontSize: 15, lineHeight: 22, color: colors.ink }}>{w.context_note}</T>
        </Animated.View>
      ) : null}

      {/* the AI's suggestion for how to answer with your own world */}
      {!fromMe && w.reply_prompt ? (
        <Animated.View entering={FadeInDown.delay(550).duration(motion.arrive)} style={{ gap: 4, paddingTop: 6, paddingHorizontal: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.walnut }}>Write back</Text>
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, lineHeight: 24, color: colors.ink }}>{w.reply_prompt}</Text>
        </Animated.View>
      ) : null}

      {!fromMe ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <Button
            variant="outline"
            title={saved ? 'Pinned ✓' : 'Pin to wall'}
            style={{ flex: 1.2 }}
            onPress={() => {
              const next = !saved;
              setSaved(next);
              Haptics.selectionAsync();
              saveWindow(w.id, next).catch(() => setSaved(!next));
            }}
          />
          <Button
            title="Reply with your window"
            style={{ flex: 2 }}
            onPress={() => router.push({ pathname: '/capture', params: { match: w.match_id } })}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/** A small hand-inked compass star for the travel note. */
function CompassStar() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Circle cx={9} cy={9} r={8} fill="none" stroke={colors.walnut} strokeWidth={1} opacity={0.6} />
      <Path d="M9 1.5 L10.3 7.7 L16.5 9 L10.3 10.3 L9 16.5 L7.7 10.3 L1.5 9 L7.7 7.7 Z" fill={colors.terracotta} opacity={0.85} />
    </Svg>
  );
}
