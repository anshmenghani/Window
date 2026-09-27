# Physical Window integration

This keeps the existing Expo app, Supabase database bridge, and MicroPython Pico W architecture. Both frames must use **the same Supabase project as the app**, one shared pair ID/secret, opposite sides, and two linked app accounts with an active match. The matching service does not automatically reassign a physical frame when a user changes pen pals: run `window_link` again for an intentional reassignment.

## Start here

1. Merge these changes into your repository and push normally. Deploying the app or pushing GitHub **does not run SQL or update Pico flash**.
2. If all six previous SQL scripts have been applied, run `supabase/pico_reliability.sql` in Supabase's SQL Editor. For a fresh installation, run `python3 hardware/tools/build_sql.py > setup.sql` from the repo root and execute `setup.sql`. It combines the seven migrations in the right order. Existing project data is preserved; malformed old hardware events are skipped. The scripts require SQL Editor/admin privileges.
3. Create a pair with the existing `hardware/tools/app_cli.py` (see `WINDOWS_SETUP.md`). Both people must finish app onboarding. Link the pair in SQL:
   ```sql
   select public.window_link('YOUR_PAIR_ID', 'first_username', 'second_username');
   ```
   Side A belongs to the first username, side B to the second. Check `pen_pals_active` is `true`. The partner's IANA timezone comes from their app profile, including daylight saving and fractional offsets.
4. Copy `hardware/pico/config.example.json` to `hardware/pico/config.json`. Fill **all** credentials. For the first frame use side `A`; for the second use `B`. Preserve the same pair ID and secret. Use a 2.4 GHz network/hotspot without a captive portal. Keep real configs out of Git.
5. From the repo root, prepare frame A:
   ```bash
   python3 hardware/tools/prepare_pico.py --config hardware/pico/config.json --output hardware/device-bundles/A --check-backend
   ```
   The tool verifies configuration and the two read RPCs, verifies the server's certificate against your computer's CA store, and assembles every firmware file with its TLS pin. It updates the device heartbeat but sends no knock. A private output folder must not already exist. Set side `B` in the config and repeat with output `hardware/device-bundles/B`.
6. In Thonny, upload **all `.py` and `.json` files inside the corresponding bundle** to each Pico's filesystem root. Use official **Pico W** MicroPython supporting `ssl.SSLContext.verify_callback`; plain Pico has no Wi-Fi. Interrupt `main.py`, soft-reset to clear prior thread state if needed, and run:
   ```python
   import diagnose
   diagnose.run()
   ```
   This reads the accelerometer and checks Wi-Fi, TLS, credentials, partner time and receive initialization. It does not move the servo. Restart the board afterward. Wait for `[sensor] Ready to knock` and the first successful receive initialization before testing; the first poll intentionally skips old events.

If the TLS certificate rotates, rerun preparation into a new directory and upload its `tls_pin.json`. A wrong or missing certificate fails closed before sending credentials; never disable the check. A server using multiple leaf certificates may require reprovisioning against the certificate seen by the Pico.

## Wiring used by this firmware

GPIO names are **GP numbers**, not header pin numbers. Keep the project's proven servo travel constants unless you recalibrate mechanically.

| Part | Pico connection |
|---|---|
| MMA845x SDA / SCL | GP18 / GP19 by default; adjustable in config |
| MMA845x power | 3V3 OUT and GND; confirm the breakout's labeling |
| Servo signal | GP28; 50 Hz, 1700 µs rest, 1150–1000 µs strike |
| Servo power | Supply appropriate to your servo; common ground with Pico; do not power the motor from a GPIO or 3V3 OUT |
| RGB red / green / blue | GP11 / GP12 / GP13, **one resistor per color** |
| RGB common | Common anode to 3.3 V by default; common cathode to GND with `common: "cathode"` |

Do not drive a 5 V RGB common from these GPIOs. Use an appropriate driver if your lighting needs more current or voltage. The firmware expects the existing servo mechanism, not a bare vibration motor. It uses PIO for RGB so the LED pins do not conflict with the servo's PWM slice. An accelerometer missing at I²C addresses `0x1C` or `0x1D` is a wiring/soldering/power problem; network changes cannot fix it.

## Acceptance test on the two real frames

1. Open **You → Your window** in both apps. Confirm both frames online and the expected partner timezone.
2. Press **Knock on my window**. Only your frame should strike three times. This button confirms enqueueing, not physical playback. Tests expire after 60 seconds and startup skips old tests.
3. Tap A at approximately 0, 400, 1100 ms, then stop for 1.5 seconds. B should replay three taps at those offsets; B's app should receive one knock. A must not echo. Repeat B → A.
4. Change B's city/timezone in the app. A's lighting should adjust after its next 30-second refresh. The colors represent local civil time, not a computed astronomical sunrise/sunset.
5. Disconnect A's Wi-Fi briefly, then reconnect. Verify time continues locally, networking recovers, and retries don't duplicate a knock. Offline outgoing events expire after 60 seconds; reboot loses the in-memory queue. Do not expect replay after a reboot.
6. Pause the match: partner knocks stop; the own-window self-test still works. Resume and verify both directions. A block also disables partner knocks.
7. Confirm no phantom recording while the servo plays or settles. Adjust mechanical isolation/threshold if needed. The receiver deliberately ignores its accelerometer during playback and 500 ms settling.

Allow about **1.5 seconds recording silence + up to one polling interval + HTTPS time** before playback. Faster-than-240 ms tap gaps cannot be reproduced by this servo cycle. Network timeout/retry delays can be longer. This is best-effort ephemeral delivery, not durable exactly-once actuation: software retries deduplicate uploads, but no server acknowledgment proves the motor physically moved.

## What changed and why

- Independent retry schedules keep an upload/clock failure from preventing the other network operations. A single HTTP request can still occupy the network thread until its timeout; sensor/servo/light work remains separate.
- One additive migration validates every new rhythm, skips malformed historical events, serializes supported write/read paths per pair, repairs pgcrypto schema placement, honors blocks, and distinguishes own-window diagnostics from partner events.
- Configuration validation catches placeholders, pin collisions, invalid timings and privileged API keys before hardware starts. Bundles include all required files and are protected from accidental Git commits and overwrites.
- App status errors are shown rather than mislabeled as “not linked,” and test messages describe the actual 60-second lifetime.
- Added repeatable database integration tests and GitHub CI. See `TEST_REPORT.md` for exactly what was verified and what remains physical.

## Re-run verification

```bash
python3 -m unittest discover -s hardware/pico/tests -v
cd hardware/tests
npm ci
npm test
cd ../../app
npm ci
npx tsc --noEmit
npx eslint 'src/app/(tabs)/you.tsx' src/lib/real.ts
npx expo lint
```

The full app lint command currently reports unrelated existing errors; the two edited app files pass. The new CI runs firmware tests, database tests, TypeScript and targeted lint. No private project keys are needed for these tests. Supabase HTTP/RLS gateway behavior, hosted realtime/push, radio performance, TLS handshake on MicroPython and actual motor timing require the acceptance test above.
