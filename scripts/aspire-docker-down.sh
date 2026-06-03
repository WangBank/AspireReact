#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPHOST_PROJECT="$ROOT_DIR/Lies.AppHost/Lies.AppHost.csproj"
OUTPUT_DIR="$ROOT_DIR/.aspire-output/docker-compose"

if ! command -v aspire >/dev/null 2>&1; then
  echo "The aspire CLI is required."
  echo "Install it with: dotnet tool install --global Aspire.Cli --prerelease"
  exit 1
fi

aspire destroy --apphost "$APPHOST_PROJECT" --output-path "$OUTPUT_DIR" --non-interactive --yes

echo
echo "Aspire Docker deployment is down."
echo "Artifacts kept at: $OUTPUT_DIR"
