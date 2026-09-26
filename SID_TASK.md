# Sid: Expo setup and mobile integration check

## Goal

Validate the Expo app against the real backend and finish the app-side EAS setup.

## Tasks

1. **Own the backend service setup:** create or select the Supabase project and deploy the FastAPI service from `server/` to Render. Apply `supabase/schema.sql`, disable Supabase email confirmation, configure the server-only values from `server/env.example` in Render, and set up the two database webhooks described in `server/README.md`. Keep OpenAI, service-role, and webhook secrets in Render's secret environment settings; never commit them.
2. Create `app/.env` locally from `app/env.example` with the Supabase project URL, anon key, and deployed Render API URL. `.env` files are ignored by Git; do not commit or share the anon key in chat. Tell Isha when the project and service are ready so she can use the app against them.
3. Initialize EAS for the Expo app and add the generated project ID to `app/app.json`. Do not add credentials or secrets to the repository.
4. With the Supabase project ready and email confirmation disabled, test sign-up and sign-in using a username. The app maps usernames to `username@users.windowapp.dev` before calling Supabase Auth. If Supabase rejects that address, report the exact error before changing the domain or auth contract.
5. On an iPhone, grant push permission and verify that `registerPushToken` saves an Expo push token to the signed-in profile.
6. After the app and server environment variables are configured and the API is reachable, set `USE_MOCKS = false` and smoke-test:
   - onboarding and username sign-in;
   - matching across the dream cities, with at most one active or paused pen pal;
   - sending a photo and opening the translated window;
   - knocking while the match is active, and confirming a paused match does not send or deliver knocks.
7. Report which checks passed, which failed, and the exact error messages or steps to reproduce failures.

## Ownership and boundaries

Sid owns creating/configuring the Supabase project, deploying the API, and filling his local `app/.env` so Isha does not need to provision these services. If an account permission or paid credential is needed, ask Isha for access or the required secret; do not substitute a fake value. Keep changes to the Expo app and EAS configuration; coordinate before changing shared types or backend contracts. Keep this work in a separate commit. Do not include `.env` files, API keys, or other secrets.
