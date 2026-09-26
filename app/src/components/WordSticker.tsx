// A museum-style annotation tag pinned near an object in the photo. Tap to hear the word.
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import Svg, { Line } from 'react-native-svg';
import { colors, fonts, motion } from '@/lib/theme';
import { speechLocale } from '@/lib/cities';
import type { Sticker } from '@/lib/types';
import { clamp, type StickerPlace } from '@/lib/stickerLayout';

export { layoutStickers } from '@/lib/stickerLayout';

export function WordSticker({
  sticker, index, lang, boxW, boxH, place,
}: { sticker: Sticker; index: number; lang?: string; boxW: number; boxH: number; place: StickerPlace }) {
  const scale = useSharedValue(1);
  const tilt = [-2, 1.5, -1][index % 3];
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt}deg` }, { scale: scale.value }] }));
  const { dotX, dotY, left, top, w, h } = place;
  // the thread runs from the object to the nearest edge of its tag
  const endX = clamp(dotX, left + 6, left + w - 6);
  const endY = dotY < top ? top : dotY > top + h ? top + h : top + h / 2;

  return (
    <Animated.View
      entering={FadeIn.delay(600 + index * (motion.stagger * 3)).duration(motion.settle)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, top: 0, width: boxW, height: boxH }}
    >
      {/* thread + pin on the object */}
      <Svg pointerEvents="none" width={boxW} height={boxH} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Line x1={dotX} y1={dotY} x2={endX} y2={endY} stroke="rgba(255,249,237,0.85)" strokeWidth={1} />
      </Svg>
      <View style={{ position: 'absolute', left: dotX - 4, top: dotY - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.terracotta, borderWidth: 1.5, borderColor: colors.postcard }} />
      <Animated.View style={[{ position: 'absolute', left, top, width: w, height: h }, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sticker.reading}, ${sticker.meaning}. Tap to hear it.`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            scale.value = withSequence(withTiming(1.06, { duration: motion.press }), withSpring(1, motion.spring));
            Speech.speak(sticker.word, { language: speechLocale(lang) });
          }}
          style={{
            flex: 1, justifyContent: 'center',
            paddingVertical: 5, paddingHorizontal: 9, borderRadius: 3, backgroundColor: 'rgba(255,249,237,0.94)',
            borderLeftWidth: 3, borderLeftColor: colors.terracotta,
            shadowColor: '#2A1A0E', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
          }}
        >
          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{sticker.word}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.3, color: colors.muted }}>
            {sticker.reading} · {sticker.meaning}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
