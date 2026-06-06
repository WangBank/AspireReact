#!/usr/bin/env bash
set -euo pipefail

SKIP_PURGE=false
PURGE_EVERYTHING=false
SKIP_VALIDATION=false
BASE_URL=""
ZONE_ID=""
API_TOKEN=""
EXTRA_URLS=""

while (($# > 0)); do
  case "$1" in
    --skip-purge)
      SKIP_PURGE=true
      shift
      ;;
    --purge-everything)
      PURGE_EVERYTHING=true
      shift
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --zone-id)
      ZONE_ID="${2:-}"
      shift 2
      ;;
    --api-token)
      API_TOKEN="${2:-}"
      shift 2
      ;;
    --extra-urls)
      EXTRA_URLS="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/aspire-docker-up.sh"
PURGE_SCRIPT="$SCRIPT_DIR/cloudflare-purge.sh"

echo "Step 1/2: Deploying production stack..."
bash "$DEPLOY_SCRIPT"

if [[ "$SKIP_PURGE" == "true" ]]; then
  echo
  echo "Step 2/2: Cloudflare purge skipped."
  exit 0
fi

declare -a purge_args=()
if [[ "$PURGE_EVERYTHING" == "true" ]]; then
  purge_args+=(--purge-everything)
fi
if [[ "$SKIP_VALIDATION" == "true" ]]; then
  purge_args+=(--skip-validation)
fi
if [[ -n "$BASE_URL" ]]; then
  purge_args+=(--base-url "$BASE_URL")
fi
if [[ -n "$ZONE_ID" ]]; then
  purge_args+=(--zone-id "$ZONE_ID")
fi
if [[ -n "$API_TOKEN" ]]; then
  purge_args+=(--api-token "$API_TOKEN")
fi
if [[ -n "$EXTRA_URLS" ]]; then
  purge_args+=(--extra-urls "$EXTRA_URLS")
fi

echo
echo "Step 2/2: Purging Cloudflare cache..."
bash "$PURGE_SCRIPT" "${purge_args[@]}"
