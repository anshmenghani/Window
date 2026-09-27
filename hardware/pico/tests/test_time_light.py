import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from time_light import TimeLight, color_for_hour


def diff(a, b):
    return ((a - b + (1 << 29)) % (1 << 30)) - (1 << 29)


class LightTests(unittest.TestCase):
    def setUp(self):
        self.channels = []
        channels = self.channels

        class PWM:
            def __init__(self, state_machine, pin, duty_u16):
                self.pin, self.state_machine, self.duty = pin, state_machine, duty_u16
                self.closed = False
                channels.append(self)
            def duty_u16(self, value):
                self.duty = value
            def deinit(self):
                self.closed = True

        self.hardware = patch.dict(sys.modules, {'led_pwm': types.SimpleNamespace(PIOPWM=PWM)})
        self.hardware.start()
        self.addCleanup(self.hardware.stop)

    def make(self, **extra):
        config = dict(enabled=True, red_pin=11, green_pin=12, blue_pin=13,
                      brightness=1.0, common='cathode')
        config.update(extra)
        return TimeLight(config, {'sda': 18, 'scl': 19}, diff)

    def test_color_anchors_and_interpolation(self):
        self.assertEqual(color_for_hour(7), (1.0, 0.2, 0.03))
        self.assertEqual(color_for_hour(24), color_for_hour(0))
        for actual, expected in zip(color_for_hour(8), (0.675, 0.375, 0.515)):
            self.assertAlmostEqual(actual, expected)

    def test_unknown_time_keeps_led_off(self):
        light = self.make()
        light.update(0, None)
        self.assertEqual([c.duty for c in self.channels], [0, 0, 0])

    def test_polarity_brightness_and_shutdown(self):
        for common in ('anode', 'cathode'):
            self.channels.clear()
            light = self.make(common=common, brightness=0.5)
            light.update(0, (7.0, 0))
            expected = [int(c * 0.5 * 65535) for c in (1, 0.2, 0.03)]
            if common == 'anode':
                expected = [65535 - c for c in expected]
            self.assertEqual([c.duty for c in self.channels], expected)
            light.close()
            self.assertTrue(all(c.closed for c in self.channels))
            self.assertTrue(all(c.duty == (65535 if common == 'anode' else 0) for c in self.channels))

    def test_offline_clock_crosses_midnight_and_tick_wrap(self):
        light = self.make()
        start = (1 << 30) - 500
        snapshot = (23.9999, start)
        light.update(start, snapshot)
        light.update(500, snapshot)
        self.assertAlmostEqual(light.hour, (23.9999 + 1 / 3600) % 24)
        light.update(1500, snapshot)
        self.assertAlmostEqual(light.hour, (23.9999 + 2 / 3600) % 24)

    def test_new_server_time_corrects_clock(self):
        light = self.make()
        light.update(0, (7, 0))
        light.update(30000, (18.5, 30000))
        self.assertEqual(light.hour, 18.5)
        self.assertEqual([c.duty for c in self.channels], [int(c * 65535) for c in (1, 0.28, 0.02)])

    def test_conflicting_or_missing_pins_rejected(self):
        for overrides in ({'red_pin': 18}, {'red_pin': 28}, {'red_pin': 12},
                          {'red_pin': None}, {'red_pin': 23},
                          {'common': 'unknown'}, {'brightness': 2}):
            with self.assertRaises(ValueError):
                self.make(**overrides)
        self.assertEqual(self.channels, [])

    def test_disabled_light_never_touches_gpio(self):
        light = TimeLight({}, {}, diff)
        light.update(0, (7, 0))
        light.close()
        self.assertEqual(self.channels, [])


if __name__ == '__main__':
    unittest.main()
