$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ExampleFile = Join-Path $RootDir ".env.docker.example"
$ComposeFile = Join-Path $RootDir "docker-compose.yml"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleFile $EnvFile
    Write-Host "Created $EnvFile. Update passwords and ports if needed."
}

docker compose --env-file $EnvFile -f $ComposeFile up -d --build

$AppPort = "5516"
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^APP_PORT=(.+)$') {
        $AppPort = $Matches[1]
    }
}

Write-Host ""
Write-Host "Docker services are up."
Write-Host "App URL: http://localhost:$AppPort"
Write-Host "Logs: docker compose --env-file '$EnvFile' -f '$ComposeFile' logs -f app"
