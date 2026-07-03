#!/usr/bin/env python3
"""Tiny webhook receiver for testing wazuh-notify.py."""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG_FILE = "/tmp/wazuh-webhook.log"


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8", errors="ignore")
        entry = {"path": self.path, "body": json.loads(body) if body else None}
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, indent=2) + "\n---\n")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Webhook receiver listening on 0.0.0.0:{port}/webhook")
    server.serve_forever()
