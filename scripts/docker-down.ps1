$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ComposeFile = Join-Path $RootDir "docker-compose.yml"

if (-not (Test-Path $EnvFile)) {
    Write-Host "$EnvFile not found. Falling back to .env.docker.example."
    $EnvFile = Join-Path $RootDir ".env.docker.example"
}

docker compose --env-file $EnvFile -f $ComposeFile down
