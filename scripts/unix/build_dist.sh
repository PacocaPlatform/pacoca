#!/usr/bin/env bash
# Assembles the production bundle to upload to a static host, combining the three
# static pieces into ONE folder (real copies, so any host works):
#
#   build/dist/
#     index.html, styles.css, app.js, assets/   <- site/        (landing)
#     play/                                      <- build/web/   (WASM game)
#     editor/                                    <- tools/map_editor/ (editor)
#
# Upload the CONTENTS of build/dist/ as the site root. The community backend
# (backend/, a Cloudflare Worker) is deployed separately and answers /api/*.
#
# Prereq: export the game first so build/web/ exists:
#   GODOT=/path/to/Godot ./tools/export_web.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/build/dist"

if [ ! -d "$ROOT/build/web" ]; then
  echo "ERROR: build/web/ not found. Run ./tools/export_web.sh first." >&2
  exit 1
fi

rm -rf "$DIST"
mkdir -p "$DIST"

# Landing at the root.
cp -R "$ROOT/site/." "$DIST/"
rm -f "$DIST/README.md"

# Game and editor as sibling folders.
cp -R "$ROOT/build/web" "$DIST/play"
cp -R "$ROOT/tools/map_editor" "$DIST/editor"
# Drop the editor's legacy/native-only bits from the web bundle.
rm -f "$DIST/editor/server.py"
rm -rf "$DIST/editor/__pycache__" "$DIST/editor/levels"

echo "Bundle ready:  $DIST"
echo "Upload its CONTENTS as the site root. Then deploy backend/ for /api/*."
du -sh "$DIST" "$DIST/play" "$DIST/editor" 2>/dev/null
