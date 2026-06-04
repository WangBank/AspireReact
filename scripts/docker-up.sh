#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker"
EXAMPLE_FILE="$ROOT_DIR/.env.docker.example"
APPHOST_OUTPUT_DIR="$ROOT_DIR/.aspire-output/docker-compose"
APPHOST_COMPOSE_FILE=""
if [[ -f "$APPHOST_OUTPUT_DIR/docker-compose.yaml" ]]; then
  APPHOST_COMPOSE_FILE="$APPHOST_OUTPUT_DIR/docker-compose.yaml"
elif [[ -f "$APPHOST_OUTPUT_DIR/docker-compose.yml" ]]; then
  APPHOST_COMPOSE_FILE="$APPHOST_OUTPUT_DIR/docker-compose.yml"
fi
APPHOST_COMPOSE_ENV_FILE="$APPHOST_OUTPUT_DIR/.env.Production"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE. Update passwords and ports if needed."
fi

recreate_compose_services_if_present() {
  local description="$1"
  local compose_file="$2"
  local env_file="${3:-}"
  shift 3
  local services=("$@")

  [[ -f "$compose_file" ]] || return 0

  echo "Recreating existing $description services: ${services[*]}..."

  if [[ -n "$env_file" && -f "$env_file" ]]; then
    docker compose --env-file "$env_file" -f "$compose_file" rm -f -s "${services[@]}" || \
      echo "Skipping cleanup issue: docker compose rm for $description"
    return 0
  fi

  docker compose -f "$compose_file" rm -f -s "${services[@]}" || \
    echo "Skipping cleanup issue: docker compose rm for $description"
}

show_compose_diagnostics() {
  echo
  echo "Current compose status:"
  docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" ps -a || true

  for service in app dashboard postgres; do
    echo
    echo "Recent logs for $service:"
    docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" logs --tail 80 "$service" || true
  done
}

RECREATED_SERVICES=(app apphost-monitor dashboard)
if [[ -n "$APPHOST_COMPOSE_FILE" ]]; then
  recreate_compose_services_if_present "AppHost compose" "$APPHOST_COMPOSE_FILE" "$APPHOST_COMPOSE_ENV_FILE" "${RECREATED_SERVICES[@]}"
fi
recreate_compose_services_if_present "legacy compose" "$ROOT_DIR/docker-compose.yml" "$ENV_FILE" "${RECREATED_SERVICES[@]}"

if ! docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" up -d --build "${RECREATED_SERVICES[@]}"; then
  echo
  echo "docker compose up failed."
  echo "Collecting compose diagnostics..."
  show_compose_diagnostics
  echo
  echo "If postgres logs mention an incompatible data directory or old major version,"
  echo "set POSTGRES_IMAGE in .env.docker to the old version first, or run:"
  echo "  docker compose --env-file \"$ENV_FILE\" -f \"$ROOT_DIR/docker-compose.yml\" down -v"
  exit 1
fi

APP_PORT="$(grep '^APP_PORT=' "$ENV_FILE" | cut -d'=' -f2 || true)"
DASHBOARD_PORT="$(grep '^ASPIRE_DASHBOARD_PORT=' "$ENV_FILE" | cut -d'=' -f2 || true)"
DASHBOARD_TOKEN="$(grep '^ASPIRE_DASHBOARD_FRONTEND_TOKEN=' "$ENV_FILE" | cut -d'=' -f2 || true)"

echo
echo "Docker services are up."
echo "App URL: http://localhost:${APP_PORT:-5516}"
echo "Aspire Dashboard: http://localhost:${DASHBOARD_PORT:-18888}/login?t=${DASHBOARD_TOKEN:-lies-dashboard-local}"
echo "Logs: docker compose --env-file \"$ENV_FILE\" -f \"$ROOT_DIR/docker-compose.yml\" logs -f app"
