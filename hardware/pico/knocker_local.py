from machine import Pin, SoftI2C, PWM
from time import sleep, sleep_ms, ticks_ms, ticks_diff
from math import sqrt

THRESHOLD = 0.25
COOLDOWN = 200  # Minimum milliseconds between detected taps.
SEQUENCE_GAP_MS = 1500  # Silence after the final tap before playback.
MAX_KNOCKS = 12

SERVO_PIN = 28
# Conservative starting positions; adjust to your horn/wood placement.
# Swap direction by making STRIKE_US smaller than REST_US if needed.
SERVO_REST_US = 1500
SERVO_STRIKE_US = 1750  # Gentle knock endpoint.
SERVO_HARD_STRIKE_US = 1950  # Strong knock endpoint; tune to avoid pushing into wood.
HARD_KNOCK_G = 1.5  # Measured acceleration change that gives maximum swing.
PEAK_WINDOW_MS = 60  # Capture the impact peak after crossing the threshold.
STRIKE_HOLD_MS = 80
RETRACT_MS = 120
SETTLE_MS = 500


def set_servo(servo, pulse_us):
    # Stay inside a conservative 1–2 ms pulse range at 50 Hz.
    servo.duty_ns(max(1000, min(2000, int(pulse_us))) * 1000)


def strike_for_impact(impact_g):
    """Acceleration is a strength estimate, not a force/torque measurement."""
    strength = max(0.0, min(1.0, (impact_g - THRESHOLD) / (HARD_KNOCK_G - THRESHOLD)))
    return int(SERVO_STRIKE_US + strength * (SERVO_HARD_STRIKE_US - SERVO_STRIKE_US))


def play_knocks(servo, offsets, impacts=None):
    """Replay tap-onset offsets without adding servo travel time to every gap."""
    gaps = [offsets[i] - offsets[i - 1] for i in range(1, len(offsets))]
    print("Playing back", len(offsets), "knocks; gaps (ms):", gaps)
    if impacts is not None:
        print("Impact peaks (g):", [round(value, 2) for value in impacts])
    start = ticks_ms()
    try:
        for index, offset in enumerate(offsets):
            while ticks_diff(ticks_ms(), start) < offset:
                sleep_ms(2)
            pulse = SERVO_STRIKE_US if impacts is None else strike_for_impact(impacts[index])
            set_servo(servo, pulse)
            sleep_ms(STRIKE_HOLD_MS)
            set_servo(servo, SERVO_REST_US)
            sleep_ms(RETRACT_MS)
    finally:
        set_servo(servo, SERVO_REST_US)
    # No sensor reads during playback or this settling time: no self-triggering.
    sleep_ms(SETTLE_MS)


def detect_loop(read_acceleration, baseline, servo):
    last_trigger = None
    offsets = []
    impacts = []
    first_tap = None
    while True:
        now = ticks_ms()
        # Finish before reading a new sample so playback vibrations never enter
        # the next sequence. A fresh timestamp is used after the blocking replay.
        if offsets and (ticks_diff(now, last_trigger) >= SEQUENCE_GAP_MS
                        or (len(offsets) >= MAX_KNOCKS
                            and ticks_diff(now, last_trigger) >= PEAK_WINDOW_MS)):
            play_knocks(servo, offsets, impacts)
            offsets = []
            impacts = []
            first_tap = None
            last_trigger = None
            print("Ready")
            continue

        xyz = read_acceleration()
        change = sqrt(sum((xyz[i] - baseline[i]) ** 2 for i in range(3)))
        now = ticks_ms()
        if change >= THRESHOLD and (last_trigger is None
                                   or ticks_diff(now, last_trigger) >= COOLDOWN):
            if first_tap is None:
                first_tap = now
            gap_ms = None if last_trigger is None else ticks_diff(now, last_trigger)
            offsets.append(ticks_diff(now, first_tap))
            impacts.append(change)
            last_trigger = now
            print("KNOCK DETECTED:", round(change, 2), "g; count:", len(offsets))
            if gap_ms is not None:
                print("Time since previous knock:", gap_ms, "ms")
        elif impacts and ticks_diff(now, last_trigger) < PEAK_WINDOW_MS:
            # A knock often peaks a few samples after its first threshold crossing.
            impacts[-1] = max(impacts[-1], change)
        sleep_ms(10)


def run():
    if STRIKE_HOLD_MS + RETRACT_MS > COOLDOWN:
        raise ValueError("Servo strike + retract time must not exceed knock cooldown")
    if HARD_KNOCK_G <= THRESHOLD or not 0 < PEAK_WINDOW_MS < COOLDOWN:
        raise ValueError("Hard-knock threshold must exceed detection threshold; peak window must fit cooldown")
    servo = PWM(Pin(SERVO_PIN))
    servo.freq(50)
    try:
        set_servo(servo, SERVO_REST_US)
        sleep_ms(SETTLE_MS)
        # GP6 = SDA, GP7 = SCL
        i2c = SoftI2C(
            sda=Pin(6),
            scl=Pin(7),
            freq=50000
        )

        sleep(0.2)

        # -----------------------------
        # Find sensor
        # -----------------------------

        devices = i2c.scan()
        print("Found devices:", devices)

        if 0x1C in devices:
            address = 0x1C
        elif 0x1D in devices:
            address = 0x1D
        else:
            raise Exception("MMA845x not found")

        # -----------------------------
        # Register functions
        # -----------------------------

        def read_register(register, length=1):
            i2c.writeto(address, bytes([register]), False)
            return i2c.readfrom(address, length)


        def write_register(register, value):
            i2c.writeto(address, bytes([register, value]))


        # -----------------------------
        # Identify sensor
        # -----------------------------

        chip_id = read_register(0x0D)[0]
        print("Chip ID:", hex(chip_id))

        settings = {
            0x1A: (2, 4096),  # MMA8451
            0x2A: (4, 1024),  # MMA8452
            0x3A: (6, 256),   # MMA8453
        }

        if chip_id not in settings:
            raise Exception("Unknown sensor ID: " + hex(chip_id))

        shift, counts_per_g = settings[chip_id]

        # -----------------------------
        # Configure sensor
        # -----------------------------

        write_register(0x2A, 0x00)  # Standby
        write_register(0x0E, 0x00)  # ±2g range
        write_register(0x2A, 0x01)  # Active

        # -----------------------------
        # Read acceleration
        # -----------------------------

        def read_acceleration():
            data = read_register(0x01, 6)
            values = []

            for i in range(0, 6, 2):
                raw = (data[i] << 8) | data[i + 1]

                if raw & 0x8000:
                    raw -= 65536

                values.append((raw >> shift) / counts_per_g)

            return values[0], values[1], values[2]


        # -----------------------------
        # Measure resting baseline
        # -----------------------------

        print("Calibrating—keep the sensor still")

        base_x = 0
        base_y = 0
        base_z = 0
        samples = 50

        for _ in range(samples):
            x, y, z = read_acceleration()

            base_x += x
            base_y += y
            base_z += z

            sleep(0.02)

        base_x /= samples
        base_y /= samples
        base_z /= samples

        print(
            "Baseline:",
            round(base_x, 2),
            round(base_y, 2),
            round(base_z, 2)
        )

        print("Ready")

        detect_loop(read_acceleration, (base_x, base_y, base_z), servo)
    finally:
        # Return to rest and release PWM even on Ctrl+C or a sensor error.
        try:
            set_servo(servo, SERVO_REST_US)
            sleep_ms(RETRACT_MS)
        finally:
            servo.deinit()


if __name__ == "__main__":
    run()
