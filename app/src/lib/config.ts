// true = screens use fake data from mock.ts, false = real backend (real.ts)
export const USE_MOCKS = true;

// People sign up with a username. Supabase Auth needs an email, so we build a hidden one.
// No email is ever sent to it ("Confirm email" is off in Supabase).
// If Supabase ever rejects this domain as invalid, change it here and nowhere else.
export const USERNAME_EMAIL_DOMAIN = 'users.windowapp.dev';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
