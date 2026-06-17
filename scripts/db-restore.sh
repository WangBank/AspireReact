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

first_non_empty() {
  for value in "$@"; do
    if [[ -n "${value// }" ]]; then
      echo "$value"
      return 0
    fi
  done

  echo ""
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

get_compose_service_container_id() {
  local env_file="$1"
  local compose_file="$2"
  local service_name="$3"

  if [[ ! -f "$env_file" || ! -f "$compose_file" ]]; then
    return 1
  fi

  docker compose --env-file "$env_file" -f "$compose_file" ps -q "$service_name" 2>/dev/null | awk 'NF { print; exit }'
}

invoke_postgres_sql() {
  local container_id="$1"
  local database="$2"
  local sql="$3"

  printf '%s\n' "$sql" | docker exec -i "$container_id" sh -lc \
    "export PGPASSWORD='$POSTGRES_PASSWORD'; psql -v ON_ERROR_STOP=1 -U '$POSTGRES_USER' -d '$database'"
}

get_compose_postgres_container_id() {
  local env_file="$1"
  local compose_file="$2"

  if [[ ! -f "$env_file" || ! -f "$compose_file" ]]; then
    return 1
  fi

  docker compose --env-file "$env_file" -f "$compose_file" ps -q postgres 2>/dev/null | awk 'NF { print; exit }'
}

get_container_env_value() {
  local container_id="$1"
  local env_name="$2"

  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id" 2>/dev/null | \
    awk -v name="$env_name" 'index($0, name "=") == 1 { print substr($0, length(name) + 2); exit }'
}

get_connection_string_part() {
  local connection_string="$1"
  shift

  for lookup_key in "$@"; do
    local value
    value="$(
      printf '%s' "$connection_string" | tr ';' '\n' | \
        awk -F '=' -v lookup="$lookup_key" '
          {
            key = $1
            sub(/^[[:space:]]+|[[:space:]]+$/, "", key)
            lower_key = tolower(key)
            value = substr($0, index($0, "=") + 1)
            sub(/^[[:space:]]+|[[:space:]]+$/, "", value)
            if (lower_key == tolower(lookup) && length(value) > 0) {
              print value
              exit
            }
          }
        '
    )"

    if [[ -n "$value" ]]; then
      echo "$value"
      return 0
    fi
  done

  echo ""
}

resolve_current_postgres_settings() {
  local postgres_container_id="$1"
  local default_database="$2"
  local default_user="$3"
  local default_password="$4"

  local apphost_output_dir="$ROOT_DIR/.aspire-output/docker-compose"
  local apphost_compose_file=""
  apphost_compose_file="$(get_first_existing_path "$apphost_output_dir/docker-compose.yaml" "$apphost_output_dir/docker-compose.yml" || true)"
  local apphost_env_file="$apphost_output_dir/.env.Production"

  local compose_pairs=(
    "$ENV_FILE"$'\t'"$COMPOSE_FILE"
  )

  if [[ -n "$apphost_compose_file" ]]; then
    compose_pairs+=("$apphost_env_file"$'\t'"$apphost_compose_file")
  fi

  local pair
  for pair in "${compose_pairs[@]}"; do
    local pair_env_file="${pair%%$'\t'*}"
    local pair_compose_file="${pair#*$'\t'}"

    for service_name in lies-app lies-apphost-monitor; do
      local service_container_id=""
      service_container_id="$(get_compose_service_container_id "$pair_env_file" "$pair_compose_file" "$service_name" || true)"
      if [[ -z "$service_container_id" ]]; then
        continue
      fi

      for env_name in ConnectionStrings__PostgreSQL Monitoring__PostgresConnectionString; do
        local connection_string=""
        connection_string="$(get_container_env_value "$service_container_id" "$env_name")"
        if [[ -z "$connection_string" ]]; then
          continue
        fi

        local database=""
        database="$(first_non_empty \
          "$(get_connection_string_part "$connection_string" "database" "initial catalog")" \
          "$default_database")"
        local user=""
        user="$(first_non_empty \
          "$(get_connection_string_part "$connection_string" "username" "user id" "user" "userid" "uid")" \
          "$default_user")"
        local password=""
        password="$(first_non_empty \
          "$(get_connection_string_part "$connection_string" "password" "pwd")" \
          "$default_password")"

        if [[ -n "$database" && -n "$user" ]]; then
          printf '%s\t%s\t%s\t%s\n' "$database" "$user" "$password" "container $service_name / $env_name"
          return 0
        fi
      done
    done
  done

  if [[ -n "$postgres_container_id" ]]; then
    local database=""
    database="$(first_non_empty "$(get_container_env_value "$postgres_container_id" "POSTGRES_DB")" "$default_database")"
    local user=""
    user="$(first_non_empty "$(get_container_env_value "$postgres_container_id" "POSTGRES_USER")" "$default_user")"
    local password=""
    password="$(first_non_empty "$(get_container_env_value "$postgres_container_id" "POSTGRES_PASSWORD")" "$default_password")"

    if [[ -n "$database" && -n "$user" ]]; then
      printf '%s\t%s\t%s\t%s\n' "$database" "$user" "$password" "postgres container environment"
      return 0
    fi
  fi

  printf '%s\t%s\t%s\t%s\n' "$default_database" "$default_user" "$default_password" ".env.docker defaults"
}

get_running_containers() {
  docker ps --format '{{.ID}}'"$'\t'"'{{.Image}}'"$'\t'"'{{.Names}}'"$'\t'"'{{.Ports}}' "$@" 2>/dev/null || true
}

select_preferred_postgres_container() {
  local candidates="$1"

  if [[ -z "$candidates" ]]; then
    return 1
  fi

  local filtered="$candidates"
  local port_matches
  port_matches="$(printf '%s\n' "$filtered" | awk -F '\t' 'index($4, "5432->5432") > 0')"
  if [[ -n "$port_matches" ]]; then
    filtered="$port_matches"
  fi

  local exact_name_match
  exact_name_match="$(printf '%s\n' "$filtered" | awk -F '\t' '$3 == "postgres-1" { print; exit }')"
  if [[ -n "$exact_name_match" ]]; then
    printf '%s\n' "$exact_name_match" | cut -f1
    return 0
  fi

  local canonical_name_match
  canonical_name_match="$(printf '%s\n' "$filtered" | awk -F '\t' '$3 ~ /(^|[-_])postgres(-1)?$/ { print; exit }')"
  if [[ -n "$canonical_name_match" ]]; then
    printf '%s\n' "$canonical_name_match" | cut -f1
    return 0
  fi

  local match_count
  match_count="$(printf '%s\n' "$filtered" | awk 'NF' | wc -l | tr -d ' ')"
  if [[ "$match_count" == "1" ]]; then
    printf '%s\n' "$filtered" | awk -F '\t' 'NF { print $1; exit }'
    return 0
  fi

  {
    echo "Multiple running postgres containers were found. Stop the old stack, or restore into one container explicitly:"
    printf '%s\n' "$filtered" | awk -F '\t' 'NF { printf " - %s [%s] image=%s ports=%s\n", $3, $1, $2, $4 }'
  } >&2

  return 1
}

get_postgres_container_id() {
  local container_id=""
  container_id="$(get_compose_postgres_container_id "$ENV_FILE" "$COMPOSE_FILE" || true)"
  if [[ -n "$container_id" ]]; then
    echo "$container_id"
    return 0
  fi

  local apphost_output_dir="$ROOT_DIR/.aspire-output/docker-compose"
  local apphost_compose_file=""
  apphost_compose_file="$(get_first_existing_path "$apphost_output_dir/docker-compose.yaml" "$apphost_output_dir/docker-compose.yml" || true)"
  local apphost_env_file="$apphost_output_dir/.env.Production"

  if [[ -n "$apphost_compose_file" ]]; then
    container_id="$(get_compose_postgres_container_id "$apphost_env_file" "$apphost_compose_file" || true)"
    if [[ -n "$container_id" ]]; then
      echo "$container_id"
      return 0
    fi
  fi

  local container_candidates=""
  container_candidates="$(get_running_containers --filter label=com.docker.compose.service=postgres)"
  if [[ -z "$container_candidates" ]]; then
    container_candidates="$(get_running_containers | awk -F '\t' 'tolower($2) ~ /postgres/ && tolower($3) ~ /postgres/')"
  fi

  container_id="$(select_preferred_postgres_container "$container_candidates" || true)"
  if [[ -n "$container_id" ]]; then
    echo "$container_id"
    return 0
  fi

  return 1
}

DEFAULT_DATABASE="$(get_env_value POSTGRES_DB lies)"
DEFAULT_POSTGRES_USER="$(get_env_value POSTGRES_USER postgres)"
DEFAULT_POSTGRES_PASSWORD="$(get_env_value POSTGRES_PASSWORD postgres123)"

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/db-restore.sh <dump-file> [database]"
  echo "Supported formats: .sql, .dump, .backup, .tar"
  echo "If [database] is omitted, the script restores into the database currently linked by the running Docker app container."
  exit 1
fi

DUMP_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
CONTAINER_ID="$(get_postgres_container_id || true)"

if [[ -z "$CONTAINER_ID" ]]; then
  echo "Postgres container is not running. Start the Docker stack first."
  exit 1
fi

RESOLVED_SETTINGS="$(resolve_current_postgres_settings "$CONTAINER_ID" "$DEFAULT_DATABASE" "$DEFAULT_POSTGRES_USER" "$DEFAULT_POSTGRES_PASSWORD")"
TARGET_DATABASE="${2:-$(printf '%s' "$RESOLVED_SETTINGS" | cut -f1)}"
POSTGRES_USER="$(printf '%s' "$RESOLVED_SETTINGS" | cut -f2)"
POSTGRES_PASSWORD="$(printf '%s' "$RESOLVED_SETTINGS" | cut -f3)"
SETTINGS_SOURCE="$(printf '%s' "$RESOLVED_SETTINGS" | cut -f4)"

DUMP_EXTENSION="${DUMP_FILE##*.}"
CONTAINER_DUMP_PATH="/tmp/restore-input.${DUMP_EXTENSION}"

echo "Resolved PostgreSQL settings from: $SETTINGS_SOURCE"
echo "Copying dump into postgres container..."
docker cp "$DUMP_FILE" "${CONTAINER_ID}:${CONTAINER_DUMP_PATH}"

DISCONNECT_SQL=$(cat <<SQL
UPDATE pg_database
SET datallowconn = false
WHERE datname = '$TARGET_DATABASE';

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$TARGET_DATABASE'
  AND pid <> pg_backend_pid();
SQL
)

echo "Disconnecting active sessions from '$TARGET_DATABASE'..."
invoke_postgres_sql "$CONTAINER_ID" postgres "$DISCONNECT_SQL"

echo "Recreating database '$TARGET_DATABASE'..."
if ! docker exec "$CONTAINER_ID" sh -lc \
  "export PGPASSWORD='$POSTGRES_PASSWORD'; dropdb --if-exists -U '$POSTGRES_USER' '$TARGET_DATABASE'"; then
  RECONNECT_SQL=$(cat <<SQL
UPDATE pg_database
SET datallowconn = true
WHERE datname = '$TARGET_DATABASE';
SQL
)
  invoke_postgres_sql "$CONTAINER_ID" postgres "$RECONNECT_SQL" >/dev/null 2>&1 || true
  echo "Failed to drop existing database." >&2
  exit 1
fi

docker exec "$CONTAINER_ID" sh -lc \
  "export PGPASSWORD='$POSTGRES_PASSWORD'; createdb -U '$POSTGRES_USER' '$TARGET_DATABASE'"

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
echo "Resolved from: $SETTINGS_SOURCE"
