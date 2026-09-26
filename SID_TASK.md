# Sid: Expo setup and mobile integration check

## Goal

Validate the Expo app against the real backend and finish the app-side EAS setup.

## Tasks

1. Initialize EAS for the Expo app and add the generated project ID to `app/app.json`. Do not add credentials or secrets to the repository.
2. With the shared Supabase project ready and email confirmation disabled, test sign-up and sign-in using a username. The app maps usernames to `username@users.windowapp.dev` before calling Supabase Auth. If Supabase rejects that address, report the exact error before changing the domain or auth contract.
3. On an iPhone, grant push permission and verify that `registerPushToken` saves an Expo push token to the signed-in profile.
4. After the app and server environment variables are configured and the API is reachable, set `USE_MOCKS = false` and smoke-test:
   - onboarding and username sign-in;
   - matching across the dream cities, with at most one active or paused pen pal;
   - sending a photo and opening the translated window;
   - knocking while the match is active, and confirming a paused match does not send or deliver knocks.
5. Report which checks passed, which failed, and the exact error messages or steps to reproduce failures.

## Boundaries

- Keep changes to the Expo app and EAS configuration; coordinate before changing shared types or backend contracts.
- Keep this work in a separate commit. Do not include `.env` files, API keys, or other secrets.

## Dependencies

The Supabase project must have `supabase/schema.sql` applied, email confirmation disabled, and the media bucket configured. The server must be deployed and `app/.env` must point at the Supabase project and API before the real-backend flow can be tested. EAS project setup can start before those are ready.
