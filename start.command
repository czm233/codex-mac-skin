#!/bin/bash
source "$(dirname "$0")/scripts/env.sh"
mkdir -p work
codex_running() {
  # pgrep on macOS omits ancestors, including Codex when this script is run by it.
  /bin/ps -axo command= | /usr/bin/awk '/^\/Applications\/ChatGPT.app\/Contents\/MacOS\/ChatGPT( |$)/ { found=1 } END { exit !found }'
}
if "$NODE_BIN" src/cli.mjs status >/dev/null 2>&1; then
  "$NODE_BIN" src/cli.mjs apply
  exit
fi
if /usr/sbin/lsof -nP -iTCP:10270 -sTCP:LISTEN >/dev/null 2>&1; then
  echo '10270 is occupied by an unverified process. Nothing was stopped.'; exit 1
fi
if codex_running; then
  if [ "${1:-}" != '--approved-restart' ]; then
    /usr/bin/osascript -e 'display dialog "启用视频背景需要重新启动 Codex。请先结束其他正在运行的任务。" buttons {"取消", "重启并播放"} default button "重启并播放" cancel button "取消" with title "Codex 视频背景"'
  fi
  /usr/bin/osascript -e 'tell application "/Applications/ChatGPT.app" to quit'
  for i in {1..30}; do
    codex_running || break
    /bin/sleep 1
  done
  if codex_running; then
    echo 'Codex did not quit. No forced termination was performed.'; exit 1
  fi
fi
/usr/bin/open -na /Applications/ChatGPT.app --args --remote-debugging-address=127.0.0.1 --remote-debugging-port=10270
"$NODE_BIN" src/cli.mjs wait-apply
echo 'Video applied. Use control.command to pause, change dimming, or restore.'
