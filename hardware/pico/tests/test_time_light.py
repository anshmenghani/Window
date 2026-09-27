import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


def diff(a, b):
    return ((a - b + (1 << 29)) % (1 << 30)) - (1 << 29)


class LightTests(unittest.TestCase):
    def setUp(self):
        class StateMachine:
            def __init__(self, index, program, freq, sideset_base):
                self.pin = sideset_base
                self.enabled = False
            def put(self, value):
                pass
            def exec(self, command):
                pass
            def active(self, value):
                self.enabled = bool(value)

        fake_rp2 = types.SimpleNamespace(
            PIO=types.SimpleNamespace(OUT_LOW=0),
            StateMachine=StateMachine,
            asm_pio=lambda **_: lambda fn: fn,
        )
        fake_machine = types.SimpleNamespace(
            Pin=lambda pin: pin,
            SoftI2C=object,
            PWM=object,
        )
        fake_time = types.SimpleNamespace(
            sleep=lambda _: None,
            sleep_ms=lambda _: None,
            ticks_ms=lambda: 0,
            ticks_diff=diff,
        )
        path = Path(__file__).resolve().parents[1] / 'knocker.py'
        spec = importlib.util.spec_from_file_location('knocker_light_test', path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {
            'machine': fake_machine,
            'rp2': fake_rp2,
            'time': fake_time,
        }):
            spec.loader.exec_module(module)
        self.TimeLight = module.TimeLight
        self.color_for_hour = module.color_for_hour

    def make(self, **extra):
        config = dict(enabled=True, red_pin=11, green_pin=12, blue_pin=13,
                      brightness=1.0, common='cathode')
        config.update(extra)
        return self.TimeLight(config, {'sda': 18, 'scl': 19}, diff)

    def test_color_anchors_and_interpolation(self):
        self.assertEqual(self.color_for_hour(7), (1.0, 0.2, 0.03))
        self.assertEqual(self.color_for_hour(24), self.color_for_hour(0))
        for actual, expected in zip(self.color_for_hour(8), (0.675, 0.375, 0.515)):
            self.assertAlmostEqual(actual, expected)

    def test_unknown_time_keeps_led_off(self):
        light = self.make()
        light.update(0, None)
        self.assertEqual([c.last_duty for c in light.channels], [0, 0, 0])

    def test_polarity_brightness_and_shutdown(self):
        for common in ('anode', 'cathode'):
            light = self.make(common=common, brightness=0.5)
            light.update(0, (7.0, 0))
            expected = [int(c * 0.5 * 65535) for c in (1, 0.2, 0.03)]
            if common == 'anode':
                expected = [65535 - c for c in expected]
            self.assertEqual([c.last_duty for c in light.channels], expected)
            channels = list(light.channels)
            light.close()
            self.assertTrue(all(not c.sm.enabled for c in channels))
            self.assertTrue(all(c.last_duty == (65535 if common == 'anode' else 0) for c in channels))

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
        self.assertEqual([c.last_duty for c in light.channels], [int(c * 65535) for c in (1, 0.28, 0.02)])

    def test_conflicting_or_missing_pins_rejected(self):
        for overrides in ({'red_pin': 18}, {'red_pin': 28}, {'red_pin': 12},
                          {'red_pin': None}, {'red_pin': 23},
                          {'common': 'unknown'}, {'brightness': 2}):
            with self.assertRaises(ValueError):
                self.make(**overrides)

    def test_disabled_light_never_touches_gpio(self):
        light = self.TimeLight({}, {}, diff)
        light.update(0, (7, 0))
        light.close()
        self.assertEqual(light.channels, [])


if __name__ == '__main__':
    unittest.main()
