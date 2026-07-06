#!/usr/bin/env bash
# Exports the Paçoca game to a static web build in build/web/.
#
# Requires the STANDARD (non-Mono) Godot 4.6.3 editor and the matching web
# export templates installed (the Mono edition cannot export to Web). Point
# GODOT at the standard editor binary, or put it on PATH as `godot`.
#
#   GODOT=/path/to/Godot_v4.6.3-stable_win64_console.exe ./scripts/unix/export_web.sh
#
# The Web preset (src/export_presets.cfg) is multi-threaded (thread_support=true)
# so Godot runs the audio mixer off the main thread (smooth music). This REQUIRES
# the host to send cross-origin-isolation headers so SharedArrayBuffer is available:
#   Cross-Origin-Opener-Policy: same-origin
#   Cross-Origin-Embedder-Policy: require-corp
# The Worker sets these for the play/ path (backend/src/index.ts, serveStatic).
set -euo pipefail

GODOT="${GODOT:-godot}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="$ROOT/src"
OUT="$ROOT/build/web"

mkdir -p "$OUT"
echo "Exporting Web build -> $OUT"
"$GODOT" --headless --path "$PROJECT" --import
"$GODOT" --headless --path "$PROJECT" --export-release "Web" "$OUT/index.html"
echo "Done. Serve locally with:  python -m http.server 8777 --directory build/web"
