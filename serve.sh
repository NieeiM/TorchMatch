#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "错误：未找到 npm。请先通过 nvm 启用 Node.js。" >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "首次启动，正在安装前端依赖……"
  npm install
fi

echo "正在启动 TorchMatch……"
exec npm run dev -- --host "${HOST:-0.0.0.0}" --port "${PORT:-5173}"
