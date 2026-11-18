#!/bin/zsh
setopt NO_BG_NICE
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PORT="${WORLDSTAGE_PORT:-}"
if [ -z "$PORT" ]; then
  for CANDIDATE in 5196 5199 5202; do
    HEALTH="$(curl -fsS --max-time 2 "http://127.0.0.1:$CANDIDATE/health" 2>/dev/null)"
    if [[ "$HEALTH" == *'"product":"worldstage-atlantis"'* && "$HEALTH" == *'"version":6'* ]]; then
      open "http://127.0.0.1:$CANDIDATE/"
      exit 0
    fi
  done
  for CANDIDATE in 5196 5199 5202; do
    if ! curl -sS --max-time 2 -o /dev/null "http://127.0.0.1:$CANDIDATE/" 2>/dev/null; then
      PORT="$CANDIDATE"
      break
    fi
  done
fi
if [ -z "$PORT" ]; then
  echo "预览端口均被占用。请关闭一个旧预览窗口后重试。"
  read -r
  exit 1
fi
export WORLDSTAGE_PORT="$PORT"
NODE="$(command -v node)"
if [ -z "$NODE" ]; then
  NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$NODE" ]; then
  echo "未找到运行环境。请安装 Node.js 20.19 或更高版本后重试。"
  read -r
  exit 1
fi
echo "正在开启即境。体验期间请保留这个窗口；关闭窗口可停止服务。"
if [ -f .env ]; then
  "$NODE" --env-file=.env server.js &
else
  "$NODE" server.js &
fi
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM
sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "启动失败，请检查本地端口是否已被占用。"
  read -r
  exit 1
fi
open "http://127.0.0.1:$PORT/"
wait "$SERVER_PID"
