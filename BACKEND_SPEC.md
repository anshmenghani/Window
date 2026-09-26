# Window: Backend Spec

HackGT 13 · hacking ends **Sun Sep 27, 8:00 AM** · 4-person team

> **For the coding agent reading this:** you are building the **backend** for Window: the Supabase database, the FastAPI AI server, and the app's data layer (`app/src/lib/real.ts` and helpers). Another teammate (Sid) is building every app screen **against the exact contract in section 7**. The hardware pair is building two Raspberry Pi windows **against section 10**. Match those contracts exactly. If you think a contract needs to change, stop and tell your human first. Sid's screens and the Pis depend on it.
>
> **Files you own:** `server/**`, `supabase/**`, `app/src/lib/real.ts`, `app/src/lib/supabase.ts`, `app/src/lib/api.ts`, `app/src/lib/notifications.ts`
> **Do not edit:** `app/src/app/**` (screens), `app/src/components/**`, `app/src/lib/mock.ts`, `app/src/lib/theme.ts`, `hardware/**`, `app/package.json` (all libraries are already installed; ask before adding one)
> **Shared, change only after agreeing:** `app/src/lib/types.ts`, `app/src/lib/data.ts`
> **Never commit keys.** `.env` files are gitignored. Commit messages are plain descriptions, with no AI co-author trailers.

## Changelog (newest first)
- **Sat 7:45 AM · Sid: AI THAT GROWS WITH THE FRIENDSHIP.** Four features that make the AI about the relationship, not just single windows. **Re-run `schema.sql`** (safe) and redeploy the server (Render does it on push).
  - **Write-back prompts:** the translation call now also returns `reply_prompt` (one line in the reader's language suggesting how to answer with your own world). Stored on `window_translations.reply_prompt`; `WindowItem.reply_prompt`. No extra AI call.
  - **Daily shared prompt:** `POST /prompt {match_id}` → `DailyPrompt {id, match_id, prompt_date, text, why, level, answered_by_me, answered_by_them}` in the caller's language. Written once per pair per UTC day (gpt-4o-mini) from shared interests, recent letters and the bond level; never repeats a recent theme; never asks for faces/home/school/identifying things. New table `daily_prompts` (text/why/stamp in both people's languages, `_a`/`_b` = `matches.user_a`/`user_b`). A window can answer it: `windows.prompt_id` (set on insert via `SendWindowInput.promptId`; a trigger drops ids from another match; clients can't change it later).
  - **Bond level:** worked out from real activity only: letters exchanged, prompts both answered, voice notes, days. Levels 1–4 (New pen pals → Regular correspondents → Close pen pals → Old friends); thresholds live in `app/src/lib/bond.ts` and `server/ai.py BOND_LEVELS` (keep them equal). Prompts get more personal as the level rises. `getBond(matchId)` computes it client-side from `windows`.
  - **Memory stamps + city portrait:** after each window is ready, `remember_letter` (one gpt-4o-mini call, never blocks delivery) rewrites the reader's portrait of the sender's city (`portraits`, one row per reader, only facts from the letters) and may name a place/moment stamp. Deterministic stamps too: first letter, first voice note, both answered a prompt ("Two cups of coffee · 11,000 km apart"). New table `stamps` (one copy per person in their language, `dedupe` key). `getStamps(matchId)`, `getPortrait(matchId)`.
  - **Contract:** new types `DailyPrompt`, `Bond`, `BondLevel`, `MemoryStamp`, `Portrait`; new `data.ts` functions `getTodayPrompt`, `getBond`, `getStamps`, `getPortrait` (mock + real).
- **Sat 5:15 AM · Sid: LOCATION VERIFICATION.** New onboarding step 2 of 4 (`/verify`, after About you): the phone sends its position **once** to the server, which checks it's within **80 km** of the chosen home city.
  - **Schema (re-run `schema.sql`):** `profiles.location_verified boolean default false`, `profiles.location_verified_at timestamptz`. A trigger lets **only the service role** set these; any client update keeps the old values, and **changing `home_city` resets them**.
  - **Server:** `POST /verify-location {lat, lng}` → `{verified, distance_km}`. Coordinates are never stored or logged; only the flag is saved. `ai.distance_km` is the haversine helper.
  - **Contract:** `Profile.location_verified?: boolean`, new `LocationCheck = {verified, distance_km}`, and `verifyLocation(lat, lng)` in `data.ts` / `real.ts` / `mock.ts`.
  - **Demo:** `ALLOW_SKIP_LOCATION_CHECK = true` in `app/src/lib/config.ts` shows "Skip for now (demo)". `seed.py` marks personas `location_verified: true` (they're played by teammates in Atlanta).
  - **UI:** "✓ Verified local" on the match postcard and on the You tab (unverified users get a "Verify now" link).
- **Sat 4:40 AM · Sid (fixes from reviewing Isha's backend):**
  - **Re-run `supabase/schema.sql`** in the SQL editor (it's safe to re-run). It adds a **`push_tokens`** table (`user_id` pk, `token`, `updated_at`; only you can read or write your own row), moves any existing `profiles.expo_push_token` values into it, and **tightens `profiles` reads to yourself + people you're matched with.** Matching runs on the server with the service-role key, so the app never lists strangers. The Pi still reads its partner's profile (they're matched).
  - `registerPushToken` (real.ts) now upserts into `push_tokens`. `/hooks/push` reads the token from `push_tokens` (falls back to the old profile column).
  - `watchInbox` announces each ready window **once** (Realtime can't send the old `status` on RLS tables, so it was re-firing).
  - The knock button shows the backend's error (e.g. "Knocks are available when your pen pal window is active.") instead of silently resetting. The mock follows the same paused rule.
- **Sat 4:05 AM · Sid: ONE PEN PAL AT A TIME.** People still pick up to 3 dream cities, but each person has **at most one** match that isn't `ended`, on both sides.
  - **`POST /match` (section 8):** if the caller already has an `active`/`paused` match, return just that one as `[{city, status:'matched', match}]`. Otherwise pool candidates from **all** dream cities, **exclude any candidate who already has an `active`/`paused` match**, score them the same way, and create **one** match with the best candidate. If there's nobody free, return `[{city, status:'waiting'}, …]` for each dream city.
  - **`getMatches()` (section 7):** returns at most one match (the newest non-ended one). Screens use `matches[0]`.
  - **Ending:** the You tab has "End this window and find someone new", which calls `setMatchStatus(id, 'ended')` and then opens Matching (`findMatches()`). Report/block already ends the match.
  - **Optional DB safety net:** a trigger rejecting a new `active` match if either user already has an `active`/`paused` one. Server-side checking is enough for the hackathon.
  - **Hardware (section 10):** don't hardcode `PARTNER_ID` anymore. Every ~30 s, find the single match where `status in ('active','paused')` and `me in (user_a, user_b)`; the partner is the other user. If there's none, the window idles (soft glow, knocks disabled). A **paused** match should not send or play knocks.
- **Sat 3:40 AM · Sid:** Sign-up/login now uses a **username** instead of an email. The app turns it into a hidden email `username@users.windowapp.dev` (see `usernameToEmail` in `app/src/lib/config.ts`) before calling `signUp`/`signIn`, so the contract and `real.ts` are unchanged. Affects: section 10 (Pi `WINDOW_EMAIL` = `<username>@users.windowapp.dev`) and section 11 (create personas as `aiko@users.windowapp.dev` etc.). Keep "Confirm email" OFF. **Please test one real sign-up**: if Supabase rejects the domain as invalid, tell Sid and we change that one constant.
- **Sat 2:45 AM · Sid:** Expo SDK 57's template puts code in `app/src/`. Screens live in `app/src/app/`, components in `app/src/components/`, and shared code in **`app/src/lib/`** (so `types.ts`, `data.ts`, `real.ts`, `supabase.ts`, `api.ts` and `notifications.ts` are all in `app/src/lib/`). Every path in this spec now uses these.

---

## 1. What Window is

You pick up to 3 cities you dream of visiting. AI matches you with a local there who shares your interests, preferring *mutual dreams* (they dream of visiting your city). Each day, both people send **one photo, a caption, and a voice note of up to 15 seconds**. The AI:
- screens the window for safety
- transcribes the voice note
- translates the caption and transcript into the partner's language
- writes a short cultural **travel note**
- adds **word stickers** (a local word on an object in the photo)
- (stretch) re-voices the translation with ElevenLabs

Other features:
- Partners can **knock**. A knock on a physical Raspberry Pi window (or the app's Knock button) plays the same knock rhythm on the partner's window and sends a push notification to the partner's phone.
- Each Pi window glows with the partner's **current sky color** (daylight at their location).

Screens (built by Sid): Welcome, Sign in, About you, Interests, Dreams, Matching, Match reveal, Today, Capture, Sending, Opened window, Wall (map), Passport (stamps and itinerary), You (safety).

---

## 2. Architecture

```
 Expo app (Expo Go, TypeScript)          Raspberry Pi window ×2 (Python)
   screens → lib/data.ts                   knock sensor, LEDs, speaker
            → lib/real.ts ─────┐                 │
                               ▼                 ▼
                    Supabase (Auth · Postgres · Storage · Realtime)
                               ▲         │ Database Webhooks
                               │         ▼
                    FastAPI AI server (Render)  ──► OpenAI (Whisper, GPT-4o,
                    /match /process-window            embeddings, moderation)
                    /itinerary /hooks/push      ──► ElevenLabs (stretch)
                                                ──► Expo Push API
```

- The **app talks to Supabase directly** for reads and writes, protected by row-level security (RLS). It calls the **FastAPI server** only for AI work (`/match`, `/process-window`, `/itinerary`).
- **API keys** (OpenAI, ElevenLabs, Supabase service_role) exist **only on the server**. The app has only the Supabase URL and anon key.
- **The Pis talk to Supabase directly**, logged in as a normal user (email and password), polling the database.

---

## 3. Decisions (already made, don't change)

| Topic | Decision | Why |
|---|---|---|
| Auth | **Supabase Auth, email + password.** In the dashboard, turn "Confirm email" **OFF**. | Works in Expo Go with no deep links. The Pis can log in with email and password. Demo personas are easy to create. Supabase stores the hashed passwords, never us. Google sign-in needs a custom dev build or OAuth redirect setup, the Pis can't use it, and every persona would need a real Google account. |
| App runtime | **Expo Go** (no dev build) | Only Expo Go-compatible libraries |
| Push | Expo Push API. **Works in Expo Go on iOS; not on Android.** Android users only get in-app Realtime updates. | Expo Go limitation |
| Storage | One **public** bucket `media` with random-ID paths | Hackathon simplicity. Private files are future work. |
| Languages | ISO 639-1 codes (`en`, `ja`, `pt`, `ko`, `fr`, `es`, `hi`, `zh`). A person's **first** language in `languages[]` is their main one. | |
| Server | Python 3.11+, FastAPI, deployed on **Render** | |
| Models | `whisper-1`, `gpt-4o` (vision), `gpt-4o-mini` (text), `text-embedding-3-small`, `omni-moderation-latest` | ~$0.02 per window; budget is $10 |

---

## 4. Repo layout

```
/app                  Expo app (Sid: screens; you: lib/real.ts etc.)
  src/app/            screens (Expo Router). DON'T EDIT
  src/components/     DON'T EDIT
  src/lib/
    types.ts          SHARED contract (section 7)
    data.ts           SHARED contract (section 7), switches mock ↔ real
    config.ts         export const USE_MOCKS = true | false
    mock.ts           Sid's fake data
    real.ts           YOU: real implementations
    supabase.ts       YOU: Supabase client
    api.ts            YOU: fetch wrapper for the FastAPI server
    notifications.ts  YOU: push permission + token
/server               YOU: FastAPI
/supabase             YOU: schema.sql, seed notes
/hardware             Pi code (hardware pair)
```

---

## 5. Environment variables

`app/.env` (public-safe; Expo exposes `EXPO_PUBLIC_*` to the app):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=https://<render-service>.onrender.com
```

`server/.env` (secret):
```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ELEVENLABS_API_KEY=          # stretch
ELEVENLABS_VOICE_ID=         # stretch; one warm multilingual stock voice
HOOK_SECRET=                 # random string; Supabase webhooks send it in x-hook-secret
```

`hardware/.env` (per Pi): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WINDOW_EMAIL`, `WINDOW_PASSWORD` (partner comes from the one active match, see changelog)

---

## 6. Database (`supabase/schema.sql`, run in the Supabase SQL editor)

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  languages text[] default '{}',
  home_city text, country text, tz text,          -- tz = IANA, e.g. 'Asia/Tokyo'
  lat double precision, lng double precision,     -- CITY-LEVEL only
  interests text[] default '{}',
  interest_vec double precision[],                -- written by server
  dream_places text[] default '{}',               -- city names, max 3
  mutual_dreams boolean default true,
  hide_contact boolean default true,
  onboarded boolean default false,
  expo_push_token text,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references profiles,                -- the dreamer
  user_b uuid references profiles,                -- the local in `city`
  city text not null,
  reason text,                                    -- AI "why you fit"
  status text default 'active',                   -- active | paused | ended
  itinerary jsonb,
  created_at timestamptz default now()
);

create table windows (
  id uuid primary key,                            -- generated by the APP (uuid v4)
  match_id uuid references matches on delete cascade,
  sender_id uuid references profiles,
  recipient_id uuid references profiles,
  photo_path text not null,                       -- '{sender_id}/{id}.jpg'
  audio_path text,                                -- '{sender_id}/{id}.m4a'
  caption text,
  spot text, spot_lat double precision, spot_lng double precision,
  local_date date not null,                       -- sender's local date
  saved boolean default false,                    -- recipient saved it (Passport)
  created_at timestamptz default now(),
  unique (match_id, sender_id, local_date)        -- one window per person per day
);

create table window_translations (
  window_id uuid primary key references windows on delete cascade,
  match_id uuid, recipient_id uuid,
  src_lang text, lang text,
  caption_t text, transcript text, transcript_t text,
  context_note text,
  stickers jsonb default '[]',
  dub_path text,                                  -- 'dubs/{window_id}.mp3'
  steps jsonb default '{}',                       -- {"safety":true,"transcribed":true,"translated":true,"voiced":true}
  status text default 'processing',               -- processing | ready | blocked | failed
  error text,
  created_at timestamptz default now()
);

create table knocks (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references profiles,
  to_user uuid references profiles,
  source text not null,                           -- 'window' | 'app'
  pattern jsonb not null default '[0]',           -- ms offsets from first knock, e.g. [0,180,360,900,1100]
  created_at timestamptz default now()
);

create table reports (id uuid primary key default gen_random_uuid(), reporter_id uuid, target_id uuid, window_id uuid, reason text, created_at timestamptz default now());
create table blocks  (blocker_id uuid, blocked_id uuid, primary key (blocker_id, blocked_id));

-- RLS
alter table profiles enable row level security;
create policy p_read on profiles for select to authenticated using (true);
create policy p_ins  on profiles for insert to authenticated with check (id = auth.uid());
create policy p_upd  on profiles for update to authenticated using (id = auth.uid());

alter table matches enable row level security;
create policy m_read on matches for select to authenticated using (auth.uid() in (user_a, user_b));
create policy m_upd  on matches for update to authenticated using (auth.uid() in (user_a, user_b));

alter table windows enable row level security;
create policy w_read on windows for select to authenticated using (auth.uid() in (sender_id, recipient_id));
create policy w_ins  on windows for insert to authenticated with check (
  sender_id = auth.uid() and exists (select 1 from matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
create policy w_upd  on windows for update to authenticated using (recipient_id = auth.uid());

alter table window_translations enable row level security;
create policy t_read on window_translations for select to authenticated using (
  recipient_id = auth.uid() or exists (select 1 from windows w where w.id = window_id and w.sender_id = auth.uid()));

alter table knocks enable row level security;
create policy k_read on knocks for select to authenticated using (auth.uid() in (from_user, to_user));
create policy k_ins  on knocks for insert to authenticated with check (from_user = auth.uid());

alter table reports enable row level security;
create policy r_ins on reports for insert to authenticated with check (reporter_id = auth.uid());
alter table blocks enable row level security;
create policy b_ins on blocks for insert to authenticated with check (blocker_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table window_translations, knocks, matches;
```

**Storage:** create a bucket named `media` and make it **public**. Add this policy:
```sql
create policy media_up on storage.objects for insert to authenticated
with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
```
The server writes `dubs/*` with the service_role key, which skips RLS.

**Database webhooks** (Dashboard → Database → Webhooks), both `POST {API_URL}/hooks/push` with header `x-hook-secret: {HOOK_SECRET}`:
1. `knocks` on INSERT
2. `window_translations` on UPDATE

---

## 7. App ↔ backend contract (Sid codes screens against this, you implement it in `real.ts`)

### `app/src/lib/types.ts`
```ts
export type Lang = string; // ISO 639-1

export type Profile = {
  id: string; name: string; languages: Lang[];
  home_city: string; country: string; tz: string; lat: number; lng: number;
  interests: string[]; dream_places: string[];
  mutual_dreams: boolean; hide_contact: boolean; onboarded: boolean;
};

export type Match = {
  id: string; city: string; reason: string;
  status: 'active' | 'paused' | 'ended';
  created_at: string;
  partner: Profile;            // the OTHER person, whichever column they're in
};

export type MatchResult = { city: string; status: 'matched' | 'waiting'; match?: Match };

export type Sticker = { word: string; reading: string; meaning: string; x: number; y: number }; // x,y in 0..1

export type WindowStatus = 'uploading' | 'processing' | 'ready' | 'blocked' | 'failed';

export type WindowItem = {
  id: string; match_id: string; sender_id: string; recipient_id: string;
  photo_url: string; audio_url?: string; dub_url?: string;
  caption: string; caption_t?: string; transcript?: string; transcript_t?: string;
  context_note?: string; stickers: Sticker[];
  src_lang?: Lang; lang?: Lang;
  spot?: string; spot_lat?: number; spot_lng?: number;
  saved: boolean; local_date: string; created_at: string;
  status: WindowStatus;
};

export type WindowProgress = {
  status: WindowStatus;
  steps: { safety?: boolean; transcribed?: boolean; translated?: boolean; voiced?: boolean };
  caption_t?: string;
};

export type Knock = { id: string; from_user: string; to_user: string; source: 'window' | 'app'; pattern: number[]; created_at: string };

export type ItineraryStop = { day: number; place: string; tip: string };

export type SendWindowInput = {
  id: string;                  // from newWindowId(); the app navigates to Sending with it immediately
  matchId: string; recipientId: string;
  photoUri: string;            // local file URI, ALREADY resized to 1440px JPEG by the screen
  audioUri?: string;           // local .m4a URI
  caption: string; spot?: string;
  localDate: string;           // 'YYYY-MM-DD' in the sender's timezone
};
```

### `app/src/lib/data.ts` (every function the screens call)
```ts
import { USE_MOCKS } from './config';
import * as mock from './mock';
import * as real from './real';
const src = USE_MOCKS ? mock : real;
export const {
  signUp, signIn, signOut, getMyProfile, saveProfile, registerPushToken,
  findMatches, getMatches, setMatchStatus,
  newWindowId, sendWindow, watchWindow, getToday, getWindow, saveWindow, getWall,
  watchInbox, sendKnock, getItinerary, reportUser,
} = src;
```

### What each function must do in `real.ts`

| Function | Signature | Behavior |
|---|---|---|
| `signUp` | `(email, password) => Promise<void>` | `supabase.auth.signUp`, then insert `profiles {id}`. Throw an `Error` with a human-readable message ("That email is already registered."). |
| `signIn` | `(email, password) => Promise<void>` | `signInWithPassword`. Readable errors. |
| `signOut` | `() => Promise<void>` | |
| `getMyProfile` | `() => Promise<Profile \| null>` | `null` if logged out. Sid's root layout routes on `null` / `onboarded`. |
| `saveProfile` | `(p: Partial<Profile>) => Promise<void>` | Update my row (called once per onboarding step). |
| `registerPushToken` | `() => Promise<void>` | Ask permission (expo-notifications + expo-device); `getExpoPushTokenAsync({ projectId })`; save it to `profiles.expo_push_token`. Never throw; silently skip on Android Expo Go or if denied. |
| `findMatches` | `() => Promise<MatchResult[]>` | `POST /match`, then return results with `partner` filled in. |
| `getMatches` | `() => Promise<Match[]>` | My matches with status `active` or `paused`, newest first, `partner` joined. |
| `setMatchStatus` | `(matchId, status) => Promise<void>` | |
| `newWindowId` | `() => string` | uuid v4 (use `expo-crypto`'s `randomUUID` if available, otherwise a small uuid function) |
| `sendWindow` | `(input: SendWindowInput) => Promise<void>` | Upload the photo to `media/{uid}/{id}.jpg` and the audio to `media/{uid}/{id}.m4a` (see the upload gotcha in section 13). Insert the `windows` row with the given `id`. Then `POST /process-window {window_id}`. The screen does **not** await this before navigating. Throw readable errors; a unique-violation error must become **"You already sent today's window."** |
| `watchWindow` | `(id, cb: (p: WindowProgress) => void) => () => void` | Immediately call `cb({status:'uploading', steps:{}})`. Subscribe via Realtime to `window_translations` where `window_id=eq.{id}`, **plus** poll every 2 s as a backup. Call `cb` on each change. Return an unsubscribe function. |
| `getToday` | `(matchId) => Promise<{ theirs?: WindowItem; mine?: WindowItem; sentToday: boolean }>` | `theirs` = partner's latest window with status `ready`. `mine` = my window for my local date today. |
| `getWindow` | `(id) => Promise<WindowItem>` | The window joined with its translation. Public URLs via `getPublicUrl`. |
| `saveWindow` | `(id, saved: boolean) => Promise<void>` | |
| `getWall` | `(matchId) => Promise<WindowItem[]>` | All `ready` windows **from the partner** in this match, newest first. |
| `watchInbox` | `(h: { onWindow: (w: WindowItem) => void; onKnock: (k: Knock) => void }) => () => void` | One Realtime channel. `window_translations` with `recipient_id=eq.{me}`: when status becomes `ready`, fetch the full window and call `onWindow`. `knocks` INSERT with `to_user=eq.{me}` → `onKnock`. |
| `sendKnock` | `(toUser, pattern: number[]) => Promise<void>` | Insert `knocks {from_user: me, to_user, source:'app', pattern}`. The app's default pattern is `[0, 250]` (knock-knock). |
| `getItinerary` | `(matchId) => Promise<ItineraryStop[]>` | Return `matches.itinerary` if cached, otherwise `POST /itinerary`. |
| `reportUser` | `(userId, reason, windowId?) => Promise<void>` | Insert into `reports` and `blocks`, and set every match with that user to `ended`. |

---

## 8. FastAPI server (`/server`)

`requirements.txt`: `fastapi uvicorn[standard] openai supabase httpx numpy python-dotenv`

Files: `main.py` (routes), `ai.py` (OpenAI and ElevenLabs calls), `db.py` (service-role Supabase client), `prompts.py`, `seed.py`.

**Auth on every app endpoint:** read `Authorization: Bearer <jwt>` and call `sb.auth.get_user(jwt)` to get the user id. Return 401 if that fails. CORS isn't needed (native app).

### `GET /health` → `{ "ok": true }`

### `POST /match` → `MatchResult[]` (body `{}`)
1. Load my profile. If `interest_vec` is null, embed `", ".join(interests)` with `text-embedding-3-small` and save it.
2. For each city in `dream_places` where I have no `active`/`paused` match with that `city`:
   - Candidates: `home_city = city`, `onboarded = true`, `id != me`, not blocked either way, not already matched with me.
   - Score = cosine(my_vec, their_vec) + **0.15** if `mutual_dreams` is on and `my.home_city in their.dream_places`. (Embed any candidate that's missing a vector.)
   - Pick the top candidate. If there's none, return `{city, status:'waiting'}`.
   - Reason (gpt-4o-mini): *"Write one warm sentence (≤ 25 words) telling {me.name} why they and {them.name} are a good fit. Mention 2–3 interests they genuinely share: {shared}. If true, mention that {them.name} dreams of visiting {me.home_city}. Refer to {them.name} by first name. No emojis."*
   - Insert `matches {user_a: me, user_b: them, city, reason}`.
3. Return results in `dream_places` order.

### `POST /process-window` → `202 {"ok": true}` (body `{ "window_id": uuid }`)
Verify the caller is the window's sender. Return immediately and run the pipeline in `BackgroundTasks`. After each step, **update `steps`** so the Sending screen's checklist ticks live.

1. Load the window, match, sender and recipient. `src_lang = sender.languages[0]`, `lang = recipient.languages[0]`. Upsert a `window_translations` row: `{window_id, match_id, recipient_id, src_lang, lang, status:'processing'}`.
2. **Moderation:** `omni-moderation-latest` with `[{type:'text', text: caption}, {type:'image_url', image_url:{url: photo_public_url}}]`. If flagged → `status:'blocked'`, stop. Otherwise `steps.safety = true`.
3. **Transcribe** (if audio): download the m4a and run `whisper-1` → `transcript`. Then `steps.transcribed = true`. (Set it to true even if there's no audio, so the checklist completes.)
4. **Hide contact info:** if `sender.hide_contact` and the match is under 7 days old, regex-replace phone numbers, emails, and `@handles` / URLs in the caption and transcript with `•••`.
5. **One `gpt-4o` call** with the image (`detail: "high"`) and **Structured Outputs** (`response_format` `json_schema`, `strict: true`, `additionalProperties: false`, every field required, nullable fields typed `["string","null"]`):
   ```json
   { "caption_t": "string", "transcript_t": "string|null", "context_note": "string",
     "stickers": [{ "word": "string", "reading": "string", "meaning": "string", "x": 0.0, "y": 0.0 }],
     "spot_suggestion": "string|null" }
   ```
   System prompt rules:
   - You help two pen pals in different countries understand each other's daily photo.
   - Translate the caption and transcript from {src} into {lang}, naturally, keeping the casual tone. If src == lang, copy them unchanged.
   - `context_note`: ≤ 45 words, written in {lang}, explaining something *actually visible* in the photo, in the context of {sender.home_city} / {sender.country}. Warm and specific. No stereotypes. Never invent facts. If unsure, describe what is visible.
   - `stickers`: up to 3 clearly visible, nameable objects. `word` in {src} script, `reading` = romanization (same as word if Latin script), `meaning` in {lang}, `x`/`y` = the object's center as fractions of width and height.
   - `spot_suggestion`: only if a well-known **public** place is clearly recognizable; otherwise null. Never guess homes or schools.
   
   Clamp `x`/`y` to 0.1–0.9. Save the fields. Then `steps.translated = true`.
6. **Spot → coordinates:** use `spot` (sender-provided), falling back to `spot_suggestion`. Call Nominatim `GET https://nominatim.openstreetmap.org/search?q={spot}, {city}&format=json&limit=1` with header `User-Agent: WindowHackGT/1.0`. Save `spot`, `spot_lat`, `spot_lng` on `windows`. Skip silently on failure.
7. **(Stretch) Voice:** ElevenLabs `POST https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}` (header `xi-api-key`, json `{text: transcript_t, model_id: "eleven_multilingual_v2"}`) → mp3 → upload to `media/dubs/{window_id}.mp3` → `dub_path`, `steps.voiced = true`. Skip if there's no key or no transcript.
8. `status:'ready'`.
9. Wrap the whole pipeline in try/except. On error → `status:'failed'`, `error: str(e)`. The app then shows the original photo and caption.

### `POST /itinerary` → `ItineraryStop[]` (body `{ "match_id": uuid }`)
- gpt-4o-mini receives the partner's windows (prefer `saved`; otherwise all `ready` ones): `spot`, `caption_t`, `context_note`, and date.
- Ask for 4–6 stops over 2 days, using **only places that appear in those windows**. Each `tip` is short, in the partner's voice, reusing their own words where possible.
- Cache the result in `matches.itinerary` and return it.

### `POST /hooks/push` (Supabase Database Webhook)
- Check that `x-hook-secret == HOOK_SECRET`. The body looks like `{type, table, record, old_record}`.
- `table == 'knocks'` (INSERT) → push to `to_user`: title **"Knock knock"**, body **"{from.name} knocked on your window"**, `data {type:'knock', id}`.
- `table == 'window_translations'` and `record.status == 'ready'` and `old_record.status != 'ready'` → push to `recipient_id`: title **"{sender.name}'s window arrived"**, body **"A new window from {sender.home_city}"**, `data {type:'window', id: window_id}`.
- Send with `POST https://exp.host/--/api/v2/push/send`, json `{to, title, body, sound:'default', data}`. Skip if there's no token.

---

## 9. Push notifications setup
- The app needs an EAS `projectId` for `getExpoPushTokenAsync`. Run `npx eas init` once in `/app` (it needs a free Expo account), which writes `extra.eas.projectId` to `app.json`. **Tell Sid before committing `app.json`.**
- iPhone + Expo Go: push works. Android + Expo Go: no remote push; the in-app Realtime `onKnock`/`onWindow` still works.
- Use an **iPhone** for the "phone buzzes when you knock" demo moment.

---

## 10. Hardware interface (for the Pi pair; you just need the DB side ready)

Each physical window is a Raspberry Pi logged into Supabase **as a normal user**, the person who owns that window:
- **Window 1** = Sid's account (in Atlanta)
- **Window 2** = the partner persona's account (e.g. Aiko in Kyoto)

Setup:
```python
from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
sb.auth.sign_in_with_password({"email": WINDOW_EMAIL, "password": WINDOW_PASSWORD})
me = sb.auth.get_user().user.id
partner = sb.table("profiles").select("*").eq("id", PARTNER_ID).single().execute().data
# partner["lat"], partner["lng"], partner["tz"] → sky color via the `astral` library
```

- **Sending a knock:** group taps that end after 1.2 s of silence (max 10). `pattern` = ms offsets from the first tap. Then `sb.table("knocks").insert({"from_user": me, "to_user": PARTNER_ID, "source": "window", "pattern": pattern}).execute()`
- **Receiving knocks:** every 1 s, `select * from knocks where to_user = me and created_at > last_seen order by created_at` → replay each `pattern` as knock sounds (or solenoid taps) and flash the LEDs.
- **New photo window pulse:** every 5 s, check `window_translations` where `recipient_id = me and status = 'ready' and created_at > last_seen` → pulse the LEDs.
- **Demo mode:** a key or button that runs the partner's sky through 24 hours in about 20 s.
- **Networking:** put the Pis on a **phone hotspot** (the hackathon Wi-Fi has a login page).
- **Auth refresh:** supabase-py refreshes the session automatically. If the Pi runs for many hours, re-sign-in when you get a 401.

---

## 11. Seed data (demo personas)

1. In Dashboard → Auth → Add user, create five users with email and password (keep the passwords in the team DM):
   - Aiko (Kyoto, `ja`)
   - Inês (Lisbon, `pt`)
   - Minjun (Seoul, `ko`)
   - Camille (Paris, `fr`)
   - Sofía (Mexico City, `es`)
2. `seed.py` (service role) fills in their profiles:
   - `onboarded = true`
   - `dream_places` includes **Atlanta**
   - interests overlapping Sid's: film photography, ramen, coffee, …
   - city-level lat/lng/tz, matching `app/src/lib/cities.ts`
   - `interest_vec` embedded
3. Aiko's history: upload 8–12 free Unsplash Kyoto photos to `media/{aiko_id}/`. Insert them as windows **from Aiko to Sid** once Sid's match exists, with past `local_date`s, and run each through the pipeline, so Wall and Passport have content.
4. The team is open about this: in the demo, teammates play the local partners.

---

## 12. Deploy
- Render → New Web Service → root `server/`
  - Build command: `pip install -r requirements.txt`
  - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Add the env vars from section 5
- **Render's free plan sleeps after about 15 minutes idle** (the first request then takes ~50 s). Add a free cron-job.org / UptimeRobot ping to `/health` every 10 minutes, and always call `/health` before demoing.
- Test every endpoint at `https://<service>/docs` before wiring up the app.
- Deploy **early**. Phones usually can't reach a laptop on hackathon Wi-Fi.

---

## 13. Gotchas
- **Uploading from React Native to Supabase Storage:** `fetch(uri).then(r => r.arrayBuffer())`, then `.upload(path, buf, { contentType })`. If files come out as 0 bytes, read the file as base64 with `expo-file-system` and use `decode()` from `base64-arraybuffer`. (That library would need installing; ask Sid first.)
- **Realtime only delivers rows the user can read under RLS,** and the table must be in the `supabase_realtime` publication.
- **Unique-violation Postgres error code** is `23505`. Map it to "You already sent today's window."
- Structured Outputs `strict: true` requires **every** property to be listed in `required`, and `additionalProperties: false` on every object.
- The app's `.env` changes need an Expo restart (`npx expo start -c`).

---

## 14. Build order and sync points (with Sid)

| # | Backend work | ✅ Test together |
|---|---|---|
| 1 | `schema.sql` run, bucket and policy created, `supabase.ts`, `types.ts` + `data.ts` committed | App runs on both phones |
| 2 | `real.ts`: `signUp`/`signIn`/`getMyProfile`/`saveProfile`/`sendWindow`/`getToday`/`watchInbox`. Server deployed with `/health`. | **Photo from phone 1 appears on phone 2** (no AI yet) |
| 3 | `/process-window` full pipeline, `watchWindow`, `getWindow`. `/match` + `findMatches`/`getMatches`. Personas seeded. | A window arrives translated, with a travel note and stickers. Matching returns Aiko. |
| 4 | `knocks` + `sendKnock` + `watchInbox.onKnock` + `/hooks/push` + `registerPushToken`. Pis can log in. | **Knock window 1 → window 2 knocks + the iPhone buzzes.** App Knock → window knocks. |
| 5 | `getWall`, `saveWindow`, `/itinerary` + `getItinerary`, `reportUser`, hiding contact info, ElevenLabs | Every screen works with `USE_MOCKS = false` |
| — | **Code freeze ~5:00 AM Sunday**, then the video and submission | |
