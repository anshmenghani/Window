import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch


class DriverTests(unittest.TestCase):
    def setUp(self):
        class StateMachine:
            def __init__(self, index, program, freq, sideset_base):
                self.index, self.pin = index, sideset_base
                self.commands, self.values = [], []
                self.enabled = False
            def put(self, value):
                self.values.append(value)
            def exec(self, command):
                self.commands.append(command)
            def active(self, value):
                self.enabled = bool(value)

        rp2 = types.SimpleNamespace(PIO=types.SimpleNamespace(OUT_LOW=0),
                                    StateMachine=StateMachine,
                                    asm_pio=lambda **_: lambda fn: fn)
        path = Path(__file__).resolve().parents[1] / 'led_pwm.py'
        spec = importlib.util.spec_from_file_location('led_pwm_test', path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'machine': types.SimpleNamespace(Pin=lambda p: p), 'rp2': rp2}):
            spec.loader.exec_module(module)
        self.driver = module.PIOPWM

    def test_anode_off_is_constant_high(self):
        led = self.driver(1, 12, 65535)
        self.assertEqual(led.sm.pin, 12)
        self.assertFalse(led.sm.enabled)
        self.assertEqual(led.sm.commands[-1], 'nop().side(1)')

    def test_partial_brightness_starts_pio_and_off_stops_it(self):
        led = self.driver(0, 11, 0)
        led.duty_u16(32768)
        self.assertTrue(led.sm.enabled)
        self.assertEqual(led.sm.values[-1], 127)
        count = len(led.sm.values)
        led.duty_u16(32768)
        self.assertEqual(len(led.sm.values), count)
        led.duty_u16(0)
        self.assertFalse(led.sm.enabled)
        self.assertEqual(led.sm.commands[-1], 'nop().side(0)')
        led.duty_u16(20000)
        self.assertTrue(led.sm.enabled)
        led.deinit()
        self.assertFalse(led.sm.enabled)


if __name__ == '__main__':
    unittest.main()
