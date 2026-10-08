#!/bin/bash
source "$(dirname "$0")/scripts/env.sh"
CHOICE=$(/usr/bin/osascript -e 'choose from list {"应用当前视频", "暂停", "继续播放", "遮罩 15%", "遮罩 30%", "遮罩 45%", "面板全透明", "面板薄底 12%", "面板薄底 24%", "完整视频", "铺满裁切", "恢复原生界面", "查看播放状态"} with title "Codex 视频背景" with prompt "选择操作" default items {"查看播放状态"}')
case "$CHOICE" in
  '应用当前视频') "$NODE_BIN" src/cli.mjs apply ;;
  '暂停') "$NODE_BIN" src/cli.mjs pause ;;
  '继续播放') "$NODE_BIN" src/cli.mjs resume ;;
  '遮罩 15%') "$NODE_BIN" src/cli.mjs dim 0.15 ;;
  '遮罩 30%') "$NODE_BIN" src/cli.mjs dim 0.30 ;;
  '遮罩 45%') "$NODE_BIN" src/cli.mjs dim 0.45 ;;
  '面板全透明') "$NODE_BIN" src/cli.mjs glass 0 ;;
  '面板薄底 12%') "$NODE_BIN" src/cli.mjs glass 0.12 ;;
  '面板薄底 24%') "$NODE_BIN" src/cli.mjs glass 0.24 ;;
  '完整视频') "$NODE_BIN" src/cli.mjs fit contain ;;
  '铺满裁切') "$NODE_BIN" src/cli.mjs fit cover ;;
  '恢复原生界面') "$NODE_BIN" src/cli.mjs restore ;;
  '查看播放状态') "$NODE_BIN" src/cli.mjs status ;;
esac
