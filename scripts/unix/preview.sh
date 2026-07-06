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
# scripts/unix/export_web.sh so build/web/ exists.
#
# To make /api work, run the Worker in another terminal:
#   cd backend && npm run db:local && npm run dev      # API on :8787
# Then here:
#   scripts/unix/preview.sh              # http://localhost:8000  (proxies /api -> :8787)
#   scripts/unix/preview.sh 9000         # custom port
#   API=http://localhost:8799 scripts/unix/preview.sh  # custom backend URL
set -euo pipefail

PORT="${1:-8000}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/build/preview"

# Assemble the sibling layout with symlinks (rebuilt each run).
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "$ROOT/site/." "$OUT/"
ln -s "$ROOT/tools/map_editor" "$OUT/editor"
if [ -d "$ROOT/build/web" ]; then
  ln -s "$ROOT/build/web" "$OUT/play"
else
  echo "!  build/web/ not found — run scripts/unix/export_web.sh first (Jogar/Testar will 404)."
fi

export PREVIEW_DIR="$OUT" PREVIEW_PORT="$PORT" PREVIEW_API="${API:-http://localhost:8787}"

echo "Paçoca preview em  http://localhost:$PORT"
echo "  /         landing"
echo "  /play/    jogo (WASM)"
echo "  /editor/  map editor  ->  desenhe e clique em Testar"
echo "  /api/*    -> $PREVIEW_API  (para Publicar/comunidade: cd backend && npm run db:local && npm run dev)"

# The server itself is shared with the Windows launcher (scripts/preview_server.py).
exec python3 "$ROOT/scripts/preview_server.py"
