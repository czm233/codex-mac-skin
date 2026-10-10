#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
bash scripts/build-app.sh
VERSION=$("$NODE_BIN" -p 'JSON.parse(require("fs").readFileSync("package.json", "utf8")).version')
APP="$PROJECT_DIR/dist/Codex Skin.app"
DMG="$PROJECT_DIR/dist/Codex-Skin-$VERSION-macOS.dmg"
STAGING=$(mktemp -d "$PROJECT_DIR/work/dmg-stage.XXXXXX")
trap 'rm -rf "$STAGING"' EXIT
/usr/bin/ditto "$APP" "$STAGING/Codex Skin.app"
ln -s /Applications "$STAGING/Applications"
/usr/bin/hdiutil create -volname "Codex Skin $VERSION" -srcfolder "$STAGING" -format UDZO -ov "$DMG"
/usr/bin/hdiutil verify "$DMG"
(cd "$PROJECT_DIR/dist" && /usr/bin/shasum -a 256 "Codex-Skin-$VERSION-macOS.dmg" > "Codex-Skin-$VERSION-macOS.dmg.sha256")
echo "$DMG"
