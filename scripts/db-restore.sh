#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

get_env_value() {
  local name="$1"
  local default_value="$2"

  if [[ -f "$ENV_FILE" ]]; then
    local line
    line="$(grep -E "^${name}=" "$ENV_FILE" | head -n1 || true)"
    if [[ -n "$line" ]]; then
      echo "${line#*=}"
      return 0
    fi
  fi

  echo "$default_value"
}

get_first_existing_path() {
  for path in "$@"; do
    if [[ -f "$path" ]]; then
      echo "$path"
      return 0
    fi
  done

  return 1
}

get_postgres_container_id() {
  local container_id=""
  container_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q postgres || true)"
  if [[ -n "$container_id" ]]; then
    echo "$container_id"
    return 0
  fi

  local apphost_output_dir="$ROOT_DIR/.aspire-output/docker-compose"
  local apphost_compose_file=""
  apphost_compose_file="$(get_first_existing_path "$apphost_output_dir/docker-compose.yaml" "$apphost_output_dir/docker-compose.yml" || true)"
  local apphost_env_file="$apphost_output_dir/.env.Production"

  if [[ -n "$apphost_compose_file" ]]; then
    container_id="$(docker compose --env-file "$apphost_env_file" -f "$apphost_compose_file" ps -q postgres || true)"
    if [[ -n "$container_id" ]]; then
      echo "$container_id"
      return 0
    fi
  fi

  return 1
}

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/db-restore.sh <dump-file> [database]"
  echo "Supported formats: .sql, .dump, .backup, .tar"
  exit 1
fi

DUMP_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
TARGET_DATABASE="${2:-$(get_env_value POSTGRES_DB lies)}"
POSTGRES_USER="$(get_env_value POSTGRES_USER postgres)"
POSTGRES_PASSWORD="$(get_env_value POSTGRES_PASSWORD postgres123)"
CONTAINER_ID="$(get_postgres_container_id || true)"

if [[ -z "$CONTAINER_ID" ]]; then
  echo "Postgres container is not running. Start the Docker stack first."
  exit 1
fi

DUMP_EXTENSION="${DUMP_FILE##*.}"
CONTAINER_DUMP_PATH="/tmp/restore-input.${DUMP_EXTENSION}"

echo "Copying dump into postgres container..."
docker cp "$DUMP_FILE" "${CONTAINER_ID}:${CONTAINER_DUMP_PATH}"

echo "Recreating database '$TARGET_DATABASE'..."
docker exec "$CONTAINER_ID" sh -lc \
  "export PGPASSWORD='$POSTGRES_PASSWORD'; dropdb --if-exists -U '$POSTGRES_USER' '$TARGET_DATABASE'; createdb -U '$POSTGRES_USER' '$TARGET_DATABASE'"

if [[ "${DUMP_FILE,,}" == *.sql ]]; then
  echo "Restoring SQL dump..."
  docker exec "$CONTAINER_ID" sh -lc \
    "export PGPASSWORD='$POSTGRES_PASSWORD'; psql -v ON_ERROR_STOP=1 -U '$POSTGRES_USER' -d '$TARGET_DATABASE' -f '$CONTAINER_DUMP_PATH'"
else
  echo "Restoring pg_dump archive..."
  docker exec "$CONTAINER_ID" sh -lc \
    "export PGPASSWORD='$POSTGRES_PASSWORD'; pg_restore --no-owner --no-privileges -U '$POSTGRES_USER' -d '$TARGET_DATABASE' '$CONTAINER_DUMP_PATH'"
fi

docker exec "$CONTAINER_ID" rm -f "$CONTAINER_DUMP_PATH"

echo
echo "Database restore completed."
echo "Database: $TARGET_DATABASE"
echo "User: $POSTGRES_USER"
