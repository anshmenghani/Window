// Page wrapper: safe-area padding, background color, optional scrolling and keyboard handling.
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControlProps, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, gutter } from '@/lib/theme';
import { PaperGrain } from './materials';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** turn scrolling off for a moment, e.g. while a finger is held on a record button */
  scrollEnabled?: boolean;
  dark?: boolean;
  bg?: string;
  padBottom?: number; // extra bottom space (e.g. for the floating tab bar)
  gap?: number;
  style?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  edges?: ('top' | 'bottom')[];
  /** a faint paper surface; only for the windowsill and passport, not utility screens */
  textured?: boolean;
};

export function Screen({ children, scroll, scrollEnabled = true, dark, bg, padBottom = 0, gap = 18, style, refreshControl, edges = ['top', 'bottom'], textured }: Props) {
  const background = bg ?? (dark ? colors.night : colors.mist);
  const inner: StyleProp<ViewStyle> = [{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 16 + padBottom, gap }, style];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: background }}>
      {textured && !dark ? <PaperGrain opacity={0.35} /> : null}
      <StatusBar style={dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[{ flexGrow: 1 }, inner]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            scrollEnabled={scrollEnabled}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, inner]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Pushes whatever comes after it to the bottom of the screen. */
export function Spacer() {
  return <View style={{ flex: 1, minHeight: 12 }} />;
}
