// A CapWords-style word sticker placed on an object in the photo. Tap to hear the word.
import { Pressable, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, ZoomIn } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '@/lib/theme';
import { speechLocale } from '@/lib/cities';
import type { Sticker } from '@/lib/types';

export function WordSticker({
  sticker, index, lang, boxW, boxH,
}: { sticker: Sticker; index: number; lang?: string; boxW: number; boxH: number }) {
  const scale = useSharedValue(1);
  const tilt = [-4, 3, -2][index % 3];
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt}deg` }, { scale: scale.value }] }));

  // x,y are the object's center (0..1). Keep the sticker inside the photo.
  const left = Math.min(Math.max(sticker.x * boxW - 55, 6), boxW - 130);
  const top = Math.min(Math.max(sticker.y * boxH - 22, 60), boxH - 60);

  return (
    <Animated.View entering={ZoomIn.delay(500 + index * 180).springify()} style={[{ position: 'absolute', left, top }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${sticker.reading}, ${sticker.meaning}. Tap to hear it.`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          scale.value = withSequence(withSpring(1.15), withSpring(1));
          Speech.speak(sticker.word, { language: speechLocale(lang) });
        }}
        style={{
          paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: colors.white,
          backgroundColor: colors.postcard, shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 }, elevation: 4,
        }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{sticker.word}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>
          {sticker.reading} · {sticker.meaning}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
