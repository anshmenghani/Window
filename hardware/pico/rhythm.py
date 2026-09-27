from math import sqrt


class Detector:
    def __init__(self, baseline, config, ticks_diff):
        self.baseline = baseline
        self.diff = ticks_diff
        self.threshold = config.get("threshold_g", 0.25)
        self.cooldown = config.get("cooldown_ms", 300)
        self.gap = config.get("sequence_gap_ms", 900)
        self.maximum = config.get("max_knocks", 12)
        if not (0 < self.cooldown < self.gap <= 10000 and 1 <= self.maximum <= 20):
            raise ValueError("Use 0 < cooldown < sequence gap <= 10000 and max_knocks 1..20")
        self.last_trigger = None
        self.pattern = []
        self.last_tap = None

    def clear(self):
        self.pattern = []
        self.last_tap = None
        self.last_trigger = None

    def update(self, xyz, now):
        ready = None
        # Finish an old sequence before considering a new tap at this sample.
        if self.pattern and self.diff(now, self.last_tap) >= self.gap:
            ready, self.pattern = self.pattern, []
        impact = sqrt(sum((xyz[i] - self.baseline[i]) ** 2 for i in range(3)))
        if impact >= self.threshold and (self.last_trigger is None or
                                        self.diff(now, self.last_trigger) >= self.cooldown):
            delay = 0 if not self.pattern else self.diff(now, self.last_tap)
            # The server accepts at most 30 seconds per sequence.
            if self.pattern and sum(self.pattern) + delay > 30000:
                ready, self.pattern = self.pattern, []
                delay = 0
            self.pattern.append(delay)
            self.last_tap = self.last_trigger = now
            if len(self.pattern) >= self.maximum:
                # With max=1, an expired previous sequence cannot still be pending.
                ready, self.pattern = self.pattern, []
        return ready
