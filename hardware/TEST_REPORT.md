# Integration verification — September 27, 2026

Base repository: `anshmenghani/Window`, commit `90c7953`.

## Requirements and design

The existing implementation already connected hardware events to app events and exposed partner time. This update preserves that architecture and addresses reproducible reliability/setup gaps. The requirements are partner-local-time lighting, bidirectional physical knocks, bounded retry behavior without duplicate uploads, app visibility, and no partner delivery across paused/blocked relationships. The transport remains direct Pico → Supabase HTTPS RPC; the FastAPI service is not needed for physical delivery.

Alternatives considered: replacing polling with WebSockets/MQTT would add a broker or connection lifecycle and new device dependencies. Keeping the existing bounded one-event polling protocol provides a smaller change with realistic desktop and database coverage. Polling remains about once per second, with additional HTTPS latency. TLS remains explicitly pinned rather than accepting unverifiable connections.

## Results

| Check | Result |
|---|---|
| Python firmware/setup tests | **43 passed** |
| Python compile check | Passed |
| Fresh SQL migrations | Passed on PGlite 0.5.8, a PostgreSQL WASM runtime |
| Re-run all seven migrations | Passed |
| Upgrade from pgcrypto in public schema | Passed |
| Malformed historical rhythm | Preserved but skipped by receiver |
| Existing SQL suites: retry, partner time, playback | All passed |
| App → hardware / hardware → app | Passed with gaps ↔ offsets conversion and no bridge echo |
| Duplicate upload request ID | One event and one app copy |
| Paused match and blocked user | Partner delivery suppressed |
| Own-window diagnostic while paused | Delivered with servo-compatible 350 ms gaps |
| Wrong device secret, signed-out app, anonymous table permissions | Rejected |
| Device RPCs executed as anonymous role | Passed through security-definer credential checks |
| Profile timezone update, DST, fractional timezone | Passed |
| Expiration, sender exclusion, playback cursor | Covered by firmware and SQL tests |
| Upload failure / clock failure isolation | Other network operations still attempted |
| Configuration validation and complete upload bundle | Passed, including privileged-key rejection and overwrite protection |
| TypeScript `tsc --noEmit` | Passed |
| ESLint on both edited app files | Passed |
| Full Expo lint | **20 existing errors, 1 warning remain in untouched files** |
| Git whitespace/diff check | Passed |

The full lint output was initially 22 errors and 1 warning; the two unescaped-apostrophe errors in the edited screen were corrected. Remaining errors include existing hook ordering/immutability/effect issues in other components. They were not hidden by disabling lint rules. CI checks the changed integration and TypeScript; it does not claim the entire app is lint-clean.

## Iterations driven by tests and review

- Baseline: 30 desktop tests passed, but no executable isolated database runner existed.
- Added independent operation retries; adjusted the failure-injection clock to exercise retries over real simulated elapsed time, and asserted receive processing before upload recovery.
- Added a clock-failure regression that still queues incoming servo playback.
- Built real PostgreSQL tests with minimal local Auth/Storage scaffolding. Hosted `pg_net` is excluded because the WASM runtime does not implement its network worker; push delivery is not claimed as tested.
- Exercised fresh setup, migration repetition, extension-schema upgrade and malformed legacy events.
- Added shared config validation, a complete bundle generator, on-board diagnostics and a repeatable CI workflow.
- Updated user-facing status messages to distinguish enqueueing from playback and connection errors from unlinked hardware.

## Limits and release acceptance

No access to your powered Picos or live Supabase credentials was available. These tests do **not** verify MicroPython TLS callback/PIO/thread behavior on the physical board, I²C wiring, motor power/travel, LED polarity, real wireless reconnects, Supabase REST gateway, Expo realtime delivery or push notifications. PGlite tests are single-session; the per-pair SQL advisory-lock strategy was reviewed but not load-tested under simultaneous PostgreSQL sessions. Physical delivery is best effort with a 60-second event lifetime and an in-memory queue; it is not durable exactly-once motor actuation.

The shared pair secret authorizes both sides, as in the original protocol; these changes do not introduce per-device identity or remote revocation. Keep it private and use trusted paired frames. Certificate rotation needs repinning. Event/request tables retain data; a production retention policy is not included.

Code preparation and automated verification are complete. Deployment remains: apply SQL, configure/link the accounts and two boards, upload firmware, then execute the acceptance test in `INTEGRATION.md`. GitHub push alone does not deploy those components.

## Follow-up review

Integrated upstream commits `902083c` (README) and `90c7953` (Pico credential ignores). Fixed issues found in the first delivery: configuration bounds now match the existing recorder's supported timings and 20-tap limit; malformed numeric/JWT fields produce validation errors; on-board diagnosis can reconnect after main.py stops and requires valid time/cursor responses before reporting success. Six additional regression tests pass. Upstream credential-ignore rules are preserved without duplicate entries.
