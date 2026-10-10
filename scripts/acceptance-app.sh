#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
APP_BIN="$PROJECT_DIR/dist/Codex Skin.app/Contents/MacOS/CodexSkin"
[ -x "$APP_BIN" ] || { echo '请先运行 npm run build:app'; exit 1; }
mkdir -p "$PROJECT_DIR/work"
"$APP_BIN" --smoke check | tee "$PROJECT_DIR/work/acceptance-app.json"
"$NODE_BIN" --input-type=module -e 'import fs from "node:fs";const r=JSON.parse(fs.readFileSync("work/acceptance-app.json","utf8"));if(r.action!=="check"||!r.success||!r.windowVisible||!r.buttonsEnabled)throw Error("Native acceptance did not complete the requested read-only check");'
