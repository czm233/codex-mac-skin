#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_BIN="$PROJECT_DIR/dist/Codex Skin.app/Contents/MacOS/CodexSkin"
[ -x "$APP_BIN" ] || { echo '请先运行 npm run build:app'; exit 1; }
mkdir -p "$PROJECT_DIR/work"
"$APP_BIN" --smoke check
