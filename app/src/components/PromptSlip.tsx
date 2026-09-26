// Today's shared prompt: a slip of paper on the desk with the same idea for both pen pals.
// It shows who has answered, and once you both have, it says a stamp is waiting in the passport.
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fonts, radius, shadow } from '@/lib/theme';
import type { DailyPrompt } from '@/lib/types';
import { CheckIcon } from './Icons';
import { PaperGrain } from './materials';

function Who({ name, done }: { name: string; done: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {done ? (
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.okBg, alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon size={9} color={colors.ok} />
        </View>
      ) : (
        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.2, borderStyle: 'dashed', borderColor: colors.dash }} />
      )}
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: done ? colors.ink : colors.muted }}>{name}</Text>
    </View>
  );
}

export function PromptSlip({ prompt, partnerName, onAnswer }: { prompt: DailyPrompt; partnerName: string; onAnswer: () => void }) {
  const both = prompt.answered_by_me && prompt.answered_by_them;
  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Today's prompt for you and ${partnerName}: ${prompt.text}`}
        disabled={prompt.answered_by_me}
        onPress={onAnswer}
        style={({ pressed }) => [
          { backgroundColor: colors.postcard, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, paddingHorizontal: 14, gap: 6, overflow: 'hidden', transform: [{ rotate: '-0.5deg' }] },
          shadow.soft,
          pressed && { opacity: 0.85 },
        ]}
      >
        <PaperGrain opacity={0.35} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.walnut }}>
            Today&apos;s prompt · for you both
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.displayItalic, fontSize: 19, lineHeight: 24, color: colors.ink }}>{prompt.text}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted }}>{prompt.why}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 }}>
          <Who name="You" done={prompt.answered_by_me} />
          <Who name={partnerName} done={prompt.answered_by_them} />
          <View style={{ flex: 1 }} />
          {both ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ok }}>A new stamp is in your passport</Text>
          ) : !prompt.answered_by_me ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.terracotta }}>Answer it →</Text>
          ) : (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>waiting for {partnerName}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
