# Shared local-preview server for the Paçoca platform (used by both
# scripts/unix/preview.sh and scripts/windows/preview.ps1). Serves the assembled
# preview directory on one origin, mirroring the production deploy layout:
#
#   /          -> site/            (landing page)
#   /play/     -> build/web/       (exported WASM game)
#   /editor/   -> tools/map_editor/ (visual editor)
#   /api/*     -> proxied to a local Worker (wrangler dev), default :8787
#
# Configuration comes from environment variables so the launcher scripts stay
# thin and platform-specific concerns (paths, links) live in the shell/ps1:
#   PREVIEW_DIR   directory to serve (assembled by the launcher)
#   PREVIEW_PORT  port to listen on            (default 8000)
#   PREVIEW_API   backend base URL for /api/*  (default http://localhost:8787)
import os, re, urllib.request, urllib.error
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

OUT = os.environ["PREVIEW_DIR"]
PORT = int(os.environ.get("PREVIEW_PORT", "8000"))
API = os.environ.get("PREVIEW_API", "http://localhost:8787").rstrip("/")


class Handler(SimpleHTTPRequestHandler):
    # Forward /api/* to the local Worker (wrangler dev) so same-origin fetches
    # (community feed, Publicar) work through this preview server.
    def _proxy(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(API + self.path, data=body, method=self.command)
        # Forward Cookie so the session (login) reaches the Worker; without this,
        # authenticated routes (publish, like, moderate) would all 401/403 locally.
        for h in ("Content-Type", "Accept", "Authorization", "Cookie"):
            if h in self.headers:
                req.add_header(h, self.headers[h])
        set_cookies = []
        try:
            with urllib.request.urlopen(req) as r:
                data, status, ctype = r.read(), r.status, r.headers.get("Content-Type", "application/json")
                set_cookies = r.headers.get_all("Set-Cookie") or []
        except urllib.error.HTTPError as e:
            data, status, ctype = e.read(), e.code, e.headers.get("Content-Type", "application/json")
            set_cookies = e.headers.get_all("Set-Cookie") or []
        except Exception:
            data = ('{"error":"API offline em %s — rode: cd backend && npm run dev"}' % API).encode()
            status, ctype = 502, "application/json"
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        # Relay Set-Cookie back so the browser stores the session cookie. Drop the
        # Secure attribute so it works over http://localhost.
        for c in set_cookies:
            self.send_header("Set-Cookie", c.replace("; Secure", "").replace("Secure; ", ""))
        self.end_headers()
        self.wfile.write(data)

    # Pretty level links /l/<id> (no extension) render the level page, mirroring
    # the Worker's rewrite in production. Real files under /l/ still resolve.
    def _maybe_level_path(self):
        p = self.path.split("?", 1)[0]
        return re.match(r"^/l/[^/.]+/?$", p) is not None

    # Cross-origin isolation for the threaded Godot build under /play/ so
    # SharedArrayBuffer is available — without it the multi-threaded WASM export
    # won't boot at all locally. Mirrors the Worker's headers for play/ in prod.
    def end_headers(self):
        p = self.path.split("?", 1)[0]
        if p == "/play" or p.startswith("/play/"):
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        if self._maybe_level_path():
            self.path = "/l/index.html"
        return super().do_GET()

    def do_HEAD(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        if self._maybe_level_path():
            self.path = "/l/index.html"
        return super().do_HEAD()

    def do_POST(self):
        return self._proxy() if self.path.startswith("/api/") else self.send_error(501)

    def do_DELETE(self):
        return self._proxy() if self.path.startswith("/api/") else self.send_error(501)

    def do_OPTIONS(self):
        return self._proxy() if self.path.startswith("/api/") else self.send_error(501)


ThreadingHTTPServer(("", PORT), partial(Handler, directory=OUT)).serve_forever()
