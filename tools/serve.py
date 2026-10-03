#!/usr/bin/env python3
"""Static file server for web/ that tells the browser never to cache, so a
reload always picks up edited modules.

Usage:  python tools/serve.py [port]
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(BASE, "web")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print("serving %s on http://localhost:%d" % (ROOT, port))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
