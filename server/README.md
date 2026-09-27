# Window API

The FastAPI server behind Window. It handles matching, runs every letter through the AI (safety check, voice to text, translation, word labels, travel note), writes the daily prompts, keeps the memory stamps and city portrait up to date, builds the trip plan, and sends phone notifications.

## Local setup

1. Use Python 3.11 or newer and install `requirements.txt`.
2. Copy `env.example` to `.env`, then fill server-only credentials. Set `AI_PROVIDER=meta` and `META_API_KEY` to use Meta's Muse models (OpenAI is the backup). Never put the service-role key or any AI keys in the app.
3. Run the SQL in `../supabase/schema.sql` in the Supabase SQL editor, then turn off email confirmation in Supabase Auth.
4. Start with `uvicorn main:app --reload` from this directory. `/health?db=1` should return `{"ok": true, "ai": "meta", "db": "ok"}`, and `/docs` lists the routes.

## Deploy

Deploy this directory as a Render web service. Build: `pip install -r requirements.txt`. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Configure the environment variables from `env.example` in Render. Phone notifications need no extra setup: the server sends them when a letter is ready, and a database trigger in `schema.sql` tells it about knocks.

Pico W knock uploads go directly to Supabase, not to FastAPI. See
`../hardware/pico/README.md` for firmware and the additional retry-safe SQL migration.

For the Expo app, copy `app/env.example` to `app/.env` and fill in the public Supabase URL, anon key, and deployed API URL. The app's EAS project id is already set in `app/app.json`, which phone notifications need.

## Demo history

`demo_history.py` loads a week of past letters for the two demo accounts (`sid` and `isha`) through the same AI
pipeline a live letter uses, so the Wall and Passport aren't empty during a demo. Put the photos and a
`letters.json` in a folder (the format is at the top of the script), fill in `server/.env`, then run
`python demo_history.py <folder>` to preview and add `--yes` to load it. The Reset demo button in the app returns
both accounts to this history.
