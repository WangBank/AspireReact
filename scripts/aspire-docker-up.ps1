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

function Ensure-AppHostComposeStackRunning {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComposeFile,

        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string[]]$Services
    )

    if (-not (Test-Path $ComposeFile)) {
        throw "Generated AppHost compose file was not found: $ComposeFile"
    }

    $composeArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($EnvFile) -and (Test-Path $EnvFile)) {
        $composeArgs += @("--env-file", $EnvFile)
    }
    $composeArgs += @("-f", $ComposeFile)

    $runningServices = @()
    try {
        $runningServices = @(docker compose @composeArgs ps --services --status running 2>$null)
        $global:LASTEXITCODE = 0
    }
    catch {
        $runningServices = @()
        $global:LASTEXITCODE = 0
    }

    $missingServices = @($Services | Where-Object { $_ -notin $runningServices })
    if ($missingServices.Count -gt 0) {
        Write-Host "No running generated AppHost services detected for: $($missingServices -join ', ')"
        Write-Host "Starting generated Docker Compose stack..."
        Invoke-NativeCommand {
            docker compose @composeArgs up -d --build $Services
        } "Generated AppHost docker compose up failed."
    }

    Write-Host "Generated AppHost stack status:"
    Invoke-BestEffortNativeCommand {
        docker compose @composeArgs ps
    } "docker compose ps for generated AppHost stack"
}

$RootDir = Split-Path -Parent $PSScriptRoot
$AppHostProject = Join-Path $RootDir "Lies.AppHost/Lies.AppHost.csproj"
$EnvFile = Join-Path $RootDir ".env.aspire-docker"
$ExampleFile = Join-Path $RootDir ".env.aspire-docker.example"
$OutputDir = Join-Path $RootDir ".aspire-output/docker-compose"
$LegacyEnvFile = Get-FirstExistingPath @(
    (Join-Path $RootDir ".env.docker"),
    (Join-Path $RootDir ".env.docker.example")
)
$LegacyComposeFile = Join-Path $RootDir "docker-compose.yml"
$AppHostComposeFile = Get-FirstExistingPath @(
    (Join-Path $OutputDir "docker-compose.yaml"),
    (Join-Path $OutputDir "docker-compose.yml")
)
$AppHostComposeEnvFile = Join-Path $OutputDir ".env.Production"

if (-not (Get-Command aspire -ErrorAction SilentlyContinue)) {
    Write-Host "The aspire CLI is required."
    Write-Host "Install it with: dotnet tool install --global Aspire.Cli --prerelease"
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleFile $EnvFile
    Write-Host "Created $EnvFile. Update passwords, ports, and tokens if needed."
}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
        return
    }

    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
    }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$cleanupServices = @("app", "apphost-monitor", "dashboard")
$requiredServices = @("app", "apphost-monitor")
Recreate-ComposeServicesIfPresent -Description "legacy compose" -ComposeFile $LegacyComposeFile -EnvFile $LegacyEnvFile -Services $cleanupServices
if (-not [string]::IsNullOrWhiteSpace($AppHostComposeFile)) {
    Recreate-ComposeServicesIfPresent -Description "AppHost compose" -ComposeFile $AppHostComposeFile -EnvFile $AppHostComposeEnvFile -Services $cleanupServices
}

try {
    Invoke-NativeCommand {
        aspire deploy --apphost $AppHostProject --output-path $OutputDir --non-interactive
    } "Aspire Docker deployment failed."
}
catch {
    Write-Host ""
    Write-Host "Aspire Docker deployment failed."
    Write-Host "If the error mentions a container name conflict or a port already in use,"
    Write-Host "stop the old stack first:"
    Write-Host "  AppHost stack: powershell -ExecutionPolicy Bypass -File .\scripts\aspire-docker-down.ps1"
    Write-Host "  Legacy compose stack: powershell -ExecutionPolicy Bypass -File .\scripts\docker-down.ps1"
    throw
}

$AppHostComposeFile = Get-FirstExistingPath @(
    (Join-Path $OutputDir "docker-compose.yaml"),
    (Join-Path $OutputDir "docker-compose.yml")
)

Ensure-AppHostComposeStackRunning -ComposeFile $AppHostComposeFile -EnvFile $AppHostComposeEnvFile -Services $requiredServices

$AppPort = [System.Environment]::GetEnvironmentVariable("Deployment__Docker__AppPort", "Process")
if ([string]::IsNullOrWhiteSpace($AppPort)) {
    $AppPort = "5516"
}

$DashboardPort = [System.Environment]::GetEnvironmentVariable("Deployment__Docker__DashboardPort", "Process")
if ([string]::IsNullOrWhiteSpace($DashboardPort)) {
    $DashboardPort = "18888"
}

Write-Host ""
Write-Host "Aspire Docker deployment is up."
Write-Host "App URL: http://localhost:$AppPort"
if ($DashboardPort -ne "0") {
    Write-Host "Aspire Dashboard: http://localhost:$DashboardPort"
}
Write-Host "Artifacts: $OutputDir"
Write-Host "Stop with: aspire destroy --apphost '$AppHostProject' --output-path '$OutputDir' --non-interactive"
