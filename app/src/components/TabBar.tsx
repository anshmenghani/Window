// Bottom navigation: a flat ink ledger strip across the bottom, understated.
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

// The footer sits in the layout (not floating), so screens only need a little extra space.
export const TAB_BAR_SPACE = 12;

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row', backgroundColor: colors.ink, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10),
        borderTopWidth: 1, borderTopColor: colors.walnut,
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
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 }}
          >
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: focused ? colors.light : 'transparent', marginBottom: 1 }} />
            <tab.Icon color={color} size={20} />
            <Text style={{ fontFamily: focused ? fonts.bold : fonts.medium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
