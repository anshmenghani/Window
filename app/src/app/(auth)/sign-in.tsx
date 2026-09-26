// Email + password sign up / log in (Supabase Auth in the real backend).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { BackButton, Button, ErrorText, Field, T } from '@/components/ui';
import { signIn, signUp } from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'signup' | 'login'>(params.mode === 'login' ? 'login' : 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useSession();
  const isSignup = mode === 'signup';

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isSignup) await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      const p = await refresh();
      router.replace(p?.onboarded ? '/today' : '/about');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll gap={24} style={{ paddingHorizontal: 28 }}>
      <BackButton onPress={() => router.back()} />
      <View style={{ gap: 8 }}>
        <T variant="title">{isSignup ? 'Make your window' : 'Welcome back'}</T>
        <T variant="muted">
          {isSignup ? 'Just an email and a password. Nobody else ever sees them.' : 'Log in to see today\'s windows.'}
        </T>
      </View>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        returnKeyType="next"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      <Spacer />
      <View style={{ gap: 6 }}>
        <Button
          title={isSignup ? 'Create account' : 'Log in'}
          onPress={submit}
          loading={busy}
          disabled={!email || password.length < (isSignup ? 6 : 1)}
        />
        <Pressable onPress={() => setMode(isSignup ? 'login' : 'signup')} style={{ padding: 10, alignItems: 'center' }}>
          <T style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.duskDeep }}>
            {isSignup ? 'I already have an account' : 'New here? Make an account'}
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}
