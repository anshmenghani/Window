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
import { BulbIcon } from '@/components/Icons';
import { BackButton, Button, T } from '@/components/ui';
import { getMatches, getWindow, saveWindow } from '@/lib/data';
import { useSession } from '@/lib/session';
import { openedWindows } from '@/lib/seen';
import { languageName } from '@/lib/cities';
import { timeIn } from '@/lib/time';
import { colors, fonts, radius } from '@/lib/theme';
import type { Match, WindowItem } from '@/lib/types';

export default function OpenedWindow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const { width: screenW } = useWindowDimensions();
  const [w, setW] = useState<WindowItem | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    openedWindows.add(id);
    getWindow(id).then(async (win) => {
      setW(win);
      setSaved(win.saved);
      const ms = await getMatches();
      setMatch(ms.find((m) => m.id === win.match_id) ?? null);
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

  return (
    <Screen scroll gap={14} style={{ paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))} />
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: fonts.bold }}>{sender?.name ?? '…'} · {sender?.home_city ?? ''}</T>
          {sender ? (
            <T variant="small">Sent at {timeIn(sender.tz, new Date(w.created_at))} {sender.home_city} time</T>
          ) : null}
        </View>
      </View>

      <Arch width={archW} height={archH} border={8} bottomRadius={18}>
        <Image source={{ uri: w.photo_url }} style={{ flex: 1 }} contentFit="cover" transition={250} />
        {w.stickers.map((s, i) => (
          <WordSticker key={`${s.word}-${i}`} sticker={s} index={i} lang={w.src_lang} boxW={archW - 16} boxH={archH - 16} />
        ))}
      </Arch>

      {w.status === 'blocked' ? (
        <T style={{ color: colors.danger }}>This window was held back by our safety check.</T>
      ) : null}

      {shownCaption ? (
        <View style={{ gap: 2 }}>
          <T variant="hand" style={{ fontSize: 26, lineHeight: 29 }}>{shownCaption}</T>
          {translated ? (
            <Pressable onPress={() => setShowOriginal((s) => !s)} style={{ paddingVertical: 4, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.duskDeep }}>
                {showOriginal ? `Show in ${myLang}` : `Translated from ${languageName(w.src_lang)} · Show original`}
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
        <Animated.View entering={FadeInDown.delay(300)} style={{ flexDirection: 'row', gap: 12, padding: 14, paddingRight: 16, borderRadius: radius.md, backgroundColor: colors.honey }}>
          <BulbIcon />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="eyebrow" style={{ color: colors.honeyText, letterSpacing: 1 }}>Travel note</T>
            <T style={{ fontSize: 14, lineHeight: 20, color: '#3D2A06' }}>{w.context_note}</T>
          </View>
        </Animated.View>
      ) : null}

      {!fromMe ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <Button
            variant="white"
            title={saved ? 'Saved ✓' : 'Save'}
            style={{ flex: 1 }}
            onPress={() => {
              const next = !saved;
              setSaved(next);
              Haptics.selectionAsync();
              saveWindow(w.id, next).catch(() => setSaved(!next));
            }}
          />
          <Button
            title="Reply with your window"
            style={{ flex: 2.4 }}
            onPress={() => router.push({ pathname: '/capture', params: { match: w.match_id } })}
          />
        </View>
      ) : null}
    </Screen>
  );
}
