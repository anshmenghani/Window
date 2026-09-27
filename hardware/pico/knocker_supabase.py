import _thread
import binascii
import gc
import json
import network
import os
from time import ticks_ms, ticks_diff, sleep_ms

from api_client import WindowAPI
from sensor import Sensor

lock = _thread.allocate_lock()
shared = {"running": True, "queue": [], "sensor_error": None, "sensor_done": False,
          "partner_clock": None, "incoming": None, "receive_cursor": None}
QUEUE_LIMIT = 16


def running():
    with lock:
        return shared["running"]


class PlaybackStopped(Exception):
    pass


class PartnerLight:
    def __init__(self, light):
        self.light = light

    def update(self):
        with lock:
            active = shared["running"]
            snapshot = shared["partner_clock"]
        if not active:
            raise PlaybackStopped()
        self.light.update(ticks_ms(), snapshot)


def prepare_event(event):
    event_id = event.get("id")
    intervals = event.get("intervals_ms")
    if type(event_id) is not int or event_id < 1:
        raise ValueError("Invalid received event ID")
    if not isinstance(intervals, list) or not 1 <= len(intervals) <= 20 or intervals[0] != 0:
        raise ValueError("Invalid received rhythm")
    offsets = []
    total = 0
    for gap in intervals:
        if type(gap) is not int or not 0 <= gap <= 10000:
            raise ValueError("Invalid received gap")
        total += gap
        offsets.append(total)
    if total > 30000:
        raise ValueError("Received rhythm exceeds 30 seconds")
    impacts = event.get("impacts_g")
    if impacts is not None:
        if (not isinstance(impacts, list) or len(impacts) != len(intervals)
                or any(type(v) not in (float, int) or not 0 <= v <= 8 for v in impacts)):
            raise ValueError("Invalid received strength")
    return {"id": event_id, "offsets": offsets, "impacts_g": impacts}


def capture(config):
    light = None
    servo = None
    try:
        import knocker_local as knocker
        defaults = knocker.hardware_config()
        settings = {}
        for section in defaults:
            settings[section] = defaults[section].copy()
            settings[section].update(config.get(section, {}))
        light = knocker.TimeLight(settings["rgb_led"], settings["sensor"], ticks_diff)
        partner_light = PartnerLight(light)
        servo = knocker.PWM(knocker.Pin(knocker.SERVO_PIN))
        servo.freq(50)
        knocker.set_servo(servo, knocker.SERVO_REST_US)
        knocker.wait_ms(knocker.SETTLE_MS, partner_light)
        sensor = Sensor(settings["sensor"])
        recorder = knocker.KnockRecorder(sensor.calibrate(), settings["detection"])
        print("[sensor] Ready to knock")
        while running():
            partner_light.update()
            with lock:
                incoming = shared["incoming"]
            if incoming is not None:
                recorder.clear()
                knocker.play_knocks(servo, incoming["offsets"], incoming["impacts_g"], partner_light)
                recorder.clear()
                with lock:
                    shared["receive_cursor"] = incoming["id"]
                    shared["incoming"] = None
                print("[receive] Played event", incoming["id"])
                continue
            event = recorder.finish(ticks_ms())
            if event:
                entry = {"id": binascii.hexlify(os.urandom(16)).decode(),
                         "pattern": event["intervals_ms"], "impacts": event["impacts_g"],
                         "created": ticks_ms()}
                with lock:
                    full = len(shared["queue"]) >= QUEUE_LIMIT
                    if not full:
                        shared["queue"].append(entry)
                print("[send] Queue full; discarded new rhythm" if full else "[knock] queued", entry["pattern"])
            else:
                xyz = sensor.read()
                recorder.sample(xyz, ticks_ms())
            sleep_ms(10)
    except PlaybackStopped:
        pass
    except Exception as error:
        with lock:
            shared["sensor_error"] = str(error)
    finally:
        try:
            if servo is not None:
                try:
                    knocker.set_servo(servo, knocker.SERVO_REST_US)
                    sleep_ms(knocker.RETRACT_MS)
                finally:
                    servo.deinit()
        finally:
            try:
                if light is not None:
                    light.close()
            finally:
                with lock:
                    shared["sensor_done"] = True


def ensure_wifi(wlan, config):
    if wlan.isconnected():
        return
    print("[wifi] Connecting to hotspot")
    wlan.active(True)
    wlan.disconnect()
    wlan.connect(config["wifi_ssid"], config["wifi_password"])
    start = ticks_ms()
    while running() and not wlan.isconnected():
        if wlan.status() < 0 or ticks_diff(ticks_ms(), start) > 20000:
            raise OSError("Hotspot unavailable; retrying")
        sleep_ms(250)
    if wlan.isconnected():
        print("[wifi] Connected")


def run():
    with open("config.json") as f:
        config = json.load(f)
    for key in ("wifi_ssid", "wifi_password", "supabase_url", "supabase_publishable_key", "pair_id", "pair_secret", "side"):
        if not config.get(key) or "REPLACE_ME" in config[key] or config[key].startswith("YOUR_"):
            raise ValueError("Fill config.json field: " + key)
    retry_ms = max(1000, int(config.get("retry_ms", 3000)))
    ttl = max(1000, min(300000, int(config.get("queue_ttl_ms", 60000))))
    api = WindowAPI(config)
    wlan = network.WLAN(network.STA_IF)
    last_heartbeat = None
    light_enabled = bool(config.get("rgb_led", {}).get("enabled", True))
    last_receive = None
    poll_ms = max(250, int(config.get("poll_ms", 1000)))
    _thread.start_new_thread(capture, (config,))
    try:
        while True:
            with lock:
                sensor_error = shared["sensor_error"]
                entry = shared["queue"][0] if shared["queue"] else None
            if sensor_error:
                raise RuntimeError("Sensor stopped: " + sensor_error)
            try:
                ensure_wifi(wlan, config)
                now = ticks_ms()
                if entry:
                    if ticks_diff(now, entry["created"]) > ttl:
                        print("[send] Discarded expired offline rhythm")
                    else:
                        result = api.send(entry["id"], entry["pattern"], entry["impacts"])
                        if result.get("id") is None:
                            print("[send] Not delivered: linked match is paused or ended")
                        else:
                            print("[send] Uploaded event", result["id"])
                    with lock:
                        shared["queue"].pop(0)
                if last_heartbeat is None or ticks_diff(now, last_heartbeat) >= 30000:
                    partner = api.heartbeat(include_time=light_enabled)
                    last_heartbeat = ticks_ms()
                    if light_enabled:
                        hour = partner.get("local_hour")
                        if not isinstance(hour, (int, float)) or not 0 <= hour < 24:
                            raise ValueError("Missing partner local_hour; apply supabase/pico_time_light.sql")
                        with lock:
                            shared["partner_clock"] = (hour, last_heartbeat)
                    print("[online] Partner timezone:", partner.get("timezone"))
                with lock:
                    pending = shared["incoming"] is not None
                    cursor = shared["receive_cursor"]
                if not pending and (last_receive is None or ticks_diff(ticks_ms(), last_receive) >= poll_ms):
                    result = api.receive(cursor)
                    received_cursor = result.get("cursor")
                    if type(received_cursor) is not int or received_cursor < 0:
                        raise ValueError("Invalid receive cursor; apply supabase/pico_playback.sql")
                    events = result.get("events")
                    if not isinstance(events, list) or len(events) > 1:
                        raise ValueError("Unexpected receive response")
                    incoming = prepare_event(events[0]) if events else None
                    if incoming is not None and (cursor is None or incoming["id"] <= cursor):
                        raise ValueError("Received an old event")
                    with lock:
                        if incoming is not None:
                            shared["incoming"] = incoming
                        else:
                            shared["receive_cursor"] = max(cursor or 0, received_cursor)
                    last_receive = ticks_ms()
                gc.collect()
                sleep_ms(100)
            except (OSError, ValueError) as error:
                print("[network]", error)
                sleep_ms(retry_ms)
    finally:
        with lock:
            shared["running"] = False
        # Let the sampling thread finish before returning to the USB REPL.
        while True:
            with lock:
                done = shared["sensor_done"]
            if done:
                break
            sleep_ms(20)
        wlan.disconnect()
        print("[stop] Restart the Pico to run again")


if __name__ == "__main__":
    run()
