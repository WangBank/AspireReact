$ErrorActionPreference = "Stop"

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage Exit code: $LASTEXITCODE"
    }
}

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ComposeFile = Join-Path $RootDir "docker-compose.yml"

if (-not (Test-Path $EnvFile)) {
    Write-Host "$EnvFile not found. Falling back to .env.docker.example."
    $EnvFile = Join-Path $RootDir ".env.docker.example"
}

Invoke-NativeCommand {
    docker compose --env-file $EnvFile -f $ComposeFile down
} "docker compose down failed."
