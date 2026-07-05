#!/usr/bin/env bash
# Local preview of the whole Paçoca platform (landing + game + editor) on one
# origin, mirroring the production deploy layout so every link works:
#
#   /          -> site/            (landing page)
#   /play/     -> build/web/       (exported WASM game)
#   /editor/   -> tools/map_editor/ (visual editor)
#   /api/*     -> proxied to a local Worker (wrangler dev), default :8787
#
# Static files are served directly; /api/* is forwarded to the community backend
# so Publicar and the community feed work locally too. Export the game first with
# ./tools/export_web.sh so build/web/ exists.
#
# To make /api work, run the Worker in another terminal:
#   cd backend && npm run db:local && npm run dev      # API on :8787
# Then here:
#   ./preview.sh              # http://localhost:8000  (proxies /api -> :8787)
#   ./preview.sh 9000         # custom port
#   API=http://localhost:8799 ./preview.sh             # custom backend URL
set -euo pipefail

PORT="${1:-8000}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$ROOT/build/preview"

# Assemble the sibling layout with symlinks (rebuilt each run).
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "$ROOT/site/." "$OUT/"
ln -s "$ROOT/tools/map_editor" "$OUT/editor"
if [ -d "$ROOT/build/web" ]; then
  ln -s "$ROOT/build/web" "$OUT/play"
else
  echo "!  build/web/ not found — run ./tools/export_web.sh first (Jogar/Testar will 404)."
fi

export PREVIEW_DIR="$OUT" PREVIEW_PORT="$PORT" PREVIEW_API="${API:-http://localhost:8787}"

echo "Paçoca preview em  http://localhost:$PORT"
echo "  /         landing"
echo "  /play/    jogo (WASM)"
echo "  /editor/  map editor  ->  desenhe e clique em Testar"
echo "  /api/*    -> $PREVIEW_API  (para Publicar/comunidade: cd backend && npm run db:local && npm run dev)"

exec python3 - <<'PY'
import os, urllib.request, urllib.error
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

OUT = os.environ["PREVIEW_DIR"]
PORT = int(os.environ["PREVIEW_PORT"])
API = os.environ["PREVIEW_API"].rstrip("/")

class Handler(SimpleHTTPRequestHandler):
    # Forward /api/* to the local Worker (wrangler dev) so same-origin fetches
    # (community feed, Publicar) work through this preview server.
    def _proxy(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(API + self.path, data=body, method=self.command)
        for h in ("Content-Type", "Accept", "Authorization"):
            if h in self.headers:
                req.add_header(h, self.headers[h])
        try:
            with urllib.request.urlopen(req) as r:
                data, status, ctype = r.read(), r.status, r.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            data, status, ctype = e.read(), e.code, e.headers.get("Content-Type", "application/json")
        except Exception:
            data = ('{"error":"API offline em %s — rode: cd backend && npm run dev"}' % API).encode()
            status, ctype = 502, "application/json"
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        return super().do_GET()

    def do_HEAD(self):
        if self.path.startswith("/api/"):
            return self._proxy()
        return super().do_HEAD()

    def do_POST(self):
        return self._proxy() if self.path.startswith("/api/") else self.send_error(501)

    def do_OPTIONS(self):
        return self._proxy() if self.path.startswith("/api/") else self.send_error(501)

ThreadingHTTPServer(("", PORT), partial(Handler, directory=OUT)).serve_forever()
PY
