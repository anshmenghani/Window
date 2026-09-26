# Window Sync — Supabase + Raspberry Pi

This is the Supabase version of the paired physical Window project.

## What it does

- An accelerometer senses physical knocks.
- The Raspberry Pi converts the knock timestamps into a rhythm.
- The rhythm is uploaded directly to **Supabase Postgres** over Wi-Fi.
- The partner Pi receives it and reproduces the rhythm on a buzzer.
- The app writes each user's IANA timezone to Supabase.
- The opposite Window colors its 4-pin RGB LED according to that person's local time.

There is **no custom FastAPI/SQLite server anymore**.

```text
 App A ───────┐                      ┌─────── App B
 timezone     │                      │        timezone
              ▼                      ▼
        ┌────────────────────────────────┐
        │            SUPABASE            │
        │ Postgres + secure RPC Data API │
        │ pairs • timezones • knocks     │
        └───────────────┬────────────────┘
                        │ HTTPS / Wi-Fi
                 ┌──────┴──────┐
                 ▼             ▼
              RPi A           RPi B
            accel/RGB       accel/RGB
             buzzer          buzzer
```

## First-time setup

Read:

```text
SUPABASE_SETUP.md
```

Then run `supabase/schema.sql` in the Supabase SQL editor.

## Default Pi wiring

| Part | Raspberry Pi |
|---|---|
| RGB red | GPIO17 through resistor |
| RGB green | GPIO27 through resistor |
| RGB blue | GPIO22 through resistor |
| RGB common | GND for common cathode / 3.3 V for common anode |
| Buzzer signal | GPIO18 |
| Accelerometer SDA | GPIO2 / physical pin 3 |
| Accelerometer SCL | GPIO3 / physical pin 5 |
| Accelerometer power | 3.3 V + GND |

Use **one current-limiting resistor per RGB color channel**.

Supported accelerometers:
- MPU6050
- ADXL345

Supported buzzers:
- active buzzer/module
- passive PWM buzzer

If the buzzer requires more current than a GPIO can safely provide, use a
transistor/MOSFET driver.

## Enable I2C

```bash
sudo raspi-config
```

Enable **Interface Options → I2C**.

Optional sensor check:

```bash
sudo apt update
sudo apt install -y i2c-tools
i2cdetect -y 1
```

Typical addresses are `68` for MPU6050 and `53` for ADXL345.

## Run the Pi

```bash
cd pi
cp config.example.json config.json
nano config.json

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python daemon.py --config config.json
```

Without hardware:

```bash
python daemon.py --config config.json --simulate
```

## Knock format

```text
KNOCK --180 ms-- KNOCK ------520 ms------ KNOCK
```

is stored as:

```json
[0, 180, 520]
```

The partner Pi reproduces those delays on the buzzer.

The accelerometer is temporarily ignored during received-knock playback to stop the
buzzer vibration from being detected as a new knock and bouncing forever between
devices.

## RGB timezone behavior

The app sends an IANA timezone such as:

```text
America/New_York
Asia/Tokyo
Europe/London
```

The remote Pi calculates the correct local time with Python `zoneinfo` and moves the
RGB LED through:

```text
night purple
→ sunrise orange
→ daytime blue
→ sunset orange
→ evening purple
```

Edit `pi/time_light.py` to change the color curve.

## Supabase security model

The Pi/app contains only:

- Supabase project URL
- Supabase **publishable** key
- the secret for its Window pair

The underlying tables have RLS enabled and direct public table permissions revoked.
The clients call narrow `SECURITY DEFINER` Postgres functions which validate the pair
secret before accessing data.

Do not put a Supabase secret/service-role key into the Pi image or your mobile app.

## Repository

```text
window_sync_supabase_project/
├── README.md
├── SUPABASE_SETUP.md
├── APP_API.md
├── supabase/
│   └── schema.sql
├── pi/
│   ├── accelerometer.py
│   ├── api_client.py
│   ├── config.example.json
│   ├── daemon.py
│   ├── hardware.py
│   ├── requirements.txt
│   └── time_light.py
├── tools/
│   └── app_cli.py
└── deploy/
    └── window-sync.service
```
