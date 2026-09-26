// Bottom navigation: a flat ink ledger strip across the bottom, understated.
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '@/lib/theme';
import { NameTagTabIcon, PassportTabIcon, PushpinTabIcon, TodayTabIcon, WallTabIcon, YouTabIcon } from './Icons';
import { Wood } from './materials';
import { COZY } from '@/lib/config';

const TABS: Record<string, { label: string; Icon: typeof TodayTabIcon }> = {
  today: { label: 'Today', Icon: TodayTabIcon },
  wall: { label: 'Wall', Icon: COZY.shelfTabBar ? PushpinTabIcon : WallTabIcon },
  passport: { label: 'Passport', Icon: PassportTabIcon },
  you: { label: 'You', Icon: COZY.shelfTabBar ? NameTagTabIcon : YouTabIcon },
};

// The footer sits in the layout (not floating), so screens only need a little extra space.
export const TAB_BAR_SPACE = 12;

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const shelf = COZY.shelfTabBar;
  return (
    <View
      style={[
        { flexDirection: 'row', backgroundColor: colors.ink, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 1, borderTopColor: colors.walnut },
        // a walnut shelf: the lighter front lip catches the light, and it throws a soft shadow up the page
        shelf && { backgroundColor: colors.walnutDark, paddingTop: 11, borderTopWidth: 0, shadowColor: '#2A1A0E', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: -3 } },
      ]}
    >
      {shelf ? (
        <>
          <Wood shade={0.25} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: 'rgba(255,226,190,0.22)' }} />
        </>
      ) : null}
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const color = focused ? (shelf ? colors.amber : colors.light) : shelf ? 'rgba(255,249,237,0.72)' : colors.nightMuted;
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
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: focused ? color : 'transparent', marginBottom: 1 }} />
            <tab.Icon color={color} size={20} />
            <Text style={{ fontFamily: focused ? fonts.bold : fonts.medium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
