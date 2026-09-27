import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from supabase_client import WindowAPI


class NetworkPlaybackTests(unittest.TestCase):
    def setUp(self):
        fake_time = types.SimpleNamespace(ticks_ms=lambda: 1000, ticks_diff=lambda a,b: a-b, sleep_ms=lambda _: None)
        self.sensor = Mock()
        self.sensor.calibrate.return_value = (0, 0, 1)
        path = Path(__file__).resolve().parents[1] / 'window_server.py'
        spec = importlib.util.spec_from_file_location('network_playback_test', path)
        self.fw = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'time': fake_time, 'network': Mock()}):
            spec.loader.exec_module(self.fw)

    def test_incoming_gaps_and_strength(self):
        self.assertEqual(self.fw.prepare_event({'id': 7, 'intervals_ms': [0,300,700], 'impacts_g': [.3,.8,1.5]}),
                         {'id': 7, 'offsets': [0,300,1000], 'impacts_g': [.3,.8,1.5]})
        self.assertIsNone(self.fw.prepare_event({'id': 8, 'intervals_ms': [0]})['impacts_g'])

    def test_malformed_event_rejected(self):
        for fields in ({'intervals_ms': [1]}, {'impacts_g': []}, {'impacts_g': [float('nan')]},
                       {'intervals_ms': [0,-1]}, {'intervals_ms': [0,10001]}, {'id': -1}):
            event = {'id': 1, 'intervals_ms': [0], 'impacts_g': [.5]}
            event.update(fields)
            with self.assertRaises(ValueError):
                self.fw.prepare_event(event)

    def test_playback_acknowledged_without_sampling_or_echo(self):
        recorder, servo, light = Mock(), Mock(), Mock()
        defaults = {'sensor': {}, 'detection': {}, 'rgb_led': {}}
        knocker = Mock()
        knocker.hardware_config.return_value = defaults
        knocker.TimeLight.return_value = light
        knocker.PWM.return_value = servo
        knocker.KnockRecorder.return_value = recorder
        event = {'id': 9, 'offsets': [0,300], 'impacts_g': [.3,1.5]}
        self.fw.shared['incoming'] = event
        self.fw.shared['receive_cursor'] = 8

        def play(*args):
            self.assertEqual(self.fw.shared['receive_cursor'], 8)
            self.assertEqual(args[1:3], ([0,300], [.3,1.5]))
            self.fw.shared['running'] = False
        knocker.play_knocks.side_effect = play
        knocker.Sensor.return_value = self.sensor
        with patch.dict(sys.modules, {'knocker': knocker}), patch('builtins.print'):
            self.fw.capture({})
        self.assertIsNone(self.fw.shared['sensor_error'])
        self.assertEqual(self.fw.shared['receive_cursor'], 9)
        self.assertIsNone(self.fw.shared['incoming'])
        self.assertEqual(self.fw.shared['queue'], [])
        self.sensor.read.assert_not_called()
        self.assertEqual(recorder.clear.call_count, 2)
        servo.deinit.assert_called_once()
        light.close.assert_called_once()

    def test_strength_upload_and_receive_use_new_endpoints(self):
        api = WindowAPI.__new__(WindowAPI)
        api.rpc = Mock(return_value={'id': 1})
        api.send('a'*32, [0,300], [.3,1.5])
        api.rpc.assert_called_with('window_pico_send_knock_with_strength',
                                   {'p_request_id': 'a'*32, 'p_intervals_ms': [0,300], 'p_impacts_g': [.3,1.5]})
        api.receive(None)
        api.rpc.assert_called_with('window_pico_get_knocks', {'p_after_id': None})


if __name__ == '__main__':
    unittest.main()
