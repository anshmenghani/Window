// Shared building blocks: text styles, buttons, chips, inputs and small helpers.
import { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius } from '@/lib/theme';
import { BackIcon, CheckIcon } from './Icons';

// ---------- text ----------
type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label' | 'eyebrow' | 'hand';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[text[variant], style]} />;
}

export const text = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: -0.7, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 35, letterSpacing: -0.6, color: colors.ink },
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
  hand: { fontFamily: fonts.hand, fontSize: 25, lineHeight: 28, color: colors.hand },
});

// ---------- buttons ----------
type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'white' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
};

/** The Window Light button with its chunky bottom edge. Presses down 2px with a haptic tick. */
export function Button({ title, onPress, variant = 'primary', disabled, loading, style, icon }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      onPress={onPress}
      style={({ pressed }) => [
        btn.base,
        isPrimary && btn.primary,
        variant === 'white' && btn.white,
        variant === 'outline' && btn.outline,
        variant === 'ghost' && btn.ghost,
        isPrimary && !pressed && btn.primaryEdge,
        pressed && { transform: [{ translateY: isPrimary ? 3 : 1 }] },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <View style={btn.row}>
          {icon}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[btn.label, variant === 'ghost' && btn.ghostLabel]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const btn = StyleSheet.create({
  base: { height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primary: { backgroundColor: colors.light },
  primaryEdge: {
    // the solid #C98F22 "ledge" under the button
    shadowColor: colors.lightShadow, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  white: { backgroundColor: colors.white },
  outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.ink },
  ghost: { backgroundColor: 'transparent', height: 44 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  label: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, textAlign: 'center', flexShrink: 1 },
  ghostLabel: { fontFamily: fonts.semibold, fontSize: 15 },
});

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
        { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
        { backgroundColor: dark ? colors.nightCard : colors.white },
        pressed && { opacity: 0.7 },
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

// ---------- chips ----------
export function Chip({
  label, selected, onPress, dashed, small,
}: { label: string; selected?: boolean; onPress?: () => void; dashed?: boolean; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        chip.base,
        small && { height: 38, paddingHorizontal: 14 },
        selected ? chip.on : dashed ? chip.dashed : chip.off,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      {selected && !small ? <CheckIcon /> : null}
      <Text style={[chip.label, selected && { color: colors.white }, dashed && { color: colors.duskDeep }, small && { fontSize: 14 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const chip = StyleSheet.create({
  base: { height: 44, paddingHorizontal: 16, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6 },
  on: { backgroundColor: colors.dusk },
  off: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  dashed: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.dash, borderStyle: 'dashed' },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});

/** Small read-only tag, e.g. shared interests on the match postcard. */
export function Tag({ label }: { label: string }) {
  return (
    <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.chipBg }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.chipText }}>{label}</Text>
    </View>
  );
}

// ---------- inputs ----------
export function Field({
  label, style, inputStyle, left, ...rest
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle>; left?: ReactNode }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? <T variant="label">{label}</T> : null}
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
    height: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white,
    paddingHorizontal: 16, fontFamily: fonts.medium, fontSize: 17, color: colors.ink,
  },
  left: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center' },
});

// ---------- onboarding step bars ----------
export function Steps({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: 28, height: 8, borderRadius: 4, backgroundColor: i < step ? colors.dusk : colors.line }} />
      ))}
    </View>
  );
}

/** Back button · step bars · spacer, used on the onboarding screens. */
export function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <BackButton onPress={onBack} />
      <Steps step={step} />
      <View style={{ width: 44 }} />
    </View>
  );
}

/** White rounded card. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: colors.white, borderRadius: radius.lg, padding: 16 }, style]}>{children}</View>;
}

/** A round check that is either ticked (done) or dashed (waiting). */
export function Tick({ done, dark }: { done: boolean; dark?: boolean }) {
  if (done) {
    return (
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? colors.light : colors.okBg }}>
        <CheckIcon color={dark ? colors.ink : colors.ok} size={13} />
      </View>
    );
  }
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderStyle: 'dashed', borderColor: dark ? '#7B84C4' : colors.dash }} />
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.danger }}>{children}</Text>;
}
