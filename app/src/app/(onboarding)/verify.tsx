// Verify location: a one-time check that you really live in your home city.
// The phone's position goes to the server once; only "verified: yes/no" is ever stored.
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { CheckIcon, LocationIcon } from '@/components/Icons';
import { Button, StepHeader, T } from '@/components/ui';
import { verifyLocation } from '@/lib/data';
import { ALLOW_SKIP_LOCATION_CHECK } from '@/lib/config';
import { useSession } from '@/lib/session';
import { colors, fonts, radius } from '@/lib/theme';

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

  return (
    <Screen scroll gap={24} style={{ paddingHorizontal: 28 }}>
      <StepHeader step={2} onBack={() => router.back()} />
      <View style={{ gap: 8 }}>
        <T variant="title">Do you really live in {city}?</T>
        <T variant="muted">
          Your pen pal trusts that you&apos;re a real local. We check your location once to make sure. Your exact location is never saved or shared.
        </T>
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        {state === 'verified' ? (
          <Animated.View entering={ZoomIn.springify()} style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.okBg, alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon size={52} color={colors.ok} width={2.6} />
          </Animated.View>
        ) : (
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
            {state === 'checking' ? <ActivityIndicator color={colors.dusk} size="large" /> : <LocationIcon size={52} />}
          </View>
        )}
      </View>

      <View style={{ padding: 16, borderRadius: radius.md, backgroundColor: state === 'far' || state === 'denied' || state === 'error' ? '#FBE4E2' : colors.white, gap: 4 }}>
        <T style={{ fontFamily: fonts.semibold, textAlign: 'center' }}>
          {state === 'idle' && `Tap below to confirm you're in ${city}.`}
          {state === 'checking' && 'Checking your location…'}
          {state === 'verified' && `You're a verified local in ${city} ✓`}
          {state === 'far' && `Your phone says you're about ${distance.toLocaleString('en-US')} km from ${city}.`}
          {state === 'denied' && 'Location access is off for Window.'}
          {state === 'error' && error}
        </T>
        {state === 'far' ? <T variant="small" style={{ textAlign: 'center' }}>Go back and pick the city you&apos;re actually in.</T> : null}
        {state === 'denied' ? <T variant="small" style={{ textAlign: 'center' }}>Turn it on in Settings, then try again.</T> : null}
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
