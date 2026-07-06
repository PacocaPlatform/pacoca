#!/usr/bin/env bash
# Uploads the static bundle (build/dist/) to the Cloudflare R2 bucket that the
# Worker serves from (binding ASSETS in backend/wrangler.jsonc).
#
# Prereqs (once):
#   npx wrangler login
#   npx wrangler r2 bucket create pacoca-site
#   # game exported: GODOT=/path/to/Godot ./tools/export_web.sh
#
# Usage:
#   ./scripts/unix/deploy_r2.sh              # rebuilds build/dist/ then uploads to pacoca-site
#   ./scripts/unix/deploy_r2.sh my-bucket    # custom bucket name
#   SKIP_BUILD=1 ./scripts/unix/deploy_r2.sh # upload the existing build/dist/ as-is
#   LOCAL=1 ./scripts/unix/deploy_r2.sh      # seed the LOCAL R2 (for `wrangler dev`), not remote
set -euo pipefail

BUCKET="${1:-pacoca-site}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DIST="$ROOT/build/dist"
# wrangler r2 object put/get default to the LOCAL bucket, so target the remote
# bucket explicitly unless LOCAL=1 is set (which seeds the local R2 for dev).
LOCAL_FLAG="--remote"
[ -n "${LOCAL:-}" ] && LOCAL_FLAG="--local"

if [ -z "${SKIP_BUILD:-}" ]; then
  "$HERE/build_dist.sh"
fi
if [ ! -d "$DIST" ]; then
  echo "ERROR: $DIST not found. Run ./scripts/unix/build_dist.sh first." >&2
  exit 1
fi

content_type() {
  case "${1##*.}" in
    html) echo "text/html; charset=utf-8" ;;
    js|mjs) echo "text/javascript; charset=utf-8" ;;
    css) echo "text/css; charset=utf-8" ;;
    json) echo "application/json; charset=utf-8" ;;
    wasm) echo "application/wasm" ;;
    png) echo "image/png" ;;
    jpg|jpeg) echo "image/jpeg" ;;
    gif) echo "image/gif" ;;
    svg) echo "image/svg+xml" ;;
    ico) echo "image/x-icon" ;;
    webp) echo "image/webp" ;;
    woff2) echo "font/woff2" ;;
    wav) echo "audio/wav" ;;
    mp3) echo "audio/mpeg" ;;
    ogg) echo "audio/ogg" ;;
    txt) echo "text/plain; charset=utf-8" ;;
    *) echo "application/octet-stream" ;;
  esac
}

count=$(find "$DIST" -type f | wc -l | tr -d ' ')
echo "Uploading $count files from build/dist/ -> r2://$BUCKET ${LOCAL_FLAG:+(LOCAL)}"
i=0
while IFS= read -r f; do
  key="${f#"$DIST"/}"                    # path relative to build/dist/
  ct="$(content_type "$f")"
  i=$((i + 1))
  printf "[%2d/%s] %s (%s)\n" "$i" "$count" "$key" "$ct"
  ( cd "$ROOT/backend" && npx wrangler r2 object put "$BUCKET/$key" --file="$f" --content-type="$ct" $LOCAL_FLAG >/dev/null )
done < <(find "$DIST" -type f)

if [ -n "${LOCAL:-}" ]; then
  echo "Done (local). Run the Worker:  (cd backend && npm run db:local && npm run dev)"
else
  echo "Done. Deploy the Worker to serve them:  (cd backend && npm run deploy)"
fi
