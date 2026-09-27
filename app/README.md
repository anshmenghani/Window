# Window app

The phone app for Window, built with Expo and React Native.

## Running it

1. Install the packages: `npm install`
2. Copy `env.example` to `.env` and fill in the Supabase URL, the Supabase anon key, and the AI server URL.
   These are all public values that ship inside the app.
3. Start it: `npx expo start`, then scan the QR code with Expo Go.

Screens can also run on made-up data with no backend at all. Set `USE_MOCKS` to `true` in `src/lib/config.ts`.

## Where things are

- `src/app/` has the screens (Expo Router). Sign-up is in `(auth)`, onboarding in `(onboarding)`, and the four
  main tabs (Today, Wall, Passport, You) in `(tabs)`.
- `src/components/` has the shared pieces: the wooden arch window, the paper crane, the envelope, word labels,
  and so on.
- `src/lib/` has the data layer. `real.ts` talks to Supabase and the AI server, `mock.ts` is the fake-data
  version, and `data.ts` picks between them.
- `src/lib/config.ts` has the switches: fake data, the demo accounts, and the cozy extras (crane, curtains,
  plant, wallpaper, envelope).

## Publishing an update

We share the app through EAS Update, so anyone can open it in Expo Go from a link. Load `.env` into the shell
first (`set -a && . ./.env && set +a`), then publish iOS and Android separately:

```
npx eas-cli update --branch demo --platform ios --environment production --message "what changed"
npx eas-cli update --branch demo --platform android --environment production --message "what changed"
```
