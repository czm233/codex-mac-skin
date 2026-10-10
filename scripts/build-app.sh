#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
APP="$PROJECT_DIR/dist/Codex Skin.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$PROJECT_DIR/work/app-build"
"$NODE_BIN" scripts/build-payload.mjs "$APP/Contents/Resources/skin.js"
for arch in arm64 x86_64; do
  /usr/bin/xcrun swiftc -parse-as-library -swift-version 5 -O -target "$arch-apple-macosx13.0" app/Bridge.swift app/main.swift -o "$PROJECT_DIR/work/app-build/CodexSkin-$arch"
done
/usr/bin/lipo -create "$PROJECT_DIR/work/app-build/CodexSkin-arm64" "$PROJECT_DIR/work/app-build/CodexSkin-x86_64" -output "$APP/Contents/MacOS/CodexSkin"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>cc.local.codex-video-skin</string>
<key>CFBundleName</key><string>Codex Skin</string>
<key>CFBundleDisplayName</key><string>Codex Skin</string>
<key>CFBundleExecutable</key><string>CodexSkin</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.3.0</string>
<key>CFBundleVersion</key><string>3</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
/usr/bin/codesign --force --sign - "$APP"
/usr/bin/codesign --verify --strict "$APP"
/usr/bin/ditto -c -k --keepParent "$APP" "$PROJECT_DIR/dist/Codex-Skin-macOS.zip"
echo "$APP"
