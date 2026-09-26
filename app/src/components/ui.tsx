// Shared building blocks: type, card-stock buttons, text links, label-tag selections, inputs, ledger headers.
import { ReactNode, useEffect } from 'react';
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, fonts, motion, radius, shadow } from '@/lib/theme';
import { BackIcon, CheckIcon } from './Icons';

// ---------- type ----------
type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label' | 'eyebrow' | 'hand';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[text[variant], style]} />;
}

export const text = StyleSheet.create({
  // display: one editorial line per screen at most (Welcome). title: onboarding questions. heading: names, sections.
  display: { fontFamily: fonts.display, fontSize: 31, lineHeight: 36, letterSpacing: -0.4, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 25, lineHeight: 30, letterSpacing: -0.2, color: colors.ink },
  heading: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.walnut },
  hand: { fontFamily: fonts.hand, fontSize: 25, lineHeight: 28, color: colors.hand },
});

// ---------- buttons ----------
type ButtonProps = {
  title: string;
  onPress?: () => void;
  /**
   * primary = cream card stock with a walnut edge, a hard shallow offset and a postal arrow (one per screen)
   * outline = the same card, flat (a second, equal action like "Pin to wall")
   * ghost = underlined text (Later, Log out, "I already have an account")
   */
  variant?: 'primary' | 'white' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
  /** on a night screen */
  dark?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, icon, dark }: ButtonProps) {
  if (variant === 'ghost') return <TextLink title={title} onPress={onPress} disabled={disabled} dark={dark} style={[{ alignSelf: 'center', paddingVertical: 12 }, style]} />;
  const isPrimary = variant === 'primary';
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      onPress={onPress}
      style={({ pressed }) => [
        btn.base,
        dark && btn.dark,
        isPrimary && !off && !pressed && (dark ? btn.offsetDark : shadow.offset),
        // pressed: the card is pushed down onto its own shadow
        isPrimary && pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] },
        !isPrimary && pressed && { opacity: 0.7 },
        off && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={dark ? colors.nightSoft : colors.walnut} />
      ) : (
        <View style={btn.row}>
          {icon}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[btn.label, dark && { color: colors.postcard }]}>
            {title}
          </Text>
          {isPrimary ? <PostalArrow color={dark ? colors.amber : colors.terracotta} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** The little "par avion" arrow on a primary action: a line and an open head, like a postal direction mark. */
function PostalArrow({ color }: { color: string }) {
  return (
    <Svg width={20} height={10} viewBox="0 0 20 10" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 5h17M13.5 1l4.5 4-4.5 4" />
    </Svg>
  );
}

const btn = StyleSheet.create({
  base: {
    height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
    backgroundColor: colors.postcard, borderWidth: 1, borderColor: colors.walnut,
  },
  dark: { backgroundColor: colors.nightCard, borderColor: colors.nightMuted },
  offsetDark: { shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 0, shadowOffset: { width: 2, height: 2 } },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, maxWidth: '100%' },
  label: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, textAlign: 'center', flexShrink: 1 },
});

/** Plain underlined text for secondary actions. `danger` is terracotta, for destructive ones. */
export function TextLink({
  title, onPress, danger, dark, disabled, style,
}: { title: string; onPress?: () => void; danger?: boolean; dark?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const color = danger ? colors.terracotta : dark ? colors.nightSoft : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [{ alignSelf: 'flex-start', paddingVertical: 4 }, pressed && { opacity: 0.55 }, disabled && { opacity: 0.4 }, style]}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color, textDecorationLine: 'underline', textDecorationColor: danger ? colors.terracotta : dark ? colors.nightMuted : colors.dash }}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Square 44×44 button used for Back / Close / Flip. */
export function IconButton({
  onPress, children, dark, label,
}: { onPress?: () => void; children: ReactNode; dark?: boolean; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
        dark && { backgroundColor: colors.nightCard },
        !dark && { marginLeft: -12 },
        pressed && { opacity: 0.55 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <IconButton onPress={onPress} label="Back">
      <BackIcon />
    </IconButton>
  );
}

// ---------- selections: archival label tags ----------
export function Chip({
  label, selected, onPress, dashed, small,
}: { label: string; selected?: boolean; onPress?: () => void; dashed?: boolean; small?: boolean }) {
  // A selected tag is pressed down a hair and inked; nothing wobbles.
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = withSpring(selected ? -1 : 0, motion.spring);
  }, [selected, lift]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    <Animated.View style={anim}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        onPress={() => {
          Haptics.selectionAsync();
          onPress?.();
        }}
        style={({ pressed }) => [
          chip.base,
          small && { height: 36, paddingHorizontal: 10 },
          selected ? chip.on : dashed ? chip.dashed : chip.off,
          pressed && { opacity: 0.75 },
        ]}
      >
        {/* the punched hole of a luggage label */}
        <View style={[chip.hole, selected && { borderColor: colors.walnut, backgroundColor: colors.mist }]} />
        <Text style={[chip.label, selected && { color: colors.ink, fontFamily: fonts.semibold }, dashed && { color: colors.walnut }, small && { fontSize: 14 }]}>
          {label}
        </Text>
        {selected ? <CheckIcon color={colors.duskDeep} size={12} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const chip = StyleSheet.create({
  base: { height: 40, paddingLeft: 10, paddingRight: 12, borderRadius: radius.tag, flexDirection: 'row', alignItems: 'center', gap: 7 },
  on: { backgroundColor: colors.oldPaper, borderWidth: 1, borderColor: colors.walnut },
  off: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  dashed: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.dash, borderStyle: 'dashed' },
  hole: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: colors.dash },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
});

/** Small read-only travel label, e.g. shared interests on the match postcard. */
export function Tag({ label }: { label: string }) {
  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(110,68,41,0.35)', backgroundColor: colors.oldPaper }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.walnut }}>{label}</Text>
    </View>
  );
}

// ---------- inputs: a line on a passport page ----------
export function Field({
  label, style, inputStyle, left, ...rest
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle>; left?: ReactNode }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <T variant="eyebrow">{label}</T> : null}
      <View>
        <TextInput
          placeholderTextColor={colors.dash}
          {...rest}
          style={[input.base, !!left && { paddingLeft: 44 }, inputStyle]}
        />
        {left ? <View style={input.left} pointerEvents="none">{left}</View> : null}
      </View>
    </View>
  );
}

const input = StyleSheet.create({
  base: {
    height: 50, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.postcard, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 17, color: colors.ink,
  },
  left: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center' },
});

// ---------- onboarding progress: a stitched strip ----------
export function Steps({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < step - 1;
        const current = i === step - 1;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 3 }}>
            {[0, 1, 2].map((k) => (
              <View
                key={k}
                style={{ width: 7, height: 3, borderRadius: 1.5, backgroundColor: done ? colors.dusk : current ? colors.terracotta : colors.dash, opacity: done || current ? 1 : 0.5 }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

/** Back button · stitched progress · spacer, used on onboarding. */
export function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <BackButton onPress={onBack} />
      <Steps step={step} />
      <View style={{ width: 44 }} />
    </View>
  );
}

/** A cream paper card, lifted a couple of px off the desk. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.postcard, borderRadius: radius.sm, padding: 16, borderWidth: 1, borderColor: colors.line }, style]}>
      {children}
    </View>
  );
}

/** A small status mark: an inked check (done) or a pencilled dashed circle (waiting). */
export function Tick({ done, dark }: { done: boolean; dark?: boolean }) {
  const scale = useSharedValue(done ? 1 : 0.6);
  useEffect(() => {
    scale.value = done ? withSpring(1, motion.spring) : withTiming(0.6, { duration: motion.press });
  }, [done, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (done) {
    return (
      <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? colors.amber : colors.okBg }, anim]}>
        <CheckIcon color={dark ? colors.night : colors.ok} size={12} />
      </Animated.View>
    );
  }
  return <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: dark ? colors.nightMuted : colors.dash }} />;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.danger }}>{children}</Text>;
}

/**
 * A ledger line: a small uppercase label, an optional note on the right, and a hairline under both.
 * Used instead of a big page title where the tab bar already says where you are.
 */
export function Ledger({ label, note, style }: { label: string; note?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line }, style]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.ink }}>{label}</Text>
      {note ? <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>{note}</Text> : null}
    </View>
  );
}
