import argparse
import hashlib
import json
from pathlib import Path
import socket
import ssl
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser(description="Pin a CA-verified Supabase TLS certificate for a Pico")
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("tls_pin.json"))
    args = parser.parse_args()
    url = urlparse(args.url)
    if (url.scheme != "https" or not url.hostname or url.port not in (None, 443)
            or url.username or url.password or url.path not in ("", "/") or url.query or url.fragment):
        parser.error("Use your Supabase project HTTPS URL without a path")
    context = ssl.create_default_context()
    with socket.create_connection((url.hostname, 443), timeout=15) as sock:
        with context.wrap_socket(sock, server_hostname=url.hostname) as conn:
            cert = conn.getpeercert(binary_form=True)
            expires = conn.getpeercert().get("notAfter")
    args.output.write_text(json.dumps({"host": url.hostname,
                                      "sha256": hashlib.sha256(cert).hexdigest(),
                                      "expires": expires}, indent=2) + "\n")
    print("Saved", args.output, "— certificate expires", expires)
    print("Upload tls_pin.json to the Pico. Refresh it if the server certificate changes.")


if __name__ == "__main__":
    main()
