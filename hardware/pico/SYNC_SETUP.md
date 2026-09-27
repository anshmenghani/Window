# Matching local and Supabase behavior

`knocker_local.py` is the shared source of the recorder, impact-to-servo mapping,
servo playback, RGB color curve and PIO LED driver. It still runs by itself for
local testing. Importing it from `knocker_supabase.py` does not start local mode.

| Behavior | Local mode | Supabase mode |
|---|---|---|
| Record rhythm and peak impact | Yes | Same recorder |
| Servo timing, swing and direction | GP28, reversed swing | Same playback function |
| Playback source | Your just-recorded rhythm | Partner's received rhythm |
| Ignore sensor during playback/settling | Yes | Yes |
| RGB colors | Configurable local starting time | Partner's server-provided time |
| LED pins/polarity | GP11 red, GP12 green, GP13 blue; common anode | Same defaults |
| Sensor | SDA GP18, SCL GP19 | Same defaults |

Defaults: 0.25g threshold, 250 ms debounce, 1.5 seconds of silence, 60 ms impact
peak window and 12 taps. Servo rest is 1700 µs, gentle strike 1150 µs, hard strike
1000 µs, with 120 ms strike, 120 ms retract and 500 ms settling. The approximate
impact measure varies swing distance, not calibrated physical force.

## Update the database once

If already set up, apply **`supabase/pico_playback.sql`** to your Supabase project.
It adds impact strength to hardware events and two credential-checked RPCs:
`window_pico_send_knock_with_strength` and `window_pico_get_knocks`.
Retries still use the existing request-ID protection. Old clients continue to
work; received events without strength use the gentle strike.

For a new project, the complete SQL order is:

1. `supabase/schema.sql`
2. `hardware/supabase/schema.sql`
3. `supabase/window_bridge.sql`
4. `supabase/pico.sql`
5. `supabase/pico_time_light.sql`
6. `supabase/pico_playback.sql`

Create one hardware pair and link it to your two app accounts as described in
`WINDOWS_SETUP.md`. Use the same pair ID/secret on both Picos, side A on one and
side B on the other. Keep their app match active.

## Upload to BOTH Picos

Save these files in the Pico's filesystem root:

```text
main.py
knocker_supabase.py
knocker_local.py
api_client.py
sensor.py
config.json
tls_pin.json
```

`config.json` is your filled-in copy of `config.example.json`, not the example
with placeholders. `tls_pin.json` is produced on your computer by `provision.py`.
Preserve your actual credentials and side assignment when updating files.
The standalone helper files `rhythm.py`, `time_light.py` and `led_pwm.py` are no
longer needed by either entry point; old copies can remain on the device.

**For an older config:** remove its `detection` section to inherit the local
defaults, or update it to the new example (250 ms cooldown, 1500 ms gap, 60 ms
peak window). Explicit sensor/detection/RGB settings still override defaults.
Set `rgb_led.enabled` to true to use the common-anode RGB light. Never put a
Supabase service-role key on a Pico.

Restart both devices and wait for their online messages before testing. Knock
on A: B should replay the rhythm with stronger swings for stronger taps, and
B's app should receive its banner. A does not echo its own outgoing knocks.
Then test B to A. The app's hardware test works while the linked match is active.

## Delivery and timing

- Network requests run separately from sensor/servo/LED work. Local sampling
  continues while HTTP waits; the sensor is intentionally not sampled during
  servo playback and the 500 ms settling period.
- The receiver polls about once per second. It stores one incoming event until
  playback completes, then advances its in-memory cursor. A single event is not
  repeatedly queued while the servo is still playing it.
- Boot starts at the current database cursor: old knocks are not replayed after
  a restart. Events older than 60 seconds are skipped, and paused/ended linked
  matches don't deliver queued events. An already-started playback can finish.
- An incoming knock clears any unfinished local recording to prevent feedback.
  Outgoing sequences already queued for upload remain queued.
- The recorded gaps are preserved, but the servo cannot physically reproduce
  gaps shorter than its 240 ms strike/retract cycle. Legacy faster rhythms play
  as quickly as the servo cycle allows. Current defaults record taps at least
  250 ms apart.
- The RGB light uses the partner's time in Supabase mode; local mode uses
  `LOCAL_START_HOUR`. Both use the same color curve and independent PIO outputs,
  so GP12/GP13 do not interfere with the servo's hardware PWM channel.

Desktop verification: `python3 -m unittest discover -s hardware/pico/tests -v`.
Run `tests/playback.sql` in a test Supabase project for transactional integration
checks. Desktop mocks do not verify actual servo travel, PIO timing, power or
the deployed database.
