// Floating Night Ink tab bar from the design canvas.
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '@/lib/theme';
import { PassportTabIcon, TodayTabIcon, WallTabIcon, YouTabIcon } from './Icons';

const TABS: Record<string, { label: string; Icon: typeof TodayTabIcon }> = {
  today: { label: 'Today', Icon: TodayTabIcon },
  wall: { label: 'Wall', Icon: WallTabIcon },
  passport: { label: 'Passport', Icon: PassportTabIcon },
  you: { label: 'You', Icon: YouTabIcon },
};

export const TAB_BAR_SPACE = 110; // bottom padding screens need so content isn't hidden

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 12) + 4, height: 68, borderRadius: 24,
        backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center',
        shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
      }}
    >
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const color = focused ? colors.light : colors.nightMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) {
                Haptics.selectionAsync();
                navigation.navigate(route.name);
              }
            }}
            style={{ flex: 1, alignItems: 'center', gap: 3 }}
          >
            <tab.Icon color={color} />
            <Text style={{ fontFamily: focused ? fonts.bold : fonts.semibold, fontSize: 11, color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
