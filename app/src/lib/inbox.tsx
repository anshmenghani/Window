// Listens for live events (a new window arrives, someone knocks) anywhere in the app,
// shows a banner at the top, and tells screens to refresh.
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { getMatches, sendKnock, watchInbox } from './data';
import { useSession } from './session';
import { colors, fonts, radius, shadow } from './theme';
import type { Knock, WindowItem } from './types';
import { KnockIcon } from '@/components/Icons';

type Banner =
  | { kind: 'knock'; knock: Knock; name: string }
  | { kind: 'window'; window: WindowItem; name: string; city: string };

type Inbox = {
  /** Goes up by one every time a new window arrives. Screens watch it to refresh. */
  version: number;
  /** Plays a knock rhythm as haptic taps. */
  playKnock: (pattern: number[]) => void;
};

const InboxContext = createContext<Inbox>({ version: 0, playKnock: () => {} });

export function playKnockHaptics(pattern: number[]) {
  const start = pattern[0] ?? 0;
  pattern.slice(0, 10).forEach((ms) => {
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), ms - start);
  });
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const [version, setVersion] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((b: Banner) => {
    setBanner(b);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBanner(null), 7000);
  }, []);

  const active = !!profile?.onboarded;
  useEffect(() => {
    if (!active) return;
    const partnerName = async (id: string) => {
      const ms = await getMatches().catch(() => []);
      const m = ms.find((x) => x.partner.id === id);
      return { name: m?.partner.name ?? 'Your friend', city: m?.partner.home_city ?? '' };
    };
    const stop = watchInbox({
      onWindow: async (w) => {
        setVersion((v) => v + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const p = await partnerName(w.sender_id);
        show({ kind: 'window', window: w, ...p });
      },
      onKnock: async (k) => {
        playKnockHaptics(k.pattern);
        const p = await partnerName(k.from_user);
        show({ kind: 'knock', knock: k, name: p.name });
      },
    });
    return stop;
  }, [active, show]);

  return (
    <InboxContext.Provider value={{ version, playKnock: playKnockHaptics }}>
      {children}
      {banner ? (
        <Animated.View
          entering={SlideInUp.springify().damping(16)}
          exiting={SlideOutUp}
          style={{ position: 'absolute', left: 14, right: 14, top: insets.top + 8 }}
        >
          <View
            style={[
              { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.ink },
              shadow.card,
            ]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' }}>
              <KnockIcon color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.postcard }}>
                {banner.kind === 'knock' ? 'Knock knock' : `${banner.name}'s window arrived`}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.nightSoft }}>
                {banner.kind === 'knock' ? `${banner.name} knocked on your window` : `A new window from ${banner.city}`}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (banner.kind === 'knock') {
                  sendKnock(banner.knock.from_user, banner.knock.pattern).catch(() => {});
                  playKnockHaptics(banner.knock.pattern);
                } else {
                  router.push({ pathname: '/window/[id]', params: { id: banner.window.id } });
                }
                setBanner(null);
              }}
              style={({ pressed }) => [
                { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.light },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>
                {banner.kind === 'knock' ? 'Knock back' : 'Open'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  return useContext(InboxContext);
}
