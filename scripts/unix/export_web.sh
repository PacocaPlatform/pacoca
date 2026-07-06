#!/usr/bin/env bash
# Exports the Paçoca game to a static web build in build/web/.
#
# Requires the STANDARD (non-Mono) Godot 4.7 editor and the matching web
# export templates installed (the Mono edition cannot export to Web). Point
# GODOT at the standard editor binary, or put it on PATH as `godot`.
#
#   GODOT=/path/to/Godot_v4.7-stable_win64_console.exe ./scripts/unix/export_web.sh
#
# The Web preset (game/export_presets.cfg) is multi-threaded (thread_support=true)
# so Godot runs the audio mixer off the main thread (smooth music). This REQUIRES
# the host to send cross-origin-isolation headers so SharedArrayBuffer is available:
#   Cross-Origin-Opener-Policy: same-origin
#   Cross-Origin-Embedder-Policy: require-corp
# The Worker sets these for the play/ path (backend/src/index.ts, serveStatic).
set -euo pipefail

GODOT="${GODOT:-godot}"
# Allow GODOT to point at the extracted Godot folder, not just the binary:
# resolve a directory to the editor executable inside it (prefer the console
# build so --headless output reaches this script's stdout).
if [ -d "$GODOT" ]; then
  _exe="$(find "$GODOT" -maxdepth 1 -type f -name 'Godot*_console.exe' | head -n1)"
  [ -z "$_exe" ] && _exe="$(find "$GODOT" -maxdepth 1 -type f \( -name 'Godot*.exe' -o -name 'Godot*' \) | head -n1)"
  [ -z "$_exe" ] && { echo "GODOT points to directory '$GODOT' but no Godot binary was found inside it." >&2; exit 1; }
  GODOT="$_exe"
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="$ROOT/game"
OUT="$ROOT/build/web"

mkdir -p "$OUT"
echo "Exporting Web build -> $OUT"
"$GODOT" --headless --path "$PROJECT" --import
"$GODOT" --headless --path "$PROJECT" --export-release "Web" "$OUT/index.html"
echo "Done. Serve locally with:  python -m http.server 8777 --directory build/web"
