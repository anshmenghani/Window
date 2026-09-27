# Supabase Setup

This build uses Supabase as the entire shared backend. There is no FastAPI server.

## 1. Get the two public connection values

From your Supabase project, copy:

- Project URL: `https://YOUR_PROJECT.supabase.co`
- Publishable key: `sb_publishable_...`

The Pico Ws and shipped app should use the **publishable** key.

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

## 4. Pico config

Copy `pico/config.example.json` to `config.json`, then fill in the values below.
Upload the completed file to each Pico with the firmware files listed in
`pico/README.md`.

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

## 7. Start the Picos

Upload `main.py`, `knocker.py`, `window_server.py`, `supabase_client.py`, your
filled-in `config.json`, and `tls_pin.json` to each Pico. Restart both devices;
`main.py` starts the firmware automatically.

## Latency

Each Pico polls the secure `window_pico_get_knocks` RPC every second by default:

```json
"poll_ms": 1000
```

That keeps the database tables private while still making remote knocks feel nearly
instantaneous. Lower values improve latency but create more requests.
