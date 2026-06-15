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

refresh_apphost_compose_file() {
  if [[ -f "$OUTPUT_DIR/docker-compose.yaml" ]]; then
    APPHOST_COMPOSE_FILE="$OUTPUT_DIR/docker-compose.yaml"
  elif [[ -f "$OUTPUT_DIR/docker-compose.yml" ]]; then
    APPHOST_COMPOSE_FILE="$OUTPUT_DIR/docker-compose.yml"
  else
    APPHOST_COMPOSE_FILE=""
  fi
}

pull_docker_image_with_retry() {
  local image="$1"
  local max_attempts="${2:-3}"
  local attempt

  [[ -n "$image" ]] || return 0

  for ((attempt=1; attempt<=max_attempts; attempt++)); do
    if docker pull "$image"; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "Unable to pull Docker image '$image' after $max_attempts attempts." >&2
      return 1
    fi

    echo "Retrying Docker image pull for $image ($attempt/$max_attempts failed)..."
    sleep 5
  done
}

normalize_path() {
  local path="${1:-}"
  path="${path%/}"
  printf '%s' "$path"
}

contains_array_value() {
  local needle="$1"
  shift || true
  local value
  for value in "$@"; do
    if [[ "$value" == "$needle" ]]; then
      return 0
    fi
  done

  return 1
}

get_compose_project_candidates() {
  local configured_project_name="${1:-}"
  local root_leaf
  root_leaf="$(basename "$ROOT_DIR")"

  local candidates=()
  local candidate
  for candidate in "$configured_project_name" "lies" "$root_leaf"; do
    [[ -n "$candidate" ]] || continue
    if ! contains_array_value "$candidate" "${candidates[@]}"; then
      candidates+=("$candidate")
    fi
  done

  printf '%s\n' "${candidates[@]}"
}

container_name_matches() {
  local container_name="$1"
  shift || true
  local service_name
  for service_name in "$@"; do
    [[ -n "$service_name" ]] || continue
    if [[ "$container_name" =~ (^|[-_])${service_name}([-_][0-9]+)?$ ]]; then
      return 0
    fi
  done

  return 1
}

container_port_matches() {
  local published_ports="$1"
  shift || true
  local host_port
  for host_port in "$@"; do
    [[ -n "$host_port" && "$host_port" != "0" ]] || continue
    if [[ "$published_ports" =~ (^|[^0-9])${host_port}\-\> ]]; then
      return 0
    fi
  done

  return 1
}

remove_managed_compose_containers_if_present() {
  local description="$1"
  shift
  local services=("$@")
  local root_dir_normalized
  root_dir_normalized="$(normalize_path "$ROOT_DIR")"
  mapfile -t compose_project_candidates < <(get_compose_project_candidates "${Deployment__Docker__ComposeProjectName:-}")
  local managed_ports=("${Deployment__Docker__AppPort:-}" "${Deployment__Docker__DashboardPort:-}" "5516" "18888")

  local container_lines=()
  while IFS='|' read -r container_id container_name project_name service_name working_directory config_files published_ports; do
    [[ -n "$container_id" ]] || continue

    local matches_service_label=false
    if contains_array_value "$service_name" "${services[@]}"; then
      matches_service_label=true
    fi

    local matches_project=false
    if contains_array_value "$project_name" "${compose_project_candidates[@]}"; then
      matches_project=true
    fi

    local matches_aspire_project=false
    if [[ "$project_name" == aspire-* ]]; then
      matches_aspire_project=true
    fi

    local matches_root=false
    local normalized_working_directory
    normalized_working_directory="$(normalize_path "$working_directory")"
    if [[ -n "$normalized_working_directory" && "$normalized_working_directory" == "$root_dir_normalized" ]]; then
      matches_root=true
    fi

    local matches_config=false
    if [[ -n "$config_files" ]]; then
      IFS=',' read -r -a config_entries <<< "$config_files"
      local config_entry normalized_config_entry
      for config_entry in "${config_entries[@]}"; do
        normalized_config_entry="$(normalize_path "$config_entry")"
        if [[ -n "$normalized_config_entry" && ( "$normalized_config_entry" == "$root_dir_normalized" || "$normalized_config_entry" == "$root_dir_normalized/"* ) ]]; then
          matches_config=true
          break
        fi
      done
    fi

    local matches_container_name=false
    if container_name_matches "$container_name" "${services[@]}"; then
      matches_container_name=true
    fi

    local matches_published_ports=false
    if container_port_matches "$published_ports" "${managed_ports[@]}"; then
      matches_published_ports=true
    fi

    local matches_metadata=false
    if [[ "$matches_service_label" == true && ( "$matches_project" == true || "$matches_root" == true || "$matches_config" == true || "$matches_aspire_project" == true ) ]]; then
      matches_metadata=true
    fi

    local matches_fallback=false
    if [[ "$matches_container_name" == true && ( "$matches_aspire_project" == true || "$matches_published_ports" == true || "$matches_service_label" == true ) ]]; then
      matches_fallback=true
    fi
    if [[ "$matches_published_ports" == true && ( "$matches_container_name" == true || "$matches_aspire_project" == true || "$matches_service_label" == true ) ]]; then
      matches_fallback=true
    fi

    if [[ "$matches_metadata" == true || "$matches_fallback" == true ]]; then
      container_lines+=("$container_id|$container_name|$project_name|$service_name")
    fi
  done < <(docker ps -a --format '{{.ID}}|{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.service"}}|{{.Label "com.docker.compose.project.working_dir"}}|{{.Label "com.docker.compose.project.config_files"}}|{{.Ports}}' 2>/dev/null || true)

  (( ${#container_lines[@]} > 0 )) || return 0

  local descriptions=()
  local container_ids=()
  local line container_id container_name project_name service_name
  for line in "${container_lines[@]}"; do
    IFS='|' read -r container_id container_name project_name service_name <<< "$line"
    container_ids+=("$container_id")
    if [[ -n "$project_name" ]]; then
      descriptions+=("$container_name [$project_name/$service_name]")
    else
      descriptions+=("$container_name [$service_name]")
    fi
  done

  echo "Removing lingering $description containers: ${descriptions[*]}..."
  docker rm -f "${container_ids[@]}" || echo "Skipping cleanup issue: docker rm -f for lingering $description containers"
}

get_compose_services_from_containers() {
  local compose_file="$1"
  local env_file="${2:-}"
  local include_all="${3:-false}"
  shift 3 || true
  local statuses=("$@")

  [[ -f "$compose_file" ]] || return 0

  local compose_cmd=(docker compose)
  if [[ -n "$env_file" && -f "$env_file" ]]; then
    compose_cmd+=(--env-file "$env_file")
  fi
  compose_cmd+=(-f "$compose_file" ps --services)
  if [[ "$include_all" == "true" ]]; then
    compose_cmd+=(--all)
  fi
  for status in "${statuses[@]}"; do
    [[ -n "$status" ]] || continue
    compose_cmd+=(--status "$status")
  done

  "${compose_cmd[@]}" 2>/dev/null || true
}

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

  local existing_services=""
  existing_services="$(get_compose_services_from_containers "$compose_file" "$env_file" true)"
  local running_services=""
  running_services="$(get_compose_services_from_containers "$compose_file" "$env_file" false running restarting paused)"

  local present_services=()
  for service in "${services[@]}"; do
    if grep -qx "$service" <<< "$existing_services"; then
      present_services+=("$service")
    fi
  done

  (( ${#present_services[@]} > 0 )) || return 0

  echo "Restarting existing $description services: ${present_services[*]}..."

  local present_running_services=()
  for service in "${present_services[@]}"; do
    if grep -qx "$service" <<< "$running_services"; then
      present_running_services+=("$service")
    fi
  done

  if (( ${#present_running_services[@]} > 0 )); then
    echo "Stopping running $description services first: ${present_running_services[*]}..."

    if [[ -n "$env_file" && -f "$env_file" ]]; then
      docker compose --env-file "$env_file" -f "$compose_file" stop "${present_running_services[@]}" || \
        echo "Skipping cleanup issue: docker compose stop for $description"
    else
      docker compose -f "$compose_file" stop "${present_running_services[@]}" || \
        echo "Skipping cleanup issue: docker compose stop for $description"
    fi
  fi

  if [[ -n "$env_file" && -f "$env_file" ]]; then
    docker compose --env-file "$env_file" -f "$compose_file" rm -f "${present_services[@]}" || \
      echo "Skipping cleanup issue: docker compose rm for $description"
    return 0
  fi

  docker compose -f "$compose_file" rm -f "${present_services[@]}" || \
    echo "Skipping cleanup issue: docker compose rm for $description"
}

remove_stopped_compose_services_if_present() {
  local description="$1"
  local compose_file="$2"
  local env_file="${3:-}"
  shift 3
  local services=("$@")

  [[ -f "$compose_file" ]] || return 0

  local existing_services=""
  existing_services="$(get_compose_services_from_containers "$compose_file" "$env_file" true created exited dead)"

  local present_services=()
  for service in "${services[@]}"; do
    if grep -qx "$service" <<< "$existing_services"; then
      present_services+=("$service")
    fi
  done

  (( ${#present_services[@]} > 0 )) || return 0

  echo "Removing stopped $description services if present: ${present_services[*]}..."

  if [[ -n "$env_file" && -f "$env_file" ]]; then
    docker compose --env-file "$env_file" -f "$compose_file" rm -f "${present_services[@]}" || \
      echo "Skipping cleanup issue: docker compose rm stopped services for $description"
    return 0
  fi

  docker compose -f "$compose_file" rm -f "${present_services[@]}" || \
    echo "Skipping cleanup issue: docker compose rm stopped services for $description"
}

STALE_SERVICES=(postgres redis app lies-app apphost-monitor lies-apphost-monitor dashboard compose-dashboard lies-compose-dashboard)
RESTART_SERVICES=(app lies-app apphost-monitor lies-apphost-monitor dashboard compose-dashboard lies-compose-dashboard)
FRONTEND_BUILD_IMAGE="${Deployment__Docker__FrontendBuildImage:-mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm}"
remove_managed_compose_containers_if_present "workspace non-data" "${RESTART_SERVICES[@]}"
echo "Pre-pulling frontend build image: $FRONTEND_BUILD_IMAGE"
pull_docker_image_with_retry "$FRONTEND_BUILD_IMAGE"
remove_stopped_compose_services_if_present "legacy compose" "$LEGACY_COMPOSE_FILE" "$LEGACY_ENV_FILE" "${STALE_SERVICES[@]}"
recreate_compose_services_if_present "legacy compose" "$LEGACY_COMPOSE_FILE" "$LEGACY_ENV_FILE" "${RESTART_SERVICES[@]}"
if [[ -n "$APPHOST_COMPOSE_FILE" ]]; then
  remove_stopped_compose_services_if_present "AppHost compose" "$APPHOST_COMPOSE_FILE" "$APPHOST_COMPOSE_ENV_FILE" "${STALE_SERVICES[@]}"
  recreate_compose_services_if_present "AppHost compose" "$APPHOST_COMPOSE_FILE" "$APPHOST_COMPOSE_ENV_FILE" "${RESTART_SERVICES[@]}"
fi

export LIES_APPHOST_DISABLE_DASHBOARD=true
aspire deploy --apphost "$APPHOST_PROJECT" --output-path "$OUTPUT_DIR" --non-interactive

echo
echo "Aspire Docker deployment is up."
echo "App URL: http://localhost:${Deployment__Docker__AppPort:-5516}"
if [[ "${Deployment__Docker__DashboardPort:-18888}" != "0" ]]; then
  echo "Aspire Dashboard: http://localhost:${Deployment__Docker__DashboardPort:-18888}"
fi
echo "Artifacts: $OUTPUT_DIR"
echo "Stop with: aspire destroy --apphost \"$APPHOST_PROJECT\" --output-path \"$OUTPUT_DIR\" --non-interactive"
