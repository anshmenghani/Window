# Window API

FastAPI service for matching, processing windows, itinerary generation, and database push webhooks.

## Local setup

1. Use Python 3.11 or newer and install `requirements.txt`.
2. Copy `env.example` to `.env`, then fill server-only credentials. Do not put service-role, OpenAI, ElevenLabs, or webhook secrets in the app.
3. Run the SQL in `../supabase/schema.sql` in the Supabase SQL editor, then turn off email confirmation in Supabase Auth.
4. Start with `uvicorn main:app --reload` from this directory. `/health` should return `{"ok": true}` and `/docs` lists the routes.

## Deploy

Deploy this directory as a Render web service. Build: `pip install -r requirements.txt`. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Configure the environment variables from `env.example` in Render. Add Database Webhooks for `knocks` INSERT and `window_translations` UPDATE to `/hooks/push`, with `x-hook-secret` set to the same `HOOK_SECRET` value.

Pico W knock uploads go directly to Supabase, not to FastAPI. See
`../hardware/pico/README.md` for firmware and the additional retry-safe SQL migration.

For the Expo app, copy `app/env.example` to `app/.env` and fill in the public Supabase URL, anon key, and deployed API URL. An EAS project id is still needed for device push tokens; add it through your Expo account in `app/app.json` before expecting `registerPushToken` to store a token.

## Demo personas

Create the demo users in Supabase Auth first. Then set `PERSONAS_JSON` to a JSON array of profile objects containing the existing user ids, names, city/country, IANA time zones, city-level coordinates, languages, and interests. Run `python seed.py` from this directory. Persona passwords are not accepted or stored by the script.
