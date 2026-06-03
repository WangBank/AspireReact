$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ExampleFile = Join-Path $RootDir ".env.docker.example"
$ComposeFile = Join-Path $RootDir "docker-compose.yml"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleFile $EnvFile
    Write-Host "Created $EnvFile. Update passwords and ports if needed."
}

try {
    docker compose --env-file $EnvFile -f $ComposeFile up -d --build
}
catch {
    Write-Host ""
    Write-Host "docker compose up failed."
    Write-Host "Trying to show postgres logs for diagnosis..."
    Write-Host ""
    docker compose --env-file $EnvFile -f $ComposeFile logs postgres
    Write-Host ""
    Write-Host "Common cause: an existing postgres data volume was created by another major version."
    Write-Host "If you need the old data, set POSTGRES_IMAGE in .env.docker to the old major version first."
    Write-Host "If you do not need the old data, run: docker compose --env-file $EnvFile -f $ComposeFile down -v"
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
