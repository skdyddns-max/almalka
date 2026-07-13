#!/usr/bin/env bash
# 알려줄까말까 로컬 미리보기 — http://localhost:8051
cd "$(dirname "$0")"
PORT="${1:-8051}"
echo "▶ 알려줄까말까  http://localhost:$PORT  (Ctrl+C로 종료)"
python3 -m http.server "$PORT"
