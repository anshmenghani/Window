// Listens for live events (a new window arrives, someone knocks) anywhere in the app,
// shows a banner at the top, and tells screens to refresh.
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { getMatches, watchInbox } from './data';
import { useSession } from './session';
import { colors, fonts, shadow } from './theme';
import type { Knock, WindowItem } from './types';
import { KnockIcon } from '@/components/Icons';
import { Brass, PaperGrain } from '@/components/materials';
import { RhythmMarks } from '@/components/KnockPad';

type Banner =
  | { kind: 'knock'; knock: Knock; name: string; city: string }
  | { kind: 'window'; window: WindowItem; name: string; city: string };

type Inbox = {
  /** Goes up by one every time a new window arrives. Screens watch it to refresh. */
  version: number;
  /** Goes up by one every time someone knocks on your window (the sill crane hops). */
  knocks: number;
  /** Plays a knock rhythm as haptic taps. */
  playKnock: (pattern: number[]) => void;
};

const InboxContext = createContext<Inbox>({ version: 0, knocks: 0, playKnock: () => {} });

export function playKnockHaptics(pattern: number[]) {
  const start = pattern[0] ?? 0;
  pattern.slice(0, 10).forEach((ms) => {
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), ms - start);
  });
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const [version, setVersion] = useState(0);
  const [knocks, setKnocks] = useState(0);
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
        setKnocks((n) => n + 1);
        const p = await partnerName(k.from_user);
        show({ kind: 'knock', knock: k, ...p });
      },
    });
    return stop;
  }, [active, show]);

  return (
    <InboxContext.Provider value={{ version, knocks, playKnock: playKnockHaptics }}>
      {children}
      {banner ? (
        <Animated.View
          entering={SlideInUp.duration(420)}
          exiting={SlideOutUp}
          style={{ position: 'absolute', left: 14, right: 14, top: insets.top + 8 }}
        >
          <View
            style={[
              {
                flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4,
                backgroundColor: colors.postcard, borderLeftWidth: 4, borderLeftColor: colors.terracotta, overflow: 'hidden',
              },
              shadow.card,
            ]}
          >
            <PaperGrain />
            <Brass size={38}>
              <KnockIcon color="#5A3E14" size={18} />
            </Brass>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.ink }}>
                {banner.kind === 'knock' ? `${banner.name} knocked` : `${banner.name}'s window arrived`}
              </Text>
              {banner.kind === 'knock' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <RhythmMarks pattern={banner.knock.pattern} color={colors.terracotta} />
                  {/* knocked on the real, physical window (the Raspberry Pi) */}
                  {banner.knock.source === 'window' && banner.city ? (
                    <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>on the window in {banner.city}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>A new window from {banner.city}</Text>
              )}
            </View>
            <Pressable
              onPress={() => {
                // Knocks are only sent from the physical windows, so a knock banner just closes.
                if (banner.kind === 'window') router.push({ pathname: '/window/[id]', params: { id: banner.window.id } });
                setBanner(null);
              }}
              style={({ pressed }) => [
                { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1.5, borderColor: colors.ink },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>
                {banner.kind === 'knock' ? 'OK' : 'Open'}
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
