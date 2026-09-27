# Window

Window connects two people through a mobile app and a pair of physical wooden
windows. Knock on one window and the other replays the rhythm with a servo. The
RGB light shows the other person's time of day.

## Repo layout

- `app/` — Expo mobile app
- `server/` — FastAPI service
- `supabase/` — database schema and migrations
- `hardware/pico/` — Pico W firmware

## Setup

- Mobile app: see [`app/README.md`](app/README.md)
- API server: see [`server/README.md`](server/README.md)
- Pico W hardware: see [`hardware/pico/README.md`](hardware/pico/README.md)
- Connect the hardware pair to the app: see [`WINDOWS_SETUP.md`](WINDOWS_SETUP.md)

The current hardware uses a Pico W, MMA845x accelerometer, SG90 servo and a
common-anode RGB LED.
