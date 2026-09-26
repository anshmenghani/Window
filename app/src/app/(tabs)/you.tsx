// You & safety: the answer to "is this safe with strangers?" Judges will ask.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { LocationIcon, LockIcon, ShieldIcon } from '@/components/Icons';
import { Button, Chip, Ledger, T, TextLink } from '@/components/ui';
import { getMatches, getPhysicalWindow, myUsername, reportUser, resetDemo, saveProfile, setMatchStatus, signOut, testPhysicalWindow } from '@/lib/data';
import { DEMO_ACCOUNTS } from '@/lib/config';
import { useSession } from '@/lib/session';
import { languageName } from '@/lib/cities';
import { dayNumber, timeAgo } from '@/lib/time';
import { colors, fonts, radius } from '@/lib/theme';
import type { Match, PhysicalWindow } from '@/lib/types';

const REASONS = ['Made me uncomfortable', 'Asked for money or personal info', 'Inappropriate photo or words', 'Spam or fake account'];

export default function You() {
  const { profile, refresh } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [hide, setHide] = useState(profile?.hide_contact ?? true);
  const [reporting, setReporting] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    myUsername().then((name) => setIsDemo(!!name && DEMO_ACCOUNTS.includes(name))).catch(() => {});
  }, []);

  const load = useCallback(() => {
    // One pen pal at a time
    getMatches().then((ms) => setMatches(ms.filter((m) => m.status !== 'ended').slice(0, 1)));
  }, []);
  useFocusEffect(load);

  if (!profile) return null;

  const togglePause = async (m: Match) => {
    const next = m.status === 'paused' ? 'active' : 'paused';
    setMatches((ms) => ms.map((x) => (x.id === m.id ? { ...x, status: next } : x)));
    await setMatchStatus(m.id, next).catch(load);
  };

  const endWindow = (m: Match) => {
    Alert.alert(
      `End your window with ${m.partner.name}?`,
      `You'll stop sending each other windows, and we'll find you a new pen pal.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'End window',
          style: 'destructive',
          onPress: async () => {
            await setMatchStatus(m.id, 'ended').catch(() => {});
            router.replace('/matching');
          },
        },
      ],
    );
  };

  const submitReport = async () => {
    if (!target || !reason) return;
    await reportUser(target, reason);
    setReported(true);
    load();
  };

  const closeReport = () => {
    setReporting(false);
    setTarget(null);
    setReason(null);
    setReported(false);
  };

  return (
    <Screen scroll gap={26} padBottom={TAB_BAR_SPACE} edges={['top']} style={{ paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: colors.walnut, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: 28, color: colors.walnut }}>{profile.name[0] ?? '?'}</Text>
        </View>
        <View>
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>{profile.name}</Text>
          <T variant="small" style={{ fontSize: 14 }}>
            {profile.home_city} · {profile.languages.map(languageName).join(', ')}
          </T>
          {profile.location_verified ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ok, marginTop: 2 }}>✓ Verified local</Text>
          ) : (
            <TextLink title="Verify your city" onPress={() => router.push('/verify')} style={{ paddingVertical: 2 }} />
          )}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Ledger label="Your pen pal" />
        {matches.map((m) => (
          <View key={m.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: fonts.semibold }}>{m.partner.name} · {m.city}</T>
                <T variant="small">Day {dayNumber(m.created_at)} · {m.status === 'paused' ? 'paused' : 'active'}</T>
              </View>
              <Pressable
                onPress={() => togglePause(m)}
                style={({ pressed }) => [{ height: 34, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.walnut, justifyContent: 'center' }, pressed && { opacity: 0.6 }]}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{m.status === 'paused' ? 'Resume' : 'Pause'}</Text>
              </Pressable>
            </View>
            <TextLink danger title="End this window and find someone new" onPress={() => endWindow(m)} />
          </View>
        ))}
        {!matches.length ? (
          <View style={{ gap: 10 }}>
            <T variant="small">No pen pal right now.</T>
            <Button title="Find my window" onPress={() => router.push('/matching')} />
          </View>
        ) : null}
      </View>

      <WindowSection partner={matches[0]} />

      <View>
        <Ledger label="Safety" />
        <SafetyRow icon={<LocationIcon size={18} color={colors.muted} />} title="City-level location only" sub="Your exact location is never shared" right={<AlwaysOn />} />
        <SafetyRow icon={<ShieldIcon size={18} color={colors.muted} />} title="Every window is checked" sub="Photos and words are screened before delivery" right={<AlwaysOn />} />
        <SafetyRow
          icon={<LockIcon size={18} color={colors.muted} />}
          title="Hide contact info for 7 days"
          sub="Phone numbers and handles are removed from captions"
          right={
            <Switch
              value={hide}
              onValueChange={(v) => {
                setHide(v);
                saveProfile({ hide_contact: v }).then(refresh).catch(() => setHide(!v));
              }}
              trackColor={{ true: colors.dusk, false: colors.line }}
              thumbColor={colors.white}
            />
          }
        />
        <TextLink danger title="Report or block someone" onPress={() => setReporting(true)} style={{ marginTop: 14 }} />
      </View>

      {isDemo ? (
        <View style={{ gap: 6 }}>
          <Ledger label="Demo" />
          <T variant="small">Resets sid and isha together: keeps the preloaded letters and removes everything sent after them.</T>
          <TextLink
            danger
            disabled={resetting}
            title={resetting ? 'Resetting…' : 'Reset demo'}
            style={{ marginTop: 4 }}
            onPress={() =>
              Alert.alert('Reset the demo?', 'This resets both sid and isha: live letters, new stamps and knocks are removed. The preloaded history stays.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset both',
                  style: 'destructive',
                  onPress: async () => {
                    setResetting(true);
                    try {
                      await resetDemo();
                      await refresh();
                      router.replace('/today');
                    } catch (e) {
                      Alert.alert('Could not reset', e instanceof Error ? e.message : 'Please try again.');
                    } finally {
                      setResetting(false);
                    }
                  },
                },
              ])
            }
          />
        </View>
      ) : null}

      <TextLink
        title="Log out"
        onPress={async () => {
          await signOut();
          await refresh();
          router.replace('/welcome');
        }}
      />

      <Modal visible={reporting} animationType="slide" transparent onRequestClose={closeReport}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(46,42,38,0.45)' }} onPress={closeReport} />
        <View style={{ padding: 22, paddingBottom: 40, gap: 14, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.mist }}>
          {reported ? (
            <>
              <T variant="heading">Thanks for telling us</T>
              <T variant="muted">They&apos;re blocked and can&apos;t send you windows anymore. Our team will review the report.</T>
              <Button title="Done" onPress={closeReport} />
            </>
          ) : (
            <>
              <T variant="heading">Report or block</T>
              <T variant="label">Who?</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {matches.map((m) => (
                  <Chip key={m.id} small label={m.partner.name} selected={target === m.partner.id} onPress={() => setTarget(m.partner.id)} />
                ))}
              </View>
              <T variant="label">What happened?</T>
              <View style={{ gap: 8, alignItems: 'flex-start' }}>
                {REASONS.map((r) => (
                  <Chip key={r} small label={r} selected={reason === r} onPress={() => setReason(r)} />
                ))}
              </View>
              <Button title="Report and block" onPress={submitReport} disabled={!target || !reason} />
            </>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

function SafetyRow({ icon, title, sub, right }: { icon: React.ReactNode; title: string; sub: string; right: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      {icon}
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: fonts.semibold }}>{title}</T>
        <T variant="small">{sub}</T>
      </View>
      {right}
    </View>
  );
}

function AlwaysOn() {
  return <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>Always on</Text>;
}

/** "Your window": is the physical window on your windowsill connected, and your pen pal's? */
function WindowSection({ partner }: { partner?: Match }) {
  const [status, setStatus] = useState<PhysicalWindow | null>(null);
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);

  const check = useCallback(() => {
    getPhysicalWindow().then(setStatus).catch(() => setStatus({ linked: false }));
  }, []);
  // check now, then every 15 s while this tab is open (the window checks in every 30 s)
  useFocusEffect(
    useCallback(() => {
      check();
      const id = setInterval(check, 15000);
      return () => clearInterval(id);
    }, [check]),
  );

  const test = async () => {
    setTesting(true);
    setNote(null);
    try {
      await testPhysicalWindow();
      setNote({ text: status?.online ? 'Your window should knock three times now.' : 'Sent. It will knock as soon as your window comes back online.' });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'Could not reach your window.', bad: true });
    } finally {
      setTesting(false);
      check();
    }
  };

  const name = partner?.partner.name ?? 'Your pen pal';
  const lightCity = status?.light_timezone && partner && status.light_timezone === partner.partner.tz
    ? partner.partner.home_city
    : status?.light_timezone?.split('/').pop()?.replace(/_/g, ' ');

  return (
    <View style={{ gap: 12 }}>
      <Ledger label="Your window" note={status?.linked && status.side ? `Window ${status.side}` : undefined} />
      {!status ? (
        <T variant="small">Checking…</T>
      ) : !status.linked ? (
        <T variant="small" style={{ fontSize: 14 }}>
          No physical window is linked to your account. If you and your pen pal have Window frames, they're linked to your accounts when they're set up.
        </T>
      ) : (
        <>
          <WindowRow
            title="Your window"
            online={!!status.online}
            detail={status.online
              ? `Online · checked in ${timeAgo(status.last_seen ?? new Date().toISOString())}${lightCity ? ` · light showing ${lightCity} time` : ''}`
              : status.last_seen
                ? `Offline · last heard from ${timeAgo(status.last_seen)}. Check its power and Wi-Fi.`
                : 'Not heard from yet. Turn it on and connect it to Wi-Fi.'}
          />
          <WindowRow
            title={`${name}'s window`}
            online={!!status.partner_online}
            muted={!status.partner_linked}
            detail={!status.partner_linked
              ? 'Not linked yet'
              : status.partner_online
                ? 'Online'
                : status.partner_last_seen ? `Offline · last heard from ${timeAgo(status.partner_last_seen)}` : 'Not heard from yet'}
          />
          {status.partner_linked && status.pen_pals_active === false ? (
            <T variant="small" style={{ color: colors.walnut }}>Knocks between the windows are paused while your pen pal window is paused.</T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
            <TextLink title={testing ? 'Knocking…' : 'Knock on my window'} onPress={test} disabled={testing} />
            <TextLink title="Check again" onPress={check} />
          </View>
          {note ? <T variant="small" style={{ color: note.bad ? colors.terracotta : colors.ok }}>{note.text}</T> : null}
        </>
      )}
    </View>
  );
}

function WindowRow({ title, detail, online, muted }: { title: string; detail: string; online: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {/* a small lamp: lit when the window is online */}
      <View
        style={[
          { width: 12, height: 12, borderRadius: 6 },
          online
            ? { backgroundColor: colors.amber, shadowColor: colors.amber, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }
            : { borderWidth: 1.5, borderColor: muted ? colors.line : colors.dash },
        ]}
      />
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: fonts.semibold, fontSize: 15, color: muted ? colors.muted : colors.ink }}>{title}</T>
        <T variant="small">{detail}</T>
      </View>
    </View>
  );
}
