// Verify location: a one-time check that you really live in your home city.
// The phone's position goes to the server once; only "verified: yes/no" is ever stored.
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { CheckIcon, LocationIcon } from '@/components/Icons';
import { Button, StepHeader, T } from '@/components/ui';
import { verifyLocation } from '@/lib/data';
import { ALLOW_SKIP_LOCATION_CHECK } from '@/lib/config';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

type State = 'idle' | 'checking' | 'verified' | 'far' | 'denied' | 'error';

export default function Verify() {
  const { profile, refresh } = useSession();
  const city = profile?.home_city ?? 'your city';
  const [state, setState] = useState<State>(profile?.location_verified ? 'verified' : 'idle');
  const [distance, setDistance] = useState(0);
  const [error, setError] = useState('');

  const check = async () => {
    setState('checking');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setState('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const result = await verifyLocation(pos.coords.latitude, pos.coords.longitude);
      setDistance(result.distance_km);
      if (result.verified) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refresh();
        setState('verified');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setState('far');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check your location.');
      setState('error');
    }
  };

  const next = () => router.push('/interests');
  const problem = state === 'far' || state === 'denied' || state === 'error';

  return (
    <Screen scroll gap={24} style={{ paddingHorizontal: 28 }}>
      <StepHeader step={2} onBack={() => router.back()} />
      <View style={{ gap: 8 }}>
        <T variant="heading">Do you live in {city}?</T>
        <T variant="muted">
          Your pen pal trusts that you&apos;re a real local. We check your location once to make sure. Your exact location is never saved or shared.
        </T>
      </View>

      {/* one quiet status line between two hairlines */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
        <View style={{ width: 22, alignItems: 'center', paddingTop: 1 }}>
          {state === 'checking' ? (
            <ActivityIndicator size="small" color={colors.walnut} />
          ) : state === 'verified' ? (
            <Animated.View entering={FadeIn}>
              <CheckIcon size={18} color={colors.ok} width={2.4} />
            </Animated.View>
          ) : (
            <LocationIcon size={20} color={problem ? colors.terracotta : colors.walnut} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontFamily: fonts.semibold, fontSize: 15, color: problem ? colors.terracotta : colors.ink }}>
            {state === 'idle' && `Not checked yet`}
            {state === 'checking' && 'Checking your location…'}
            {state === 'verified' && `Verified local in ${city}`}
            {state === 'far' && `About ${distance.toLocaleString('en-US')} km from ${city}`}
            {state === 'denied' && 'Location access is off for Window'}
            {state === 'error' && error}
          </T>
          {state === 'idle' ? <T variant="small">Takes a second. We only keep a yes or no.</T> : null}
          {state === 'far' ? <T variant="small">Go back and pick the city you actually live in.</T> : null}
          {state === 'denied' ? <T variant="small">Turn it on in Settings, then try again.</T> : null}
        </View>
      </View>

      <Spacer />
      <View style={{ gap: 6 }}>
        {state === 'verified' ? (
          <Button title="Next" onPress={next} />
        ) : state === 'far' ? (
          <Button title="Change my city" onPress={() => router.back()} />
        ) : (
          <Button title={state === 'idle' || state === 'checking' ? 'Check my location' : 'Try again'} onPress={check} loading={state === 'checking'} />
        )}
        {ALLOW_SKIP_LOCATION_CHECK && state !== 'verified' ? (
          <Button variant="ghost" title="Skip for now (demo)" onPress={next} />
        ) : null}
      </View>
    </Screen>
  );
}
