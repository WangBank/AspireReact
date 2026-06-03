#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker"
EXAMPLE_FILE="$ROOT_DIR/.env.docker.example"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE. Update passwords and ports if needed."
fi

if ! docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" up -d --build; then
  echo
  echo "docker compose up failed."
  echo "Trying to show postgres logs for diagnosis..."
  echo
  docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" logs postgres || true
  echo
  echo "Common cause: an existing postgres data volume was created by another major version."
  echo "If you need the old data, set POSTGRES_IMAGE in .env.docker to the old major version first."
  echo "If you do not need the old data, run: docker compose --env-file \"$ENV_FILE\" -f \"$ROOT_DIR/docker-compose.yml\" down -v"
  exit 1
fi

echo
echo "Docker services are up."
echo "App URL: http://localhost:$(grep '^APP_PORT=' "$ENV_FILE" | cut -d'=' -f2)"
echo "Logs: docker compose --env-file \"$ENV_FILE\" -f \"$ROOT_DIR/docker-compose.yml\" logs -f app"
