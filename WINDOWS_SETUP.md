# Connecting the physical windows to the app

The two Raspberry Pi windows (Ansh's `window_sync_supabase_project`) and the Window app share
**one** Supabase project: the app's. A small SQL file, `supabase/window_bridge.sql`, connects them
inside the database. The Pi code and the app code don't need any changes.

```text
 Sid's phone ──┐                                   ┌── Aiko's phone
   knocks      │        SUPABASE (the app's)       │     knocks
               ▼                                   ▼
        knocks table  ◄──── window_bridge.sql ────► window_knocks table
               ▲         (converts the rhythm,      ▲
               │          checks they're pen pals)  │
 Sid's window (Pi, side A) ─────────────────────── Aiko's window (Pi, side B)
   accelerometer · buzzer · RGB light showing the partner's time of day
```

What happens once it's set up:

| You do this | This happens |
|---|---|
| Knock on Sid's wooden window | Aiko's window buzzes the same rhythm **and** Aiko's phone shows "Sid knocked · on the window in Atlanta" (the crane on her sill hops and Sid's window on her sill rattles) |
| Knock back on Aiko's wooden window | Sid's window buzzes it, and Sid's phone shows the banner |
| Aiko changes her city in the app | Sid's window light follows her new time zone |
| Pause the pen pals in the You tab | The windows stop knocking each other (and the app), until you resume |

## Setup (about 15 minutes)

### 1. Run the SQL, in this order
Supabase → **SQL Editor → New query**, paste, **Run**. All three are safe to run again.

1. `supabase/schema.sql` (the app; you've already run this, re-run it if you haven't since the AI update)
2. `hardware/supabase/schema.sql` (Ansh's window tables)
3. `supabase/window_bridge.sql` (the connection)

On a Mac you can copy each file with, for example:
```bash
pbcopy < ~/Desktop/Window/supabase/window_bridge.sql
```

### 2. Get the publishable key
Supabase → **Project Settings → API Keys → "Publishable and secret API keys"** tab → copy the
**publishable** key (`sb_publishable_…`). If there isn't one yet, click create. It's safe to put on the
Pis. (The legacy **anon** key from the other tab also works.) Never put the `service_role` or secret key on a Pi.

### 3. Create a window pair (once)
From the repo's `hardware/` folder (Ansh's Pi code) on any laptop:
```bash
cd hardware && python3 tools/app_cli.py --supabase-url https://iavzxfjnfacawojgzjwm.supabase.co --publishable-key sb_publishable_YOUR_KEY create-pair
```
It prints a `pair_id` (like `AB12CD34`) and a `pair_secret`. Keep the secret private: it goes only in
the two Pis' `config.json` (which is git-ignored), not in chat or GitHub.

### 4. Link the pair to the two app accounts (once)
Both people must have signed up in the app first. In the SQL Editor:
```sql
select public.window_link('AB12CD34', 'sid', 'aiko');
```
Side **A** becomes the first username's window, side **B** the second's. It returns both time zones and
`"pen_pals_active": true` if they're currently pen pals. Re-run it any time to re-link.

### 5. Configure each Pi
In `pi/config.json` on each Pi:
```json
{
  "supabase_url": "https://iavzxfjnfacawojgzjwm.supabase.co",
  "supabase_publishable_key": "sb_publishable_…",
  "pair_id": "AB12CD34",
  "pair_secret": "…",
  "side": "A"
}
```
Sid's window uses `"side": "A"`, Aiko's uses `"side": "B"`. Then start it (see Ansh's README):
```bash
python daemon.py --config config.json
```
No hardware yet? Add `--simulate` and press Enter to send a test knock.

### 6. Check it works
In the app: **You tab → Your window.** It shows whether your window and your pen pal's are online
(a lit lamp means the window checked in within the last minute; each Pi checks in every 30 s),
which time zone your light is showing, and a **Knock on my window** button that makes *your own*
window knock three times (it doesn't reach your pen pal). Then:

1. Knock on window A → window B buzzes, and Aiko's phone shows the knock banner.
2. Knock on window B → window A buzzes, and Sid's phone shows the banner.
3. Look at the Pi logs: `[light] partner timezone=Asia/Tokyo` on A, `America/New_York` on B.

## Demo notes
- **Put the Pis on a phone hotspot.** The hackathon Wi-Fi has a login page the Pis can't get through.
- The windows are linked to **accounts**, not matches. If you run `demo_reset.sql` block 2 (ending Aiko's
  match so a judge can be matched with her), Sid's and Aiko's windows stop knocking until Sid and Aiko
  are pen pals again. Link the windows to the two demo accounts you keep matched.
- A knock rhythm on the Pi can be up to 20 taps; the app shows the first 10.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Pi log says `uploaded event=None` | The two linked accounts are paused or no longer pen pals, so the knock was dropped on purpose |
| Pi knocks buzz the other Pi but nothing shows in the app | The pair isn't linked (step 4), or the usernames were wrong |
| Window light stays on UTC colors | Not linked yet, or that person hasn't finished onboarding (no time zone) |
| `Invalid pair credentials` | `pair_id` / `pair_secret` in `config.json` don't match what `create-pair` printed |
| `HTTP 401` from the Pi | Wrong key in `supabase_publishable_key` |
| You tab says "Offline" | The Pi is off, has no Wi-Fi, or its daemon isn't running (it checks in every 30 s) |
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
- Connection status: the bridge re-defines Ansh's `window_get_partner` (same inputs and output) to also set
  `window_sides.last_seen_at`, because each Pi calls it every 30 s. So **run the bridge after Ansh's schema**;
  re-running his schema later would undo the check-in (just re-run the bridge again).
  The app calls `window_status_for_me()` and `window_test_my_window()` (signed-in users only).
- Tested with the real app schema, Ansh's schema and his actual Pi daemon in simulate mode: knocks both ways,
  rhythm conversion, no duplicates, pause, time zones, unlinked pairs, re-running the SQL.
