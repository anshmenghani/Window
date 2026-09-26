# Supabase Setup

This build uses Supabase as the entire shared backend. There is no FastAPI server.

## 1. Get the two public connection values

From your Supabase project, copy:

- Project URL: `https://YOUR_PROJECT.supabase.co`
- Publishable key: `sb_publishable_...`

The Raspberry Pis and shipped app should use the **publishable** key.

Do not place a Supabase secret/service-role key on a Pi or in frontend/mobile code.

## 2. Create the schema

Open:

**Supabase Dashboard → SQL Editor → New query**

Paste and run the entire file:

```text
supabase/schema.sql
```

It creates the three tables plus the RPC functions the app/Pis call.

## 3. Create a Window pair

From this repository:

```bash
python3 tools/app_cli.py \
  --supabase-url https://YOUR_PROJECT.supabase.co \
  --publishable-key sb_publishable_YOUR_KEY \
  create-pair
```

It returns:

```json
{
  "pair_id": "AB12CD34",
  "pair_secret": "..."
}
```

Put the same pair ID/secret on both devices. One is side `A`, the other side `B`.

## 4. Pi config

```bash
cd pi
cp config.example.json config.json
nano config.json
```

Fill in:

```json
{
  "supabase_url": "https://YOUR_PROJECT.supabase.co",
  "supabase_publishable_key": "sb_publishable_...",
  "pair_id": "AB12CD34",
  "pair_secret": "...",
  "side": "A"
}
```

## 5. Set a timezone exactly like the app would

```bash
python3 tools/app_cli.py \
  --supabase-url https://YOUR_PROJECT.supabase.co \
  --publishable-key sb_publishable_YOUR_KEY \
  --pair-id AB12CD34 \
  --secret YOUR_PAIR_SECRET \
  --side A \
  timezone America/New_York
```

The other user might publish `Asia/Tokyo`, `Europe/London`, etc.

## 6. Test a knock without hardware

Side A:

```bash
python3 tools/app_cli.py \
  --supabase-url https://YOUR_PROJECT.supabase.co \
  --publishable-key sb_publishable_YOUR_KEY \
  --pair-id AB12CD34 \
  --secret YOUR_PAIR_SECRET \
  --side A \
  knock 0 180 520
```

Side B can read it with:

```bash
python3 tools/app_cli.py \
  --supabase-url https://YOUR_PROJECT.supabase.co \
  --publishable-key sb_publishable_YOUR_KEY \
  --pair-id AB12CD34 \
  --secret YOUR_PAIR_SECRET \
  --side B \
  receive --after-id 0
```

## 7. Start the Pi daemon

```bash
cd pi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python daemon.py --config config.json
```

Simulation:

```bash
python daemon.py --config config.json --simulate
```

## Latency

The Pi currently polls the secure `window_get_knocks` RPC every ~450 ms:

```json
"poll_interval_ms": 450
```

That keeps the database tables private while still making remote knocks feel nearly
instantaneous. Lower values improve latency but create more requests.
