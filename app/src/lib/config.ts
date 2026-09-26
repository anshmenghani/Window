// true = screens use fake data from mock.ts, false = real backend (real.ts)
export const USE_MOCKS = false;

// Location verification is required to finish onboarding. For the hackathon demo
// (teammates playing locals in other cities) this shows a "Skip for now" option.
export const ALLOW_SKIP_LOCATION_CHECK = true;

// People sign up with a username. Supabase Auth needs an email, so we build a hidden one.
// No email is ever sent to it ("Confirm email" is off in Supabase).
// If Supabase ever rejects this domain as invalid, change it here and nowhere else.
export const USERNAME_EMAIL_DOMAIN = 'users.windowapp.dev';

// When this copy of the app was published (set by the publish command). "dev" when run from a laptop.
export const APP_VERSION = process.env.EXPO_PUBLIC_BUILD_TIME || 'dev';

// Demo accounts: "signing up" again with one of these usernames (and its usual password) signs in
// and replays the whole sign-up flow, keeping their pen pal and letters. Every other username is normal.
export const DEMO_ACCOUNTS = ['sid', 'isha'];

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}

// The cozy, pen-pal details. Each one can be switched off here without touching any screen.
export const COZY = {
  crane: true, // the paper crane on the sill, the globe and the matching screen
  plant: true, // a pot on the sill that grows a leaf for each day you've been pen pals
  wallpaper: true, // soft sprig wallpaper on the wall behind your windowsill
  curtains: true, // gingham curtains on their window that open when their window arrives
  envelope: true, // a new window arrives sealed in an envelope that opens the first time
  shelfTabBar: true, // the bottom bar as a little walnut shelf
};
