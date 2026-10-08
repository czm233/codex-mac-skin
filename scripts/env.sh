#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node' ]; then
  NODE_BIN='/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node'
else
  NODE_BIN="$(/bin/ls -t "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | /usr/bin/head -1)"
fi
[ -x "$NODE_BIN" ] || { echo 'Node.js 22+ is required.'; exit 1; }
cd "$PROJECT_DIR"
