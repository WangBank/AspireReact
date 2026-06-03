#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "未找到 $ENV_FILE，使用示例环境文件继续关闭服务。"
  ENV_FILE="$ROOT_DIR/.env.docker.example"
fi

docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" down
