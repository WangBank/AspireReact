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

invoke_postgres_sql() {
  local container_id="$1"
  local database="$2"
  local sql="$3"

  printf '%s\n' "$sql" | docker exec -i "$container_id" sh -lc \
    "export PGPASSWORD='$POSTGRES_PASSWORD'; psql -v ON_ERROR_STOP=1 -U '$POSTGRES_USER' -d '$database'"
}

query_postgres_sql() {
  local container_id="$1"
  local database="$2"
  local sql="$3"

  printf '%s\n' "$sql" | docker exec -i "$container_id" sh -lc \
    "export PGPASSWORD='$POSTGRES_PASSWORD'; psql -v ON_ERROR_STOP=1 -t -A -U '$POSTGRES_USER' -d '$database'"
}

get_compose_postgres_container_id() {
  local env_file="$1"
  local compose_file="$2"

  if [[ ! -f "$env_file" || ! -f "$compose_file" ]]; then
    return 1
  fi

  docker compose --env-file "$env_file" -f "$compose_file" ps -q postgres 2>/dev/null | awk 'NF { print; exit }'
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
    echo "Multiple running postgres containers were found. Start only the target stack first:"
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

trim_line() {
  awk 'NF { gsub(/^[[:space:]]+|[[:space:]]+$/, ""); print; exit }'
}

sql_escape_literal() {
  local value="$1"
  value="${value//\'/\'\'}"
  printf '%s' "$value"
}

show_usage() {
  cat <<'EOF'
Usage:
  bash scripts/rebind-business-data.sh --username "<target-username>" [--database lies] [--revoke-other-tokens]

What it updates:
  - AccountDailies.UserId
  - BankFlows.UserId
  - StockTrades.UserId
  - TradeNotes.UserId
  - PortfolioImportAudits.UserId

What it does not touch by default:
  - messaging tables
  - contacts
  - system settings

Notes:
  - The target PostgreSQL container must already be running.
  - The script stops before writing if AccountDailies has duplicate dates that would violate
    the unique (UserId, Date) index after rebinding.
EOF
}

TARGET_USERNAME=""
TARGET_DATABASE="$(get_env_value POSTGRES_DB lies)"
POSTGRES_USER="$(get_env_value POSTGRES_USER postgres)"
POSTGRES_PASSWORD="$(get_env_value POSTGRES_PASSWORD postgres123)"
REVOKE_OTHER_TOKENS="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --username)
      TARGET_USERNAME="${2:-}"
      shift 2
      ;;
    --database)
      TARGET_DATABASE="${2:-}"
      shift 2
      ;;
    --revoke-other-tokens)
      REVOKE_OTHER_TOKENS="true"
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      show_usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET_USERNAME" ]]; then
  echo "Missing required argument: --username" >&2
  show_usage >&2
  exit 1
fi

CONTAINER_ID="$(get_postgres_container_id || true)"
if [[ -z "$CONTAINER_ID" ]]; then
  echo "Postgres container is not running. Start the Docker stack first." >&2
  exit 1
fi

TARGET_USERNAME_SQL="$(sql_escape_literal "$TARGET_USERNAME")"

DATABASE_EXISTS="$(
  query_postgres_sql "$CONTAINER_ID" postgres "
    SELECT EXISTS (
      SELECT 1
      FROM pg_database
      WHERE datname = '$TARGET_DATABASE'
    );
  " | trim_line
)"

if [[ "$DATABASE_EXISTS" != "t" ]]; then
  echo "Database '$TARGET_DATABASE' does not exist in container '$CONTAINER_ID'." >&2
  exit 1
fi

USERS_TABLE_EXISTS="$(
  query_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
    SELECT to_regclass('public.users') IS NOT NULL;
  " | trim_line
)"

if [[ "$USERS_TABLE_EXISTS" != "t" ]]; then
  echo "Database '$TARGET_DATABASE' does not contain table 'users'." >&2
  exit 1
fi

TARGET_USER_ID="$(
  query_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
    SELECT id
    FROM users
    WHERE username = '$TARGET_USERNAME_SQL'
    ORDER BY id
    LIMIT 1;
  " | trim_line
)"

if [[ -z "$TARGET_USER_ID" ]]; then
  echo "Target user '$TARGET_USERNAME' was not found in database '$TARGET_DATABASE'." >&2
  echo
  echo "Available users:"
  invoke_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
    SELECT id, username, role, is_active, created_at
    FROM users
    ORDER BY id;
  "
  exit 1
fi

echo "Target database: $TARGET_DATABASE"
echo "Target user: $TARGET_USERNAME (id=$TARGET_USER_ID)"
echo
echo "User summary before rebinding:"
invoke_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
  SELECT
    u.id,
    u.username,
    u.role,
    u.is_active,
    COALESCE(a.account_count, 0) AS account_rows,
    COALESCE(b.flow_count, 0) AS bank_flow_rows,
    COALESCE(s.trade_count, 0) AS trade_rows,
    COALESCE(t.note_count, 0) AS note_rows,
    COALESCE(p.audit_count, 0) AS audit_rows
  FROM users u
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS account_count
    FROM \"AccountDailies\"
    GROUP BY \"UserId\"
  ) a ON a.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS flow_count
    FROM \"BankFlows\"
    GROUP BY \"UserId\"
  ) b ON b.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS trade_count
    FROM \"StockTrades\"
    GROUP BY \"UserId\"
  ) s ON s.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS note_count
    FROM \"TradeNotes\"
    GROUP BY \"UserId\"
  ) t ON t.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS audit_count
    FROM \"PortfolioImportAudits\"
    GROUP BY \"UserId\"
  ) p ON p.\"UserId\" = u.id
  ORDER BY u.id;
"

ACCOUNT_DAILY_CONFLICTS="$(
  query_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
    SELECT COUNT(*)
    FROM (
      SELECT \"Date\"
      FROM \"AccountDailies\"
      GROUP BY \"Date\"
      HAVING COUNT(*) > 1
    ) duplicates;
  " | trim_line
)"

if [[ "${ACCOUNT_DAILY_CONFLICTS:-0}" != "0" ]]; then
  echo
  echo "Rebinding would violate the unique (UserId, Date) index on AccountDailies."
  echo "Duplicate AccountDailies dates found:"
  invoke_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
    SELECT \"Date\", COUNT(*) AS duplicate_rows, ARRAY_AGG(id ORDER BY id) AS account_ids
    FROM \"AccountDailies\"
    GROUP BY \"Date\"
    HAVING COUNT(*) > 1
    ORDER BY \"Date\";
  "
  exit 1
fi

TOKEN_SQL=""
if [[ "$REVOKE_OTHER_TOKENS" == "true" ]]; then
  TOKEN_SQL=$(cat <<SQL
    IF to_regclass('public.quick_login_tokens') IS NOT NULL THEN
      DELETE FROM quick_login_tokens
      WHERE user_id IS DISTINCT FROM $TARGET_USER_ID;
      GET DIAGNOSTICS updated_count = ROW_COUNT;
      RAISE NOTICE 'quick_login_tokens: deleted % row(s) for non-target users', updated_count;
    END IF;
SQL
)
fi

echo
echo "Applying rebinding transaction..."
invoke_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
BEGIN;

DO \$\$
DECLARE
  updated_count integer;
BEGIN
  IF to_regclass('public.\"AccountDailies\"') IS NOT NULL THEN
    UPDATE \"AccountDailies\"
    SET \"UserId\" = $TARGET_USER_ID
    WHERE \"UserId\" IS DISTINCT FROM $TARGET_USER_ID;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'AccountDailies: updated % row(s)', updated_count;
  END IF;

  IF to_regclass('public.\"BankFlows\"') IS NOT NULL THEN
    UPDATE \"BankFlows\"
    SET \"UserId\" = $TARGET_USER_ID
    WHERE \"UserId\" IS DISTINCT FROM $TARGET_USER_ID;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'BankFlows: updated % row(s)', updated_count;
  END IF;

  IF to_regclass('public.\"StockTrades\"') IS NOT NULL THEN
    UPDATE \"StockTrades\"
    SET \"UserId\" = $TARGET_USER_ID
    WHERE \"UserId\" IS DISTINCT FROM $TARGET_USER_ID;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'StockTrades: updated % row(s)', updated_count;
  END IF;

  IF to_regclass('public.\"TradeNotes\"') IS NOT NULL THEN
    UPDATE \"TradeNotes\"
    SET \"UserId\" = $TARGET_USER_ID
    WHERE \"UserId\" IS DISTINCT FROM $TARGET_USER_ID;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'TradeNotes: updated % row(s)', updated_count;
  END IF;

  IF to_regclass('public.\"PortfolioImportAudits\"') IS NOT NULL THEN
    UPDATE \"PortfolioImportAudits\"
    SET \"UserId\" = $TARGET_USER_ID
    WHERE \"UserId\" IS DISTINCT FROM $TARGET_USER_ID;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'PortfolioImportAudits: updated % row(s)', updated_count;
  END IF;

$TOKEN_SQL
END
\$\$;

COMMIT;
"

echo
echo "User summary after rebinding:"
invoke_postgres_sql "$CONTAINER_ID" "$TARGET_DATABASE" "
  SELECT
    u.id,
    u.username,
    u.role,
    u.is_active,
    COALESCE(a.account_count, 0) AS account_rows,
    COALESCE(b.flow_count, 0) AS bank_flow_rows,
    COALESCE(s.trade_count, 0) AS trade_rows,
    COALESCE(t.note_count, 0) AS note_rows,
    COALESCE(p.audit_count, 0) AS audit_rows
  FROM users u
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS account_count
    FROM \"AccountDailies\"
    GROUP BY \"UserId\"
  ) a ON a.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS flow_count
    FROM \"BankFlows\"
    GROUP BY \"UserId\"
  ) b ON b.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS trade_count
    FROM \"StockTrades\"
    GROUP BY \"UserId\"
  ) s ON s.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS note_count
    FROM \"TradeNotes\"
    GROUP BY \"UserId\"
  ) t ON t.\"UserId\" = u.id
  LEFT JOIN (
    SELECT \"UserId\", COUNT(*) AS audit_count
    FROM \"PortfolioImportAudits\"
    GROUP BY \"UserId\"
  ) p ON p.\"UserId\" = u.id
  ORDER BY u.id;
"

echo
echo "Rebinding completed."
