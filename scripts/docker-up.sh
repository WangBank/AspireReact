#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker"
EXAMPLE_FILE="$ROOT_DIR/.env.docker.example"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "已生成 $ENV_FILE，请按需修改其中的密码和端口配置。"
fi

docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" up -d --build

echo
echo "Docker 服务已启动。"
echo "前端访问地址: http://localhost:$(grep '^APP_PORT=' "$ENV_FILE" | cut -d'=' -f2)"
echo "查看日志: docker compose --env-file \"$ENV_FILE\" logs -f app"
