import hashlib
import json
import socket
import ssl
import binascii

MAX_BODY = 8192


def read_exact(stream, size):
    data = b""
    while len(data) < size:
        part = stream.read(size - len(data))
        if not part:
            raise OSError("Truncated HTTP response")
        data += part
    return data


def read_response(stream):
    status = stream.readline().split()
    if len(status) < 2:
        raise OSError("Invalid HTTP status")
    code = int(status[1])
    headers = {}
    header_bytes = 0
    while True:
        line = stream.readline()
        header_bytes += len(line)
        if not line or header_bytes > MAX_BODY:
            raise OSError("Invalid HTTP headers")
        if line == b"\r\n":
            break
        key, value = line.split(b":", 1)
        headers[key.lower()] = value.strip().lower()
    if headers.get(b"transfer-encoding") == b"chunked":
        body = b""
        while True:
            size = int(stream.readline().split(b";", 1)[0].strip(), 16)
            if size == 0:
                break  # Connection is closed by caller; trailers aren't needed.
            if size < 0 or len(body) + size > MAX_BODY:
                raise OSError("HTTP body too large")
            body += read_exact(stream, size)
            if read_exact(stream, 2) != b"\r\n":
                raise OSError("Invalid HTTP chunk")
    elif b"content-length" in headers:
        size = int(headers[b"content-length"])
        if not 0 <= size <= MAX_BODY:
            raise OSError("HTTP body too large")
        body = read_exact(stream, size)
    else:
        body = b""
        while True:
            chunk = stream.read(256)
            if not chunk:
                break
            body += chunk
            if len(body) > MAX_BODY:
                raise OSError("HTTP body too large")
    if not 200 <= code < 300:
        # Do not print a response that could echo credentials.
        raise OSError("Supabase HTTP %d; check setup, credentials and SQL migrations" % code)
    result = json.loads(body)
    if not isinstance(result, dict):
        raise ValueError("Unexpected RPC result")
    return result


class WindowAPI:
    def __init__(self, config):
        url = config["supabase_url"].rstrip("/")
        if not url.startswith("https://"):
            raise ValueError("Supabase URL must use HTTPS")
        self.host = url[8:]
        if not self.host or any(c in self.host for c in "/:@\r\n "):
            raise ValueError("Use the project HTTPS URL without a path or port")
        self.key = config["supabase_publishable_key"]
        if "\r" in self.key or "\n" in self.key:
            raise ValueError("Invalid publishable key")
        self.params = {"p_pair_id": config["pair_id"],
                       "p_pair_secret": config["pair_secret"],
                       "p_side": config["side"].upper()}
        if self.params["p_side"] not in ("A", "B"):
            raise ValueError("side must be A or B")
        with open("tls_pin.json") as f:
            pin = json.load(f)
        if pin["host"] != self.host or len(pin["sha256"]) != 64:
            raise ValueError("Run provision.py for this Supabase project")
        self.fingerprint = pin["sha256"].lower()

    def rpc(self, name, extra=None):
        params = self.params.copy()
        params.update(extra or {})
        body = json.dumps(params).encode()
        address = socket.getaddrinfo(self.host, 443, 0, socket.SOCK_STREAM)[0]
        raw = socket.socket(address[0], socket.SOCK_STREAM, address[2])
        conn = None
        try:
            raw.settimeout(10)
            raw.connect(address[-1])
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            # MicroPython's mbedTLS port exposes certificates through this
            # callback, not CPython's getpeercert(). OPTIONAL permits a pin
            # instead of a CA store; the explicit check below must still pass.
            seen = []

            def inspect_certificate(certificate, depth):
                if depth == 0:
                    seen.append(binascii.hexlify(hashlib.sha256(certificate).digest()).decode())
                return 0

            context.verify_mode = ssl.CERT_OPTIONAL
            context.verify_callback = inspect_certificate
            conn = context.wrap_socket(raw, server_hostname=self.host)
            if seen != [self.fingerprint]:
                raise OSError("TLS certificate changed; rerun provision.py and upload tls_pin.json")
            request = ("POST /rest/v1/rpc/%s HTTP/1.1\r\nHost: %s\r\n"
                       "apikey: %s\r\nContent-Type: application/json\r\n"
                       "Content-Length: %d\r\nConnection: close\r\n\r\n" %
                       (name, self.host, self.key, len(body))).encode() + body
            remaining = memoryview(request)
            while len(remaining):
                written = conn.write(remaining)
                if not written:
                    raise OSError("HTTP write failed")
                remaining = remaining[written:]
            return read_response(conn)
        finally:
            if conn is not None:
                conn.close()
            else:
                raw.close()

    def send(self, request_id, pattern, impacts=None):
        if impacts is None:
            return self.rpc("window_pico_send_knock", {
                "p_request_id": request_id, "p_intervals_ms": pattern})
        return self.rpc("window_pico_send_knock_with_strength", {
            "p_request_id": request_id, "p_intervals_ms": pattern,
            "p_impacts_g": impacts})

    def receive(self, after_id):
        return self.rpc("window_pico_get_knocks", {"p_after_id": after_id})

    def heartbeat(self, include_time=False):
        return self.rpc("window_pico_get_partner" if include_time else "window_get_partner")
