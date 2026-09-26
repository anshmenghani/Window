// Decides where the app opens: Welcome (logged out), onboarding (not finished), or Today.
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function Index() {
  const { profile, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mist }}>
        <ActivityIndicator color={colors.dusk} />
      </View>
    );
  }
  if (!profile) return <Redirect href="/welcome" />;
  if (!profile.onboarded) return <Redirect href="/about" />;
  return <Redirect href="/today" />;
}
