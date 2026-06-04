#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPHOST_PROJECT="$ROOT_DIR/Lies.AppHost/Lies.AppHost.csproj"
ENV_FILE="$ROOT_DIR/.env.aspire-docker"
EXAMPLE_FILE="$ROOT_DIR/.env.aspire-docker.example"
OUTPUT_DIR="$ROOT_DIR/.aspire-output/docker-compose"
LEGACY_ENV_FILE=""
if [[ -f "$ROOT_DIR/.env.docker" ]]; then
  LEGACY_ENV_FILE="$ROOT_DIR/.env.docker"
elif [[ -f "$ROOT_DIR/.env.docker.example" ]]; then
  LEGACY_ENV_FILE="$ROOT_DIR/.env.docker.example"
fi
LEGACY_COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
APPHOST_COMPOSE_FILE=""
if [[ -f "$OUTPUT_DIR/docker-compose.yaml" ]]; then
  APPHOST_COMPOSE_FILE="$OUTPUT_DIR/docker-compose.yaml"
elif [[ -f "$OUTPUT_DIR/docker-compose.yml" ]]; then
  APPHOST_COMPOSE_FILE="$OUTPUT_DIR/docker-compose.yml"
fi
APPHOST_COMPOSE_ENV_FILE="$OUTPUT_DIR/.env.Production"

if ! command -v aspire >/dev/null 2>&1; then
  echo "The aspire CLI is required."
  echo "Install it with: dotnet tool install --global Aspire.Cli --prerelease"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE. Update passwords, ports, and tokens if needed."
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$OUTPUT_DIR"

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

RECREATED_SERVICES=(app apphost-monitor dashboard)
recreate_compose_services_if_present "legacy compose" "$LEGACY_COMPOSE_FILE" "$LEGACY_ENV_FILE" "${RECREATED_SERVICES[@]}"
if [[ -n "$APPHOST_COMPOSE_FILE" ]]; then
  recreate_compose_services_if_present "AppHost compose" "$APPHOST_COMPOSE_FILE" "$APPHOST_COMPOSE_ENV_FILE" "${RECREATED_SERVICES[@]}"
fi

aspire deploy --apphost "$APPHOST_PROJECT" --output-path "$OUTPUT_DIR" --non-interactive

echo
echo "Aspire Docker deployment is up."
echo "App URL: http://localhost:${Deployment__Docker__AppPort:-5516}"
if [[ "${Deployment__Docker__DashboardPort:-18888}" != "0" ]]; then
  echo "Aspire Dashboard: http://localhost:${Deployment__Docker__DashboardPort:-18888}/login?t=${Parameters__dashboardToken:-lies-dashboard-local}"
fi
echo "Artifacts: $OUTPUT_DIR"
echo "Stop with: aspire destroy --apphost \"$APPHOST_PROJECT\" --output-path \"$OUTPUT_DIR\" --non-interactive"
