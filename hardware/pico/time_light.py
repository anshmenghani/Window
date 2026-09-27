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
        from led_pwm import PIOPWM
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
