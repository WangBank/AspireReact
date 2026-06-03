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

function Show-ComposeDiagnostics {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string]$ComposeFile
    )

    Write-Host ""
    Write-Host "Current compose status:"
    docker compose --env-file $EnvFile -f $ComposeFile ps -a

    foreach ($service in @("app", "dashboard", "postgres")) {
        Write-Host ""
        Write-Host "Recent logs for ${service}:"
        docker compose --env-file $EnvFile -f $ComposeFile logs --tail 80 $service
    }
}

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ExampleFile = Join-Path $RootDir ".env.docker.example"
$ComposeFile = Join-Path $RootDir "docker-compose.yml"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleFile $EnvFile
    Write-Host "Created $EnvFile. Update passwords and ports if needed."
}

try {
    Invoke-NativeCommand {
        docker compose --env-file $EnvFile -f $ComposeFile up -d --build
    } "docker compose up failed."
}
catch {
    Write-Host ""
    Write-Host "docker compose up failed."
    Write-Host "Collecting compose diagnostics..."
    Show-ComposeDiagnostics -EnvFile $EnvFile -ComposeFile $ComposeFile
    Write-Host ""
    Write-Host "If postgres logs mention an incompatible data directory or old major version,"
    Write-Host "set POSTGRES_IMAGE in .env.docker to the old version first, or run:"
    Write-Host "  docker compose --env-file $EnvFile -f $ComposeFile down -v"
    throw
}

$AppPort = "5516"
$DashboardPort = "18888"
$DashboardToken = "lies-dashboard-local"
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^APP_PORT=(.+)$') {
        $AppPort = $Matches[1]
    }
    if ($_ -match '^ASPIRE_DASHBOARD_PORT=(.+)$') {
        $DashboardPort = $Matches[1]
    }
    if ($_ -match '^ASPIRE_DASHBOARD_FRONTEND_TOKEN=(.+)$') {
        $DashboardToken = $Matches[1]
    }
}

Write-Host ""
Write-Host "Docker services are up."
Write-Host "App URL: http://localhost:$AppPort"
Write-Host "Aspire Dashboard: http://localhost:$DashboardPort/login?t=$DashboardToken"
Write-Host "Logs: docker compose --env-file '$EnvFile' -f '$ComposeFile' logs -f app"
