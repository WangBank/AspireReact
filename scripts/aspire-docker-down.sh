#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPHOST_PROJECT="$ROOT_DIR/Lies.AppHost/Lies.AppHost.csproj"
OUTPUT_DIR="$ROOT_DIR/.aspire-output/docker-compose"
ENV_FILE="$ROOT_DIR/.env.aspire-docker"

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
  local root_dir_normalized
  root_dir_normalized="$(normalize_path "$ROOT_DIR")"
  local managed_services=(app lies-app apphost-monitor lies-apphost-monitor dashboard compose-dashboard lies-compose-dashboard)
  mapfile -t compose_project_candidates < <(get_compose_project_candidates "${Deployment__Docker__ComposeProjectName:-}")
  local managed_ports=("${Deployment__Docker__AppPort:-}" "${Deployment__Docker__DashboardPort:-}" "5516" "18888")

  local container_lines=()
  while IFS='|' read -r container_id container_name project_name service_name working_directory config_files published_ports; do
    [[ -n "$container_id" ]] || continue

    local matches_service_label=false
    if contains_array_value "$service_name" "${managed_services[@]}"; then
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
    if container_name_matches "$container_name" "${managed_services[@]}"; then
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

  echo "Removing lingering workspace non-data containers: ${descriptions[*]}..."
  docker rm -f "${container_ids[@]}" >/dev/null 2>&1 || true
}

if ! command -v aspire >/dev/null 2>&1; then
  echo "The aspire CLI is required."
  echo "Install it with: dotnet tool install --global Aspire.Cli --prerelease"
  exit 1
fi

aspire destroy --apphost "$APPHOST_PROJECT" --output-path "$OUTPUT_DIR" --non-interactive --yes

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

remove_managed_compose_containers_if_present

echo
echo "Aspire Docker deployment is down."
echo "Artifacts kept at: $OUTPUT_DIR"
