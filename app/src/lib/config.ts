// true = screens use fake data from mock.ts, false = real backend (real.ts)
export const USE_MOCKS = true;

// Location verification is required to finish onboarding. For the hackathon demo
// (teammates playing locals in other cities) this shows a "Skip for now" option.
export const ALLOW_SKIP_LOCATION_CHECK = true;

// People sign up with a username. Supabase Auth needs an email, so we build a hidden one.
// No email is ever sent to it ("Confirm email" is off in Supabase).
// If Supabase ever rejects this domain as invalid, change it here and nowhere else.
export const USERNAME_EMAIL_DOMAIN = 'users.windowapp.dev';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
