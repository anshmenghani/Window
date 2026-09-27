# Partner-time RGB light on Pico W

For the current combined knock/servo/light firmware, follow **SYNC_SETUP.md**.
The light and PIO implementation is now bundled in `knocker_local.py` and shared
by Supabase mode. The standalone helper modules below remain as older references.

The Supabase firmware now supports a standard four-pin RGB LED. Its color follows
the **partner's** local time: dim purple at night, orange in the morning, blue
during the day, orange around sunset, and purple in the evening. These are fixed
clock-time transitions from the original Pi code, not calculated sunrise times.

## Connect the LED

Configured for your common-anode Adafruit four-pin RGB LED:

| LED channel | Pico GPIO |
|---|---|
| Red | GP11 |
| Green | GP12 |
| Blue | GP13 |

Use a separate **330 ohm resistor for each color channel**. Identify the legs
from your particular Adafruit product's pinout, not just their position.

- Your common-anode LED: common leg to **3V3 OUT**, `common` is `anode`.
- If changing to a common-cathode part later: common leg to GND, `common` to `cathode`.

Keep GP18/GP19 for the sensor and GP28 for the servo. The LED uses PIO state
machines **0, 1 and 2**, independently of the hardware PWM used by a servo.
This matters because GP12 shares a hardware PWM channel with GP28. Do not use
these three PIO state machines for another program at the same time.

## Apply the database addition

After the existing hardware schema and `supabase/window_bridge.sql`, run
**`supabase/pico_time_light.sql`** in the Supabase SQL Editor. Existing Pico knock
uploads still require `supabase/pico.sql`; neither migration replaces the other.

The new `window_pico_get_partner` function validates existing pair credentials,
records the heartbeat, and returns the partner's fractional local hour. PostgreSQL
handles IANA timezones and daylight saving, so the Pico needs no timezone library,
NTP connection or clock setup. An unset partner timezone falls back to UTC.
No FastAPI deployment is needed for this feature.

## Configure and upload

Add this section to the Pico's existing `config.json`, using your confirmed
GPIOs and common-leg type:

```json
"rgb_led": {
  "enabled": true,
  "red_pin": 11,
  "green_pin": 12,
  "blue_pin": 13,
  "common": "anode",
  "brightness": 0.55
}
```

`config.example.json` includes these settings. Existing configs without
`rgb_led` still upload knocks, but leave the light disabled until the section is added.

Upload these updated files to the Pico's filesystem root:

- `knocker_supabase.py`
- `api_client.py`
- **`knocker_local.py`** (shared LED, recorder and servo implementation)
- Your edited `config.json`

Keep the existing `main.py`, `sensor.py` and `tls_pin.json` on the
device. Restart it and keep the sensor still during calibration. The light stays
off until its first successful time lookup, then updates its blended color once
per second. Time is resynchronized from Supabase every 30 seconds.

During a hotspot outage, the light continues from the last known local time.
Timezone changes or daylight-saving transitions during an outage are corrected
when the network returns. Stopping the program turns off the LED and releases PWM.

In local mode, `knocker_local.py` uses the same RGB color curve with a configurable
starting hour; it has no network or partner-time lookup.

## Check it

1. Confirm `[online] Partner timezone: ...` names the partner's timezone.
2. Check the light against that location's current time. The curve uses purple
   at 00:00, orange at 07:00, blue at 09:00/15:00, orange at 18:30 and purple at 21:00.
3. If colors are swapped, correct the red/green/blue pin assignment.
4. If brightness appears inverted, verify common-anode versus common-cathode.
5. HTTP 404 with the light enabled usually means the new SQL function was not
   installed in the configured Supabase project.

Desktop checks:

```sh
python3 -m unittest discover -s hardware/pico/tests -p test_time_light.py -v
python3 -m unittest discover -s hardware/pico/tests -p test_led_pwm.py -v
python3 -m unittest discover -s hardware/pico/tests -p test_pico.py -v
```

`tests/time_light.sql` checks the database function in a test Supabase project and
rolls test data back. Hardware output and deployed SQL require separate testing.
