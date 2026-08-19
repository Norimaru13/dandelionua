#!/usr/bin/env python3
"""Local site + counters. From the project folder: python server.py"""

import json
import threading
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "stats.json"
COOKIE = "dandelion_visitor"
LOCK = threading.Lock()
HOST = "127.0.0.1"
PORT = 8080


def load_stats():
    if not DATA_FILE.exists():
        return {}
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_stats(stats):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")


def page_state(stats, page, visitor):
    entry = stats.setdefault(page, {"views": 0, "likes": 0, "viewers": [], "likers": []})
    return {
        "views": entry["views"],
        "likes": entry["likes"],
        "liked": visitor in entry["likers"],
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _visitor(self):
        header = self.headers.get("X-Visitor-Id", "").strip()
        if header:
            return header
        raw = self.headers.get("Cookie", "")
        for part in raw.split(";"):
            if "=" in part:
                key, value = part.strip().split("=", 1)
                if key == COOKIE and value:
                    return value
        return str(uuid.uuid4())

    def _send_json(self, payload, visitor):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Set-Cookie", f"{COOKIE}={visitor}; Path=/; SameSite=Lax")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/stats":
            page = (parse_qs(parsed.query).get("page") or [""])[0].strip()
            visitor = self._visitor()
            if not page:
                self.send_error(400)
                return
            with LOCK:
                stats = load_stats()
                payload = page_state(stats, page, visitor)
            self._send_json(payload, visitor)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        visitor = self._visitor()
        data = self._read_json()
        page = str(data.get("page") or "").strip()
        if parsed.path not in ("/api/view", "/api/like") or not page:
            self.send_error(400)
            return

        with LOCK:
            stats = load_stats()
            entry = stats.setdefault(page, {"views": 0, "likes": 0, "viewers": [], "likers": []})

            if parsed.path == "/api/view":
                if visitor not in entry["viewers"]:
                    entry["viewers"].append(visitor)
                    entry["views"] += 1
            else:
                if visitor in entry["likers"]:
                    entry["likers"].remove(visitor)
                    entry["likes"] = max(0, entry["likes"] - 1)
                else:
                    entry["likers"].append(visitor)
                    entry["likes"] += 1

            save_stats(stats)
            payload = page_state(stats, page, visitor)

        self._send_json(payload, visitor)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        save_stats({})
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"http://{HOST}:{PORT}/")
    server.serve_forever()
