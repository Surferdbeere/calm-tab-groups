#!/bin/sh
# Packages the extension folder into a ZIP for the Chrome Web Store.
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./extension/manifest.json').version")
mkdir -p dist
OUT="dist/calm-tab-groups-$VERSION.zip"
rm -f "$OUT"
(cd extension && zip -r -X "../$OUT" . -x '.*' >/dev/null)
echo "Created $OUT"
