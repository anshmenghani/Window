from machine import Pin, SoftI2C, PWM
from time import sleep_ms, ticks_ms, ticks_diff
from math import sqrt

THRESHOLD = 0.25
COOLDOWN = 250
SEQUENCE_GAP_MS = 1500
MAX_KNOCKS = 12

SERVO_PIN = 28
SERVO_REST_US = 1700
SERVO_STRIKE_US = 1150
SERVO_HARD_STRIKE_US = 1000

HARD_KNOCK_G = 1.5
PEAK_WINDOW_MS = 60
STRIKE_HOLD_MS = 120
RETRACT_MS = 120
SETTLE_MS = 500

LOCAL_START_HOUR = 12.0  # Set to local time when starting, e.g. 18.5 = 6:30 PM.
LIGHT_TIME_SPEED = 1.0  # Use 3600.0 to preview one hour of color per second.
RGB_BRIGHTNESS = 0.55


from rp2 import PIO, StateMachine, asm_pio


@asm_pio(sideset_init=PIO.OUT_LOW)
def _led_pwm():
    pull(noblock).side(0)
    mov(x, osr)
    mov(y, isr)
    label("count")
    jmp(x_not_y, "next")
    nop().side(1)
    label("next")
    jmp(y_dec, "count")


class PIOPWM:
    def __init__(self, state_machine, pin, duty_u16):
        self.sm = StateMachine(state_machine, _led_pwm, freq=2000000,
                               sideset_base=Pin(pin))
        self.active = False
        self.last_duty = None
        self.sm.put(255)
        self.sm.exec("pull()")
        self.sm.exec("mov(isr, osr)")
        self.duty_u16(duty_u16)

    def duty_u16(self, value):
        value = max(0, min(65535, int(value)))
        if value == self.last_duty:
            return
        self.last_duty = value
        if value in (0, 65535):
            self.sm.active(0)
            self.active = False
            self.sm.exec("nop().side(%d)" % (1 if value else 0))
        else:
            # The counter value 0 produces a narrow pulse; 255 is almost full on.
            self.sm.put(max(0, min(255, round(value * 256 / 65535) - 1)))
            if not self.active:
                self.sm.active(1)
                self.active = True

    def deinit(self):
        self.sm.active(0)
        self.active = False


ANCHORS = (
    (0.0, (0.03, 0.00, 0.10)),
    (5.0, (0.08, 0.01, 0.16)),
    (7.0, (1.00, 0.20, 0.03)),
    (9.0, (0.35, 0.55, 1.00)),
    (15.0, (0.18, 0.48, 1.00)),
    (18.5, (1.00, 0.28, 0.02)),
    (21.0, (0.30, 0.03, 0.35)),
    (24.0, (0.03, 0.00, 0.10)),
)


def color_for_hour(hour):
    hour %= 24
    for (start, first), (end, last) in zip(ANCHORS, ANCHORS[1:]):
        if start <= hour <= end:
            blend = (hour - start) / (end - start)
            return tuple(a + (b - a) * blend for a, b in zip(first, last))


class TimeLight:
    def __init__(self, config, sensor_config, ticks_diff):
        self.channels = []
        self.diff = ticks_diff
        self.snapshot = None
        self.hour = None
        self.last_tick = None
        self.last_render = None
        self.enabled = bool(config.get("enabled", False))
        self.anode = config.get("common", "cathode") == "anode"
        self.brightness = float(config.get("brightness", 0.55))
        if not self.enabled:
            return
        if config.get("common", "cathode") not in ("cathode", "anode"):
            raise ValueError("rgb_led.common must be cathode or anode")
        if not 0 <= self.brightness <= 1:
            raise ValueError("rgb_led.brightness must be 0..1")
        pins = [config.get(name + "_pin") for name in ("red", "green", "blue")]
        exposed = list(range(23)) + [26, 27, 28]
        reserved = [sensor_config.get("sda", 18), sensor_config.get("scl", 19), 28]
        if any(type(p) is not int or p not in exposed or p in reserved for p in pins):
            raise ValueError("Set RGB GPIOs; avoid sensor pins and servo pin GP28")
        if len(set(pins)) != 3:
            raise ValueError("RGB pins must be distinct")
        try:
            for state_machine, pin in enumerate(pins):
                self.channels.append(PIOPWM(state_machine, pin,
                                            duty_u16=65535 if self.anode else 0))
        except Exception:
            self.close()
            raise

    def update(self, now, snapshot):
        if not self.enabled:
            return
        if snapshot is not None and snapshot != self.snapshot:
            hour, received_at = snapshot
            if not isinstance(hour, (int, float)) or not 0 <= hour < 24:
                raise ValueError("Invalid partner local_hour from Supabase")
            self.hour = (hour + max(0, self.diff(now, received_at)) / 3600000) % 24
            self.snapshot = snapshot
            self.last_tick = now
            self.last_render = None
        elif self.hour is not None:
            # Advance incrementally so the wrapping tick counter remains safe.
            self.hour = (self.hour + max(0, self.diff(now, self.last_tick)) / 3600000) % 24
            self.last_tick = now
        if self.hour is None:
            return
        if self.last_render is not None and self.diff(now, self.last_render) < 1000:
            return
        for channel, value in zip(self.channels, color_for_hour(self.hour)):
            duty = int(value * self.brightness * 65535)
            channel.duty_u16(65535 - duty if self.anode else duty)
        self.last_render = now

    def close(self):
        for channel in self.channels:
            channel.duty_u16(65535 if self.anode else 0)
            channel.deinit()
        self.channels = []


class LocalLight:
    def __init__(self):
        if not 0 <= LOCAL_START_HOUR < 24 or LIGHT_TIME_SPEED <= 0:
            raise ValueError("Set LOCAL_START_HOUR to 0..24 and LIGHT_TIME_SPEED above zero")
        self.hour = LOCAL_START_HOUR
        self.last_tick = ticks_ms()
        self.last_render = None
        defaults = hardware_config()
        self.light = TimeLight(defaults["rgb_led"], defaults["sensor"], ticks_diff)
        self.update()
        print("Local light starts at hour:", LOCAL_START_HOUR)

    def update(self):
        now = ticks_ms()
        self.hour = (self.hour + ticks_diff(now, self.last_tick)
                     * LIGHT_TIME_SPEED / 3600000) % 24
        self.last_tick = now
        if self.last_render is not None and ticks_diff(now, self.last_render) < 100:
            return
        self.light.update(now, (self.hour, now))
        self.last_render = now

    def close(self):
        self.light.close()


def wait_ms(duration, light=None):
    if light is None:
        sleep_ms(duration)
        return
    start = ticks_ms()
    while True:
        light.update()
        remaining = duration - ticks_diff(ticks_ms(), start)
        if remaining <= 0:
            return
        sleep_ms(min(10, remaining))


def set_servo(servo, pulse_us):
    pulse_us = max(1000, min(2000, int(pulse_us)))
    servo.duty_ns(pulse_us * 1000)


def strike_for_impact(impact_g):
    strength = (impact_g - THRESHOLD) / (HARD_KNOCK_G - THRESHOLD)
    strength = max(0.0, min(1.0, strength))

    return int(
        SERVO_STRIKE_US
        + strength * (SERVO_HARD_STRIKE_US - SERVO_STRIKE_US)
    )


def play_knocks(servo, offsets, impacts=None, light=None):
    gaps = [
        offsets[i] - offsets[i - 1]
        for i in range(1, len(offsets))
    ]

    print("Playing back", len(offsets), "knocks")
    print("Gaps (ms):", gaps)

    if impacts is not None:
        print("Impact peaks (g):", [round(v, 2) for v in impacts])

    start = ticks_ms()

    try:
        for index, offset in enumerate(offsets):
            while ticks_diff(ticks_ms(), start) < offset:
                wait_ms(2, light)

            if impacts is None:
                pulse = SERVO_STRIKE_US
            else:
                pulse = strike_for_impact(impacts[index])

            set_servo(servo, pulse)
            wait_ms(STRIKE_HOLD_MS, light)

            set_servo(servo, SERVO_REST_US)
            wait_ms(RETRACT_MS, light)

    finally:
        set_servo(servo, SERVO_REST_US)

    wait_ms(SETTLE_MS, light)


def hardware_config():
    return {
        "sensor": {"sda": 18, "scl": 19, "frequency": 50000},
        "detection": {"threshold_g": THRESHOLD, "cooldown_ms": COOLDOWN,
                      "sequence_gap_ms": SEQUENCE_GAP_MS, "max_knocks": MAX_KNOCKS,
                      "peak_window_ms": PEAK_WINDOW_MS},
        "rgb_led": {"enabled": True, "red_pin": 11, "green_pin": 12,
                    "blue_pin": 13, "common": "anode", "brightness": RGB_BRIGHTNESS},
    }


class Sensor:
    def __init__(self, config):
        self.i2c = SoftI2C(
            sda=Pin(config.get("sda", 18)),
            scl=Pin(config.get("scl", 19)),
            freq=config.get("frequency", 50000),
        )
        sleep_ms(200)
        devices = self.i2c.scan()
        self.address = next((a for a in (0x1C, 0x1D) if a in devices), None)
        if self.address is None:
            raise RuntimeError(
                "MMA845x missing; check SDA GP18, SCL GP19, 3V3 OUT and GND"
            )
        chip_id = self.read_register(0x0D)[0]
        settings = {0x1A: (2, 4096), 0x2A: (4, 1024), 0x3A: (6, 256)}
        if chip_id not in settings:
            raise RuntimeError("Unknown accelerometer ID: " + hex(chip_id))
        self.shift, self.counts_per_g = settings[chip_id]
        self.write_register(0x2A, 0)
        self.write_register(0x0E, 0)
        self.write_register(0x2A, 1)
        print("[sensor] MMA845x", hex(chip_id))

    def read_register(self, register, length=1):
        self.i2c.writeto(self.address, bytes([register]), False)
        return self.i2c.readfrom(self.address, length)

    def write_register(self, register, value):
        self.i2c.writeto(self.address, bytes([register, value]))

    def read(self):
        data = self.read_register(1, 6)
        values = []
        for i in range(0, 6, 2):
            raw = (data[i] << 8) | data[i + 1]
            if raw & 0x8000:
                raw -= 65536
            values.append((raw >> self.shift) / self.counts_per_g)
        return values

    def calibrate(self, light=None):
        print("[sensor] Calibrating: keep the window still")
        baseline = [0.0, 0.0, 0.0]
        for _ in range(50):
            xyz = self.read()
            for i in range(3):
                baseline[i] += xyz[i] / 50
            wait_ms(20, light)
        return baseline


class KnockRecorder:
    def __init__(self, baseline, config=None):
        settings = hardware_config()["detection"]
        settings.update(config or {})
        self.baseline = baseline
        self.threshold = float(settings["threshold_g"])
        self.cooldown = int(settings["cooldown_ms"])
        self.gap = int(settings["sequence_gap_ms"])
        self.maximum = int(settings["max_knocks"])
        self.peak_window = int(settings["peak_window_ms"])
        if not (0 < self.peak_window < self.cooldown < self.gap <= 10000
                and 1 <= self.maximum <= 20 and self.threshold > 0):
            raise ValueError("Invalid knock detection settings")
        if self.cooldown < STRIKE_HOLD_MS + RETRACT_MS:
            raise ValueError("Knock cooldown must allow the servo to strike and retract")
        self.clear()

    def clear(self):
        self.offsets = []
        self.impacts = []
        self.first_tap = None
        self.last_trigger = None

    def finish(self, now):
        if not self.offsets:
            return None
        silence = ticks_diff(now, self.last_trigger)
        if (silence < self.gap
                and not (len(self.offsets) >= self.maximum and silence >= self.peak_window)
                and ticks_diff(now, self.first_tap) < 30000):
            return None
        offsets, impacts = self.offsets, self.impacts
        intervals = [0] + [offsets[i] - offsets[i - 1] for i in range(1, len(offsets))]
        self.clear()
        return {"offsets": offsets, "intervals_ms": intervals, "impacts_g": impacts}

    def sample(self, xyz, now):
        change = sqrt(sum((xyz[i] - self.baseline[i]) ** 2 for i in range(3)))
        if change >= self.threshold and (self.last_trigger is None
                or ticks_diff(now, self.last_trigger) >= self.cooldown):
            if self.first_tap is None:
                self.first_tap = now
            self.offsets.append(ticks_diff(now, self.first_tap))
            self.impacts.append(change)
            self.last_trigger = now
            print("KNOCK DETECTED:", round(change, 2), "g; count:", len(self.offsets))
            if len(self.offsets) > 1:
                print("Time since previous knock:", self.offsets[-1] - self.offsets[-2], "ms")
        elif self.impacts and ticks_diff(now, self.last_trigger) < self.peak_window:
            self.impacts[-1] = max(self.impacts[-1], change)


def detect_loop(read_acceleration, baseline, servo, light=None):
    recorder = KnockRecorder(baseline)
    while True:
        if light is not None:
            light.update()
        event = recorder.finish(ticks_ms())
        if event:
            play_knocks(servo, event["offsets"], event["impacts_g"], light)
            recorder.clear()
            print("Ready")
            continue
        xyz = read_acceleration()
        recorder.sample(xyz, ticks_ms())
        sleep_ms(10)


def run():
    if STRIKE_HOLD_MS + RETRACT_MS > COOLDOWN:
        raise ValueError(
            "Servo strike + retract time must not exceed knock cooldown"
        )

    if HARD_KNOCK_G <= THRESHOLD:
        raise ValueError(
            "HARD_KNOCK_G must exceed THRESHOLD"
        )

    if not 0 < PEAK_WINDOW_MS < COOLDOWN:
        raise ValueError(
            "PEAK_WINDOW_MS must be between zero and COOLDOWN"
        )

    servo = PWM(Pin(SERVO_PIN))
    servo.freq(50)
    light = None

    try:
        light = LocalLight()
        set_servo(servo, SERVO_REST_US)
        wait_ms(SETTLE_MS, light)

        sensor = Sensor(hardware_config()["sensor"])
        baseline = sensor.calibrate(light)
        print("Baseline:", [round(v, 2) for v in baseline])
        print("Ready")
        detect_loop(sensor.read, baseline, servo, light)

    finally:
        try:
            set_servo(servo, SERVO_REST_US)
            sleep_ms(RETRACT_MS)
        finally:
            try:
                servo.deinit()
            finally:
                if light is not None:
                    light.close()


if __name__ == "__main__":
    run()
