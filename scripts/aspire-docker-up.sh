#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPHOST_PROJECT="$ROOT_DIR/Lies.AppHost/Lies.AppHost.csproj"
ENV_FILE="$ROOT_DIR/.env.aspire-docker"
EXAMPLE_FILE="$ROOT_DIR/.env.aspire-docker.example"
OUTPUT_DIR="$ROOT_DIR/.aspire-output/docker-compose"

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

aspire deploy --apphost "$APPHOST_PROJECT" --output-path "$OUTPUT_DIR" --non-interactive

echo
echo "Aspire Docker deployment is up."
echo "App URL: http://localhost:${Deployment__Docker__AppPort:-5516}"
if [[ "${Deployment__Docker__DashboardPort:-18888}" != "0" ]]; then
  echo "Aspire Dashboard: http://localhost:${Deployment__Docker__DashboardPort:-18888}/login?t=${Parameters__dashboardToken:-lies-dashboard-local}"
fi
echo "Artifacts: $OUTPUT_DIR"
echo "Stop with: aspire destroy --apphost \"$APPHOST_PROJECT\" --output-path \"$OUTPUT_DIR\" --non-interactive"
