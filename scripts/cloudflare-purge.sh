#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-${CLOUDFLARE_BASE_URL:-}}"
ZONE_ID="${ZONE_ID:-${CLOUDFLARE_ZONE_ID:-}}"
API_TOKEN="${API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
EXTRA_URLS="${EXTRA_URLS:-${CLOUDFLARE_EXTRA_PURGE_URLS:-}}"
PURGE_EVERYTHING="${PURGE_EVERYTHING:-${CLOUDFLARE_PURGE_EVERYTHING:-false}}"
SKIP_VALIDATION=false

while (($# > 0)); do
  case "$1" in
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
    --purge-everything)
      PURGE_EVERYTHING=true
      shift
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.aspire-docker"
EXAMPLE_FILE="$ROOT_DIR/.env.aspire-docker.example"

if [[ ! -f "$ENV_FILE" && -f "$EXAMPLE_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE. Fill in the Cloudflare values before running again."
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BASE_URL="${BASE_URL:-${CLOUDFLARE_BASE_URL:-}}"
ZONE_ID="${ZONE_ID:-${CLOUDFLARE_ZONE_ID:-}}"
API_TOKEN="${API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
EXTRA_URLS="${EXTRA_URLS:-${CLOUDFLARE_EXTRA_PURGE_URLS:-}}"
PURGE_EVERYTHING="${PURGE_EVERYTHING:-${CLOUDFLARE_PURGE_EVERYTHING:-false}}"

if [[ -z "$BASE_URL" ]]; then
  echo "Missing Cloudflare base URL. Set CLOUDFLARE_BASE_URL in .env.aspire-docker or pass --base-url."
  exit 1
fi
if [[ -z "$ZONE_ID" ]]; then
  echo "Missing Cloudflare zone id. Set CLOUDFLARE_ZONE_ID in .env.aspire-docker or pass --zone-id."
  exit 1
fi
if [[ -z "$API_TOKEN" ]]; then
  echo "Missing Cloudflare API token. Set CLOUDFLARE_API_TOKEN in .env.aspire-docker or pass --api-token."
  exit 1
fi

BASE_URL="${BASE_URL%/}"
if [[ "$BASE_URL" != http://* && "$BASE_URL" != https://* ]]; then
  echo "CLOUDFLARE_BASE_URL must start with http:// or https://. Current value: $BASE_URL"
  exit 1
fi

normalize_url() {
  local value="$1"
  value="$(echo "$value" | xargs)"
  [[ -n "$value" ]] || return 0

  if [[ "$value" == http://* || "$value" == https://* ]]; then
    echo "$value"
    return 0
  fi

  if [[ "$value" != /* ]]; then
    value="/$value"
  fi

  echo "$BASE_URL$value"
}

show_headers() {
  local url="$1"
  echo "$url"
  if ! curl -fsSI "$url"; then
    echo "  Header check failed"
  fi
}

if [[ "${PURGE_EVERYTHING,,}" == "true" || "${PURGE_EVERYTHING,,}" == "1" || "${PURGE_EVERYTHING,,}" == "yes" || "${PURGE_EVERYTHING,,}" == "on" ]]; then
  echo "Purging entire Cloudflare zone for $BASE_URL ..."
  payload='{"purge_everything":true}'
else
  default_values=(
    "/"
    "/index.html"
    "/manifest.webmanifest"
    "/sw.js"
    "/registerSW.js"
    "/dashboard"
    "/statistics"
    "/entry/unified"
    "/list/unified"
    "/profile"
    "/admin"
  )

  declare -a purge_urls=()
  for value in "${default_values[@]}"; do
    purge_urls+=("$(normalize_url "$value")")
  done

  if [[ -n "$EXTRA_URLS" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      purge_urls+=("$(normalize_url "$line")")
    done < <(echo "$EXTRA_URLS" | tr ',' '\n')
  fi

  mapfile -t unique_urls < <(printf '%s\n' "${purge_urls[@]}" | awk 'NF { if (!seen[$0]++) print $0 }')

  echo "Purging Cloudflare URLs:"
  for url in "${unique_urls[@]}"; do
    echo "  $url"
  done

  json_urls="$(printf '%s\n' "${unique_urls[@]}" | sed 's/"/\\"/g' | awk 'BEGIN { printf "[" } { if (NR > 1) printf ","; printf "\"%s\"", $0 } END { printf "]" }')"
  payload="{\"files\":$json_urls}"
fi

response_file="$(mktemp)"
http_code="$(
  curl -sS -o "$response_file" -w '%{http_code}' \
    -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$payload"
)"

if [[ "$http_code" != "200" ]] || ! grep -q '"success":true' "$response_file"; then
  echo "Cloudflare purge failed:"
  cat "$response_file"
  rm -f "$response_file"
  exit 1
fi

rm -f "$response_file"
echo "Cloudflare cache purge completed."

if [[ "$SKIP_VALIDATION" != "true" ]]; then
  echo
  echo "Post-purge header check:"
  show_headers "$BASE_URL/sw.js"
  show_headers "$BASE_URL/manifest.webmanifest"
fi
