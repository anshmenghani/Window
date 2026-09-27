"""Desktop checks for the standalone local servo playback script."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch


class PlaybackTests(unittest.TestCase):
    def setUp(self):
        self.clock = 0
        self.moves = []
        fake_time = types.SimpleNamespace(
            sleep=lambda seconds: self.advance(int(seconds * 1000)),
            sleep_ms=self.advance,
            ticks_ms=lambda: self.clock % (1 << 30),
            ticks_diff=lambda a, b: ((a - b + (1 << 29)) % (1 << 30)) - (1 << 29))
        fake_machine = types.SimpleNamespace(Pin=object, SoftI2C=object, PWM=object)
        path = Path(__file__).resolve().parents[1] / 'knocker_local.py'
        spec = importlib.util.spec_from_file_location('knocker_test', path)
        self.module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'machine': fake_machine, 'time': fake_time}):
            spec.loader.exec_module(self.module)
        self.servo = types.SimpleNamespace(duty_ns=lambda value: self.moves.append((self.clock, value)))

    def advance(self, ms):
        self.clock += ms

    def test_playback_preserves_onset_intervals_across_tick_wrap(self):
        self.clock = (1 << 30) - 50
        start = self.clock
        with patch('builtins.print'):
            self.module.play_knocks(self.servo, [0, 200, 600])
        strikes = [t - start for t, pulse in self.moves
                   if pulse == self.module.SERVO_STRIKE_US * 1000]
        self.assertEqual(strikes, [0, 200, 600])
        self.assertEqual(self.moves[-1][1], self.module.SERVO_REST_US * 1000)

    def test_detection_waits_for_silence_and_ignores_playback(self):
        samples = []

        class Done(Exception):
            pass

        def read():
            if self.moves:
                raise Done()
            samples.append(self.clock)
            return (0.5 if self.clock in (0, 100, 200) else 0, 0, 1)

        with patch('builtins.print'), self.assertRaises(Done):
            self.module.detect_loop(read, (0, 0, 1), self.servo)
        strikes = [t for t, pulse in self.moves if pulse != self.module.SERVO_REST_US * 1000]
        self.assertEqual(strikes, [1700, 1900])
        self.assertLess(max(samples), 1700)
        self.assertEqual(self.clock, 1900 + 80 + 120 + 500)

    def test_recorded_uneven_gaps_are_replayed(self):
        class Done(Exception):
            pass

        def read():
            if self.moves:
                raise Done()
            return (0.5 if self.clock in (0, 300, 1000) else 0, 0, 1)

        with patch('builtins.print'), self.assertRaises(Done):
            self.module.detect_loop(read, (0, 0, 1), self.servo)
        strikes = [t for t, pulse in self.moves if pulse != self.module.SERVO_REST_US * 1000]
        self.assertEqual(strikes, [2500, 2800, 3500])
        self.assertEqual([b - a for a, b in zip(strikes, strikes[1:])], [300, 700])

    def test_strength_mapping_is_bounded(self):
        m = self.module
        self.assertEqual(m.strike_for_impact(0), m.SERVO_STRIKE_US)
        self.assertLess(m.strike_for_impact(0.5), m.strike_for_impact(1.0))
        self.assertEqual(m.strike_for_impact(20), m.SERVO_HARD_STRIKE_US)

    def test_impact_peak_controls_each_strike_without_changing_gaps(self):
        class Done(Exception):
            pass

        def read():
            if self.moves:
                raise Done()
            # The second impact peaks AFTER first crossing the threshold.
            impacts = {0: 0.25, 300: 0.3, 320: 1.5}
            return (impacts.get(self.clock, 0), 0, 1)

        with patch('builtins.print'), self.assertRaises(Done):
            self.module.detect_loop(read, (0, 0, 1), self.servo)
        strikes = [(t, pulse) for t, pulse in self.moves
                   if pulse != self.module.SERVO_REST_US * 1000]
        self.assertEqual(strikes, [(1800, 1750000), (2100, 1950000)])

    def test_interrupt_retracts_servo(self):
        with patch.object(self.module, 'sleep_ms', side_effect=KeyboardInterrupt), \
             patch('builtins.print'), self.assertRaises(KeyboardInterrupt):
            self.module.play_knocks(self.servo, [0])
        self.assertEqual(self.moves[-1][1], self.module.SERVO_REST_US * 1000)


if __name__ == '__main__':
    unittest.main()
