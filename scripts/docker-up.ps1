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

function Invoke-BestEffortNativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,

        [Parameter(Mandatory = $true)]
        [string]$ActionDescription
    )

    & $Command

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Skipping cleanup issue: $ActionDescription (exit code: $LASTEXITCODE)"
        $global:LASTEXITCODE = 0
    }
}

function Pull-DockerImageWithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Image,

        [int]$MaxAttempts = 3
    )

    if ([string]::IsNullOrWhiteSpace($Image)) {
        return
    }

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        & docker pull $Image
        if ($LASTEXITCODE -eq 0) {
            return
        }

        if ($attempt -eq $MaxAttempts) {
            throw "Unable to pull Docker image '$Image' after $MaxAttempts attempts. Exit code: $LASTEXITCODE"
        }

        Write-Host "Retrying Docker image pull for $Image ($attempt/$MaxAttempts failed)..."
        Start-Sleep -Seconds 5
    }
}

function Get-FirstExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Paths
    )

    return $Paths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Recreate-ComposeServicesIfPresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,

        [Parameter(Mandatory = $true)]
        [string]$ComposeFile,

        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string[]]$Services
    )

    if (-not (Test-Path $ComposeFile)) {
        return
    }

    Write-Host "Recreating existing $Description services: $($Services -join ', ')..."

    if (-not [string]::IsNullOrWhiteSpace($EnvFile) -and (Test-Path $EnvFile)) {
        Invoke-BestEffortNativeCommand {
            docker compose --env-file $EnvFile -f $ComposeFile rm -f -s $Services
        } "docker compose rm for $Description"
        return
    }

    Invoke-BestEffortNativeCommand {
        docker compose -f $ComposeFile rm -f -s $Services
    } "docker compose rm for $Description"
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

    foreach ($service in @("lies-app", "lies-apphost-monitor", "postgres")) {
        Write-Host ""
        Write-Host "Recent logs for ${service}:"
        docker compose --env-file $EnvFile -f $ComposeFile logs --tail 80 $service
    }
}

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ExampleFile = Join-Path $RootDir ".env.docker.example"
$ComposeFile = Join-Path $RootDir "docker-compose.yml"
$AppHostOutputDir = Join-Path $RootDir ".aspire-output/docker-compose"
$AppHostComposeFile = Get-FirstExistingPath @(
    (Join-Path $AppHostOutputDir "docker-compose.yaml"),
    (Join-Path $AppHostOutputDir "docker-compose.yml")
)
$AppHostComposeEnvFile = Join-Path $AppHostOutputDir ".env.Production"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleFile $EnvFile
    Write-Host "Created $EnvFile. Update passwords and ports if needed."
}

$frontendBuildImage = "mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm"
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^FRONTEND_BUILD_IMAGE=(.+)$') {
        $frontendBuildImage = $Matches[1]
    }
}

Write-Host "Pre-pulling frontend build image: $frontendBuildImage"
Pull-DockerImageWithRetry -Image $frontendBuildImage

$cleanupServices = @("app", "lies-app", "apphost-monitor", "lies-apphost-monitor", "dashboard")
$coreServices = @("lies-app")
$monitorServices = @("lies-apphost-monitor")
if (-not [string]::IsNullOrWhiteSpace($AppHostComposeFile)) {
    Recreate-ComposeServicesIfPresent -Description "AppHost compose" -ComposeFile $AppHostComposeFile -EnvFile $AppHostComposeEnvFile -Services $cleanupServices
}
Recreate-ComposeServicesIfPresent -Description "legacy compose" -ComposeFile $ComposeFile -EnvFile $EnvFile -Services $cleanupServices

try {
    Invoke-NativeCommand {
        docker compose --env-file $EnvFile -f $ComposeFile up -d --build $coreServices
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

Invoke-BestEffortNativeCommand {
    docker compose --env-file $EnvFile -f $ComposeFile up -d --build $monitorServices
} "optional lies-apphost-monitor startup"

$AppPort = "5516"
$DashboardPort = "18888"
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^APP_PORT=(.+)$') {
        $AppPort = $Matches[1]
    }
    if ($_ -match '^ASPIRE_DASHBOARD_PORT=(.+)$') {
        $DashboardPort = $Matches[1]
    }
}

Write-Host ""
Write-Host "Docker services are up."
Write-Host "App URL: http://localhost:$AppPort"
Write-Host "Aspire Dashboard: http://localhost:$DashboardPort"
Write-Host "Logs: docker compose --env-file '$EnvFile' -f '$ComposeFile' logs -f lies-app"
