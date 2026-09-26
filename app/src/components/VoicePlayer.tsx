// Voice note player: switch between the translated voice and the original recording.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, fonts, radius } from '@/lib/theme';
import { PauseIcon, PlayIcon } from './Icons';

function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function VoicePlayer({
  name, dubUrl, originalUrl, langName,
}: { name: string; dubUrl?: string; originalUrl?: string; langName: string }) {
  const [mode, setMode] = useState<'dub' | 'original'>(dubUrl ? 'dub' : 'original');
  const source = mode === 'dub' ? dubUrl : originalUrl;
  const player = useAudioPlayer(source ? { uri: source } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    // play even when the phone is on silent
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0);
  }, [status.didJustFinish, player]);

  if (!dubUrl && !originalUrl) return null;

  const toggle = () => {
    if (status.playing) player.pause();
    else player.play();
  };
  const progress = status.duration ? status.currentTime / status.duration : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: radius.lg, backgroundColor: colors.white }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        onPress={toggle}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dusk, alignItems: 'center', justifyContent: 'center' }}
      >
        {status.playing ? <PauseIcon /> : <PlayIcon />}
      </Pressable>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {dubUrl ? <ModeChip label={`${name}'s voice, in ${langName}`} on={mode === 'dub'} onPress={() => setMode('dub')} /> : null}
          {originalUrl ? <ModeChip label="Original" on={mode === 'original'} onPress={() => setMode('original')} /> : null}
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.mist, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: colors.dusk }} />
        </View>
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>{mmss(status.duration || 0)}</Text>
    </View>
  );
}

function ModeChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: on ? colors.ink : colors.mist }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: on ? colors.postcard : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
