// You & safety: the answer to "is this safe with strangers?" Judges will ask.
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { LocationIcon, LockIcon, ShieldIcon } from '@/components/Icons';
import { Button, Chip, Ledger, T, TextLink } from '@/components/ui';
import { getMatches, reportUser, saveProfile, setMatchStatus, signOut } from '@/lib/data';
import { useSession } from '@/lib/session';
import { languageName } from '@/lib/cities';
import { dayNumber } from '@/lib/time';
import { colors, fonts, radius } from '@/lib/theme';
import type { Match } from '@/lib/types';

const REASONS = ['Made me uncomfortable', 'Asked for money or personal info', 'Inappropriate photo or words', 'Spam or fake account'];

export default function You() {
  const { profile, refresh } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [hide, setHide] = useState(profile?.hide_contact ?? true);
  const [reporting, setReporting] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

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
