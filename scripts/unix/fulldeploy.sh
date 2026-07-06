#!/usr/bin/env bash
# Runs the full workflow: exports the game, builds the static distribution bundle,
# and deploys it to R2 (Unix).
#
# Usage:
#   ./scripts/unix/fulldeploy.sh              # rebuilds and deploys to pacoca-site
#   ./scripts/unix/fulldeploy.sh my-bucket    # custom bucket name
#   GODOT=/path/to/Godot ./scripts/unix/fulldeploy.sh
#   SKIP_EXPORT=1 ./scripts/unix/fulldeploy.sh
#   SKIP_BUILD=1 ./scripts/unix/fulldeploy.sh
#   LOCAL=1 ./scripts/unix/fulldeploy.sh      # seed the LOCAL R2
set -euo pipefail

BUCKET="${1:-pacoca-site}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "--- Paçoca Full Deploy ---"

# 1. Export Web from Godot
if [ -z "${SKIP_EXPORT:-}" ]; then
  echo "Exporting Web build..."
  "$HERE/export_web.sh"
else
  echo "Skipping Web export."
fi

# 2. Deploy (which will trigger build_dist.sh unless SKIP_BUILD=1 is specified)
echo "Building and Deploying to R2..."
SKIP_BUILD="${SKIP_BUILD:-}" LOCAL="${LOCAL:-}" "$HERE/deploy_r2.sh" "$BUCKET"

echo "Deployment Workflow Completed Successfully."
