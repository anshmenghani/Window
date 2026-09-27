# Window

**See the world through someone else's window.**

Window is a pen-pal app that matches you with a real person in the city you dream of visiting. You trade photos
and voice notes, and AI translates and explains each one, then remembers your friendship as it grows.

We also built a small wooden window for each person's desk. Knock on yours, and your pen pal's window knocks back
the same rhythm, lit with the time of day where you are.

Made at HackGT 13 at Georgia Tech, September 2026.

## Why we built it

A lot of us have a city we've always wanted to see, and no real way to know what everyday life there is like.
Social feeds show you everyone and no one. We wanted the opposite: one person, one city, and a slow friendship
built from the small things they see every day.

The hard parts are language, context, and finding the right person. That's where the AI comes in. It removes
those walls, but it never talks for you. Every letter is written by a real person.

## How it works

1. You pick up to three cities you dream of visiting.
2. Window matches you with someone who actually lives in one of them. It prefers people who dream of your city
   too, and ranks them by the interests you share.
3. You send each other windows: a photo, a short handwritten-style note, and a voice note. Send as many as you
   like.
4. When your pen pal opens one, the photo has little word labels pinned on the things in it (tap one to hear how
   it's said). Your note and voice note show up in their language, along with a short travel note explaining what
   they're looking at.
5. Over time the app remembers your friendship: a prompt you both answer each day, stamps for real moments, a
   portrait of their city built only from what they've shown you, and a bond level that grows.
6. If you have the wooden windows, a knock on yours plays on theirs and their phone lights up.

## What the AI does

The AI runs on Meta's Muse Spark (text and images) and Muse Voice Transcribe (voice notes). If a Meta call ever
fails, it falls back to OpenAI for that one step, so a letter always gets delivered.

**Finding your match.** We compare interests using embeddings and rank people who live in your dream city,
with a bonus if they dream of your city too. Muse Spark then writes a short line about why you two fit.

**Every letter.** First the photo and caption go through a safety check. Then Muse Voice Transcribe turns the
voice note into text, with hints about both people's languages and local place names. Then a single Muse Spark
call looks at the photo and writes the translation, up to three word labels placed on objects in the picture,
a travel note about something that's actually in the photo, a well-known public place for the map pin if it
recognizes one, and an idea for how to write back.

**Every day.** You both get the same prompt, like "Show each other your coffee today." It's based on your
shared interests and recent letters, it doesn't repeat itself, and it gets more personal as you get closer.

**After each letter.** The app updates its portrait of your pen pal's city ("Isha's Cancún, as you know it")
using only what they've shown you, and it hands out memory stamps for real moments and firsts.

**On your Passport.** A two-day "When I visit" plan made from the places in their letters.

Some things are intentionally not AI. Your bond level is simply counted from what you've actually done together.
Locations are only ever city level, and contact details in captions are hidden for the first week.

## Features

- Sign up with a username, pick your languages (35, or type your own), and confirm you really live in your city.
  We check it once and only keep a yes or no.
- Live matching. You're matched with someone who's looking at the same time, or you can tap Match now.
- A Today screen with their window and yours side by side, today's shared prompt, and their sky right now.
- An arch-shaped camera with a selfie switch, a handwritten caption, and hold-to-talk voice notes.
- A paper crane that flies your letter across a globe while the AI works.
- Letters that open like real mail: envelope, postmark, word labels, translation with "show original", the voice
  note, and the travel note.
- A Wall with the city portrait, a map of their photos, and polaroids, plus a Passport with your bond, stamps, and
  trip plan.
- In-app banners and phone notifications when a letter or knock arrives.
- Safety built in: every letter is checked before delivery, city-level location only, contact info hidden for a
  week, and report and block.

## The physical windows

Each wooden window has a Raspberry Pi Pico W, an MMA845x accelerometer that feels knocks, an SG90 servo that
taps out incoming knocks, and a common-anode RGB LED that shows the other person's time of day. The windows talk
to Supabase directly, and a small bridge inside the database links each window to an app account, so a knock
also shows up on your pen pal's phone.

Firmware and setup are in [`hardware/pico/README.md`](hardware/pico/README.md) and [`WINDOWS_SETUP.md`](WINDOWS_SETUP.md).

## How it fits together

```
Phone app (Expo / React Native)
  │  uploads the photo and voice note, listens for updates
  ▼
Supabase (Postgres, Auth, Storage, Realtime, with row-level security on every table)
  │  asks the server to process the letter
  ▼
AI server (FastAPI on Render)
  → safety check (OpenAI moderation)
  → voice to text (Meta Muse Voice Transcribe)
  → Muse Spark reads the photo: translation, word labels, travel note, write-back idea, place
  → memory: city portrait and stamps, daily prompts, trip plan
  │  saves the results back to Supabase
  ▼
Your pen pal's phone: banner, phone notification, and the opened letter

Wooden windows (Pico W) ⇄ Supabase, through the window bridge
```

**Built with:** Expo SDK 57, React Native, Expo Router, Reanimated, and react-native-svg for the app. Supabase
for the database, login, file storage, and realtime updates. FastAPI on Render for the AI server. Meta Muse Spark
and Muse Voice Transcribe, with OpenAI as a backup. EAS Update and Expo push notifications. MicroPython on the
Pico W.

## Try it

1. Install Expo Go on your phone.
2. Open this link on your phone:
   `exp://u.expo.dev/2901e880-90a3-4373-8991-6ed76914bcb2?runtime-version=exposdk%3A57.0.0&channel-name=demo`
3. Sign up, pick a dream city, and tap Match now if nobody else is searching at the moment.

## What's in this repo

- `app/` is the phone app ([`app/README.md`](app/README.md))
- `server/` is the AI server ([`server/README.md`](server/README.md))
- `supabase/` has the database setup, the window bridge, the Pico additions, and demo helpers
- `hardware/pico/` is the firmware for the wooden windows

## Setting it up yourself

In the Supabase SQL editor, run these in order: `supabase/schema.sql`, `hardware/supabase/schema.sql`,
`supabase/window_bridge.sql`, `supabase/pico.sql`, `supabase/pico_time_light.sql`, and
`supabase/pico_playback.sql`. Then follow the app, server, and hardware READMEs linked above.
