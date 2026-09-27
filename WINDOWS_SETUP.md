# Connecting the physical windows to the app

The current hardware is a pair of Pico Ws. Follow
[hardware/pico/README.md](hardware/pico/README.md) for wiring, firmware files and
the complete SQL migration order. The Pico firmware uploads knocks, replays the
partner's rhythm with the servo and colors the RGB LED using the partner's time.

The two Pico W windows and the Window app share
**one** Supabase project: the app's. A small SQL file, `supabase/window_bridge.sql`, connects them
inside the database.

```text
 Sid's phone ──┐                                   ┌── Isha's phone
   knocks      │        SUPABASE (the app's)       │     knocks
               ▼                                   ▼
        knocks table  ◄──── window_bridge.sql ────► window_knocks table
               ▲         (converts the rhythm,      ▲
               │          checks they're pen pals)  │
 Sid's window (Pico, side A) ─────────────────── Isha's window (Pico, side B)
   accelerometer · servo · RGB light showing the partner's seasonal sky
```

What happens once it's set up:

| You do this | This happens |
|---|---|
| Knock on Sid's wooden window | Isha's servo knocks the same rhythm **and** Isha's phone shows "Sid knocked · on the window in Atlanta" (the crane on her sill hops and Sid's window on her sill rattles) |
| Knock back on Isha's wooden window | Sid's servo knocks it, and Sid's phone shows the banner |
| Isha changes her city in the app | Sid's window light follows the real sunrise/sunset/twilight for her new location and the current season |
| Pause the pen pals in the You tab | The windows stop knocking each other (and the app), until you resume |

## Setup (about 15 minutes)

### 1. Run the SQL, in this order
Supabase → **SQL Editor → New query**, paste, **Run**. All six are safe to run again.

1. `supabase/schema.sql` (the app; you've already run this, re-run it if you haven't since the AI update)
2. `hardware/supabase/schema.sql` (the hardware tables)
3. `supabase/window_bridge.sql` (the connection)
4. `supabase/pico.sql` (retry-safe Pico sending)
5. `supabase/pico_time_light.sql` (partner time + location for seasonal RGB sky)
6. `supabase/pico_playback.sql` (servo playback and impact strength)

On a Mac you can copy each file with, for example:
```bash
pbcopy < ~/Desktop/Window/supabase/window_bridge.sql
```

### 2. Get the publishable key
Supabase → **Project Settings → API Keys → "Publishable and secret API keys"** tab → copy the
**publishable** key (`sb_publishable_…`). If there isn't one yet, click create. It's safe to put on the
Picos. (The legacy **anon** key from the other tab also works.) Never put the `service_role` or secret key on a Pico.

### 3. Create a window pair (once)
From the repo's `hardware/` folder on any laptop:
```bash
cd hardware && python3 tools/app_cli.py --supabase-url https://iavzxfjnfacawojgzjwm.supabase.co --publishable-key sb_publishable_YOUR_KEY create-pair
```
It prints a `pair_id` (like `AB12CD34`) and a `pair_secret`. Keep the secret private: it goes only in
the two Picos' `config.json` (which is git-ignored), not in chat or GitHub.

### 4. Link the pair to the two app accounts (once)
Both people must have signed up in the app first. In the SQL Editor:
```sql
select public.window_link('AB12CD34', 'sid', 'isha');
```
Side **A** becomes the first username's window, side **B** the second's. It returns both time zones and
`"pen_pals_active": true` if they're currently pen pals. Re-run it any time to re-link.

### 5. Configure each Pico
Create `config.json` for each Pico from `hardware/pico/config.example.json`:
```json
{
  "supabase_url": "https://iavzxfjnfacawojgzjwm.supabase.co",
  "supabase_publishable_key": "sb_publishable_…",
  "pair_id": "AB12CD34",
  "pair_secret": "…",
  "side": "A"
}
```
Sid's window uses `"side": "A"`, Isha's uses `"side": "B"`. Upload the firmware
and configuration files listed in `hardware/pico/README.md`, then restart both
Picos.

### 6. Check it works
In the app: **You tab → Your window.** It shows whether your window and your pen pal's are online
(a lit lamp means the window checked in within the last minute; each Pico checks in every 30 s),
which partner sky your light is showing, and a **Knock on my window** button that makes *your own*
window knock three times while it is online (it doesn't reach your pen pal). Then:

1. Knock on window A → window B's servo replays it, and Isha's phone shows the knock banner.
2. Knock on window B → window A's servo replays it, and Sid's phone shows the banner.
3. Look at each Pico's Thonny shell for its connection and playback messages.

## Demo notes
- **Put the Picos on a phone hotspot.** The hackathon Wi-Fi has a login page they can't get through.
- The windows are linked to **accounts**, not matches. If you run `demo_reset.sql` block 2 (ending Isha's
  match so a judge can be matched with her), Sid's and Isha's windows stop knocking until Sid and Isha
  are pen pals again. Link the windows to the two demo accounts you keep matched.
- A knock rhythm on the Pico can be up to 12 taps; the app shows the first 10.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Pico says the event was not delivered | The two linked accounts are paused or no longer pen pals, so the knock was dropped on purpose |
| A Pico triggers the other Pico but nothing shows in the app | The pair isn't linked (step 4), or the usernames were wrong |
| Window light looks like the fallback clock palette | The partner profile is missing usable latitude/longitude; finish onboarding or update the city so seasonal solar light can be calculated |
| `Invalid pair credentials` | `pair_id` / `pair_secret` in `config.json` don't match what `create-pair` printed |
| `HTTP 401` from the Pico | Wrong key in `supabase_publishable_key` |
| You tab says "Offline" | The Pico is off, has no Wi-Fi, or its firmware isn't running (it checks in every 30 s) |
| You tab says "No physical window is linked" | Step 4 wasn't run for this account, or the bridge SQL hasn't been run yet |

To see how things are linked, run this in the SQL Editor:
```sql
select pair_id, side, user_id, timezone from public.window_sides order by pair_id, side;
```

## How the bridge works (for Isha and Ansh)
- `window_sides.user_id` (new column) says which app user owns each side.
- `window_knock_gate` (before insert on `window_knocks`): drops a linked window's knock while the two users
  aren't active pen pals. Unlinked pairs are untouched.
- `window_knock_to_app` (after insert on `window_knocks`): copies the knock into `knocks` with
  `source = 'window'`, converting gaps (`[0,180,520]`) to times since the first knock (`[0,180,700]`), at most 10.
- `app_knock_to_window` (after insert on `knocks`): copies `source = 'app'` knocks into `window_knocks` on the
  sender's side, converting back to gaps. A setting stops the copy from bouncing back into the app.
  (The app no longer sends knocks: knocking happens only on the physical windows. This stays in place in case
  an app knock is ever added back.)
- `window_follow_profile_tz` (after update of `profiles.tz`): keeps `window_sides.timezone` in step.
- Connection status: the bridge re-defines `window_get_partner` (same inputs and output) to also set
  `window_sides.last_seen_at`, because each Pico calls it every 30 s. Run the bridge after the hardware schema;
  re-running that schema later would undo the check-in, so re-run the bridge afterward.
  The app calls `window_status_for_me()` and `window_test_my_window()` (signed-in users only).
- The SQL integration tests cover knocks both ways, rhythm conversion, duplicates,
  pause state, time zones, unlinked pairs and repeatable migrations.
