import _thread
import binascii
import gc
import json
import network
import os
from time import ticks_ms, ticks_diff, sleep_ms

from api_client import WindowAPI
from rhythm import Detector
from sensor import Sensor

lock = _thread.allocate_lock()
shared = {"running": True, "queue": [], "sensor_error": None, "sensor_done": False}
QUEUE_LIMIT = 16


def running():
    with lock:
        return shared["running"]


def capture(config):
    try:
        sensor = Sensor(config.get("sensor", {}))
        detector = Detector(sensor.calibrate(), config.get("detection", {}), ticks_diff)
        print("[sensor] Ready to knock")
        while running():
            now = ticks_ms()
            pattern = detector.update(sensor.read(), now)
            if pattern:
                entry = {"id": binascii.hexlify(os.urandom(16)).decode(),
                         "pattern": pattern, "created": now}
                with lock:
                    full = len(shared["queue"]) >= QUEUE_LIMIT
                    if not full:
                        shared["queue"].append(entry)
                print("[send] Queue full; discarded new rhythm" if full else "[knock] queued", pattern)
            sleep_ms(10)
    except Exception as error:
        with lock:
            shared["sensor_error"] = str(error)
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
                        result = api.send(entry["id"], entry["pattern"])
                        if result.get("id") is None:
                            print("[send] Not delivered: linked match is paused or ended")
                        else:
                            print("[send] Uploaded event", result["id"])
                    with lock:
                        shared["queue"].pop(0)
                if last_heartbeat is None or ticks_diff(now, last_heartbeat) >= 30000:
                    partner = api.heartbeat()
                    last_heartbeat = ticks_ms()
                    print("[online] Partner timezone:", partner.get("timezone"))
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
