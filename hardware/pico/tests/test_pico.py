import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, mock_open, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rhythm import Detector
import api_client


def ticks_diff(a, b):
    return ((a - b + (1 << 29)) % (1 << 30)) - (1 << 29)


class RhythmTests(unittest.TestCase):
    def make(self, **config):
        return Detector([0, 0, 1], config, ticks_diff)

    def test_grouping_and_cooldown(self):
        d = self.make()
        for time in (0, 100, 400, 1000):
            self.assertIsNone(d.update([0.5, 0, 1], time))
        self.assertEqual(d.update([0, 0, 1], 1900), [0, 400, 600])
        self.assertIsNone(d.update([0, 0, 1], 3000))

    def test_tick_wrap(self):
        d = self.make()
        d.update([0.5, 0, 1], (1 << 30) - 200)
        d.update([0.5, 0, 1], 200)
        self.assertEqual(d.update([0, 0, 1], 1100), [0, 400])

    def test_new_tap_after_gap_starts_next_pattern(self):
        d = self.make()
        d.update([0.5, 0, 1], 0)
        self.assertEqual(d.update([0.5, 0, 1], 1000), [0])
        self.assertEqual(d.update([0, 0, 1], 1900), [0])

    def test_maximum_taps(self):
        d = self.make(max_knocks=2)
        d.update([0.5, 0, 1], 0)
        self.assertEqual(d.update([0.5, 0, 1], 400), [0, 400])
        self.assertIsNone(d.update([0, 0, 1], 1500))

    def test_duration_limit(self):
        d = self.make(sequence_gap_ms=10000, max_knocks=20)
        for time in (0, 9000, 18000, 27000):
            self.assertIsNone(d.update([0.5, 0, 1], time))
        self.assertEqual(d.update([0.5, 0, 1], 36000), [0, 9000, 9000, 9000])
        self.assertEqual(d.update([0, 0, 1], 46000), [0])

    def test_bad_config(self):
        for config in ({"max_knocks": 21}, {"cooldown_ms": 900}, {"sequence_gap_ms": 10001}):
            with self.assertRaises(ValueError):
                self.make(**config)


class HttpTests(unittest.TestCase):
    def test_content_length(self):
        self.assertEqual(api_client.read_response(io.BytesIO(
            b'HTTP/1.1 200 OK\r\nContent-Length: 8\r\n\r\n{"id":1}')), {"id": 1})

    def test_chunked(self):
        self.assertEqual(api_client.read_response(io.BytesIO(
            b'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n'
            b'4\r\n{"id\r\n4\r\n":1}\r\n0\r\n\r\n')), {"id": 1})

    def test_truncated_and_large_responses(self):
        for response in (b'HTTP/1.1 200 OK\r\nContent-Length: 8\r\n\r\n{',
                         b'HTTP/1.1 200 OK\r\nContent-Length: 9000\r\n\r\n'):
            with self.assertRaises(OSError):
                api_client.read_response(io.BytesIO(response))

    def test_error_does_not_echo_body(self):
        with self.assertRaises(OSError) as caught:
            api_client.read_response(io.BytesIO(
                b'HTTP/1.1 403 Forbidden\r\nContent-Length: 6\r\n\r\nsecret'))
        self.assertNotIn('secret', str(caught.exception))

    def test_pin_checked_before_credentials_and_socket_closed(self):
        for certificate, expected_writes in ((b'trusted', True), (b'impostor', False)):
            stream = io.BytesIO(b'HTTP/1.1 200 OK\r\nContent-Length: 8\r\n\r\n{"id":1}')

            class Connection:
                written = b''
                closed = False
                def write(self, data):
                    part = bytes(data[:13])  # Exercise partial writes.
                    self.written += part
                    return len(part)
                def read(self, n): return stream.read(n)
                def readline(self): return stream.readline()
                def close(self): self.closed = True
                def settimeout(self, timeout): pass
                def connect(self, address): pass

            conn = Connection()

            class Context:
                def __init__(self, protocol): pass
                def wrap_socket(self, raw, server_hostname):
                    self.verify_callback(certificate, 0)
                    return conn

            api = api_client.WindowAPI.__new__(api_client.WindowAPI)
            api.host, api.key = 'test.supabase.co', 'public-key'
            api.params = {'p_pair_secret': 'private-secret'}
            api.fingerprint = hashlib.sha256(b'trusted').hexdigest()
            with patch.object(api_client.socket, 'getaddrinfo', return_value=[(2, 1, 6, '', ('host', 443))]), \
                 patch.object(api_client.socket, 'socket', return_value=conn), \
                 patch.object(api_client.ssl, 'SSLContext', Context):
                if expected_writes:
                    self.assertEqual(api.send('a' * 32, [0, 400]), {'id': 1})
                    body = json.loads(conn.written.split(b'\r\n\r\n')[1])
                    self.assertEqual(body['p_intervals_ms'], [0, 400])
                    self.assertEqual(body['p_request_id'], 'a' * 32)
                else:
                    with self.assertRaises(OSError):
                        api.send('a' * 32, [0])
                    self.assertEqual(conn.written, b'')
            self.assertTrue(conn.closed)


class UploadLoopTests(unittest.TestCase):
    def exercise(self, send_results, age=0, light_enabled=False, incoming=None, pending=False):
        """Run the real upload loop with a fake radio and no physical thread."""
        fake_time = types.SimpleNamespace(ticks_ms=lambda: 5000, ticks_diff=ticks_diff,
                                          sleep_ms=lambda _: None)
        wlan = Mock()
        wlan.isconnected.return_value = True
        fake_network = types.SimpleNamespace(STA_IF=0, WLAN=lambda _: wlan)
        fake_sensor = types.SimpleNamespace(Sensor=Mock())
        path = Path(__file__).resolve().parents[1] / 'knocker_supabase.py'
        spec = importlib.util.spec_from_file_location('pico_main_test', path)
        firmware = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'time': fake_time, 'network': fake_network, 'sensor': fake_sensor}):
            spec.loader.exec_module(firmware)
        api = Mock()
        api.send.side_effect = send_results
        api.heartbeat.return_value = {'timezone': 'UTC', 'local_hour': 7.5}
        api.receive.return_value = {'cursor': 8 if incoming else 0, 'events': [incoming] if incoming else []}
        entry = {'id': 'b' * 32, 'pattern': [0, 400], 'impacts': [0.3, 1.5], 'created': 5000 - age}
        firmware.shared['queue'].append(entry)
        firmware.shared['sensor_done'] = True
        if incoming:
            firmware.shared['receive_cursor'] = 7
        if pending:
            firmware.shared['incoming'] = {'id': 6, 'offsets': [0], 'impacts_g': None}
        config = {key: 'test' for key in ('wifi_ssid', 'wifi_password', 'supabase_url',
                                        'supabase_publishable_key', 'pair_id', 'pair_secret', 'side')}
        config['rgb_led'] = {'enabled': light_enabled}

        def sleep(ms):
            if ms == 100:  # One successful loop (retries sleep for 3000 ms).
                raise KeyboardInterrupt()

        with patch('builtins.open', mock_open(read_data=json.dumps(config))), \
             patch.object(firmware, 'WindowAPI', return_value=api), \
             patch.object(firmware._thread, 'start_new_thread'), \
             patch.object(firmware, 'sleep_ms', side_effect=sleep), \
             patch('builtins.print'):
            with self.assertRaises(KeyboardInterrupt):
                firmware.run()
        self.assertEqual(firmware.shared['queue'], [])
        self.assertFalse(firmware.shared['running'])
        wlan.disconnect.assert_called_once()
        api.heartbeat.assert_called_once_with(include_time=light_enabled)
        self.assertEqual(firmware.shared['partner_clock'], (7.5, 5000) if light_enabled else None)
        if incoming:
            self.assertEqual(firmware.shared['receive_cursor'], 7)
            self.assertEqual(firmware.shared['incoming'], {'id': 8, 'offsets': [0,300,1000], 'impacts_g': [.3,.8,1.5]})
        if pending:
            api.receive.assert_not_called()
        return api

    def test_timeout_retries_same_request_id_and_pattern(self):
        api = self.exercise([OSError('timeout after server accepted request'), {'id': 123}])
        self.assertEqual(api.send.call_count, 2)
        self.assertEqual(api.send.call_args_list[0], api.send.call_args_list[1])
        self.assertEqual(api.send.call_args.args, ('b' * 32, [0, 400], [0.3, 1.5]))

    def test_expired_knock_is_not_uploaded(self):
        api = self.exercise([], age=61000)
        api.send.assert_not_called()

    def test_paused_match_is_acknowledged_without_retry(self):
        api = self.exercise([{'id': None}])
        api.send.assert_called_once()

    def test_heartbeat_passes_partner_time_to_light(self):
        self.exercise([{'id': 123}], light_enabled=True)

    def test_received_knock_waits_for_playback_before_advancing_cursor(self):
        self.exercise([{'id': 123}], incoming={'id': 8, 'intervals_ms': [0,300,700], 'impacts_g': [.3,.8,1.5]})

    def test_pending_playback_is_not_fetched_again(self):
        self.exercise([{'id': 123}], pending=True)


if __name__ == '__main__':
    unittest.main()
