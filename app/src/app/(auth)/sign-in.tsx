// Username + password sign up / log in.
// Supabase Auth needs an email, so the username is turned into a hidden one
// (see usernameToEmail in lib/config.ts). Nobody ever sees or receives it.
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { BackButton, Button, ErrorText, Field, T, TextLink } from '@/components/ui';
import { saveProfile, signIn, signUp } from '@/lib/data';
import { DEMO_ACCOUNTS, usernameToEmail } from '@/lib/config';
import { useSession } from '@/lib/session';

const USERNAME = /^[a-z0-9_.]{3,20}$/;

// Backend errors talk about emails; people here only know their username.
function friendly(message: string) {
  if (/already registered|already exists/i.test(message)) return 'That username is taken. Try another one.';
  if (/do not match|invalid login|invalid credentials/i.test(message)) return 'That username and password don\'t match.';
  return message.replace(/email/gi, 'username');
}

// A demo account that already exists: sign in and start sign-up over (its match and letters stay).
async function demoSignUp(name: string, password: string) {
  try {
    await signUp(usernameToEmail(name), password);
  } catch (e) {
    if (!/already/i.test(e instanceof Error ? e.message : '')) throw e;
    try {
      await signIn(usernameToEmail(name), password);
    } catch {
      throw new Error(`"${name}" is a demo account. Use its usual password to go through sign-up again.`);
    }
    // replay: the matching screen reveals your existing pen pal live again (letters are kept)
    await saveProfile({ onboarded: false, replay: true, looking_at: null });
  }
}

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'signup' | 'login'>(params.mode === 'login' ? 'login' : 'signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useSession();
  const isSignup = mode === 'signup';
  const name = username.trim().toLowerCase();

  const submit = async () => {
    setError(null);
    if (!USERNAME.test(name)) {
      setError('Usernames are 3–20 characters: letters, numbers, _ or .');
      return;
    }
    setBusy(true);
    try {
      if (isSignup && DEMO_ACCOUNTS.includes(name)) {
        await demoSignUp(name, password);
        await refresh();
        router.replace('/about');
        return;
      }
      if (isSignup) await signUp(usernameToEmail(name), password);
      else await signIn(usernameToEmail(name), password);
      const p = await refresh();
      router.replace(p?.onboarded ? '/today' : '/about');
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : 'Something went wrong. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll gap={22} style={{ paddingHorizontal: 28 }}>
      <BackButton onPress={() => router.back()} />
      <View style={{ gap: 6 }}>
        <T variant="heading">{isSignup ? 'Make your window' : 'Welcome back'}</T>
        <T variant="muted">
          {isSignup ? 'Pick a username and a password. Your partner only ever sees your first name.' : 'Log in to see today\'s windows.'}
        </T>
      </View>
      <Field
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        placeholder="like sid_dutta"
        returnKeyType="next"
        maxLength={20}
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
      <View style={{ gap: 4 }}>
        <Button
          title={isSignup ? 'Create account' : 'Log in'}
          onPress={submit}
          loading={busy}
          disabled={name.length < 3 || password.length < (isSignup ? 6 : 1)}
        />
        <TextLink
          title={isSignup ? 'I already have an account' : 'New here? Make an account'}
          onPress={() => setMode(isSignup ? 'login' : 'signup')}
          style={{ alignSelf: 'center', paddingVertical: 12 }}
        />
      </View>
    </Screen>
  );
}
