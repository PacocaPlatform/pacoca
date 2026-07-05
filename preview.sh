#!/usr/bin/env bash
# Local preview of the whole Paçoca platform (landing + game + editor) on one
# origin, mirroring the production deploy layout so every link works:
#
#   /          -> site/            (landing page)
#   /play/     -> build/web/       (exported WASM game)
#   /editor/   -> tools/map_editor/ (visual editor)
#
# This is just a static file server (Python stdlib) — no app backend. Export the
# game first with ./tools/export_web.sh so build/web/ exists.
#
#   ./preview.sh            # http://localhost:8000
#   ./preview.sh 9000       # custom port
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

echo "Paçoca preview em  http://localhost:$PORT"
echo "  /         landing"
echo "  /play/    jogo (WASM)"
echo "  /editor/  map editor  ->  desenhe e clique em Testar"
cd "$OUT"
exec python3 -m http.server "$PORT"
