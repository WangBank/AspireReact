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

function Normalize-PathValue {
    param(
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    try {
        return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
    }
    catch {
        return $Path.Trim().TrimEnd('\', '/')
    }
}

function Get-ComposeProjectCandidates {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootDir,

        [string]$ConfiguredProjectName
    )

    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($candidate in @($ConfiguredProjectName, "lies", (Split-Path $RootDir -Leaf))) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and -not $candidates.Contains($candidate)) {
            [void]$candidates.Add($candidate)
        }
    }

    return $candidates.ToArray()
}

function Test-ContainerNameMatch {
    param(
        [string]$ContainerName,

        [string[]]$ServiceNames
    )

    foreach ($serviceName in $ServiceNames) {
        if ([string]::IsNullOrWhiteSpace($serviceName)) {
            continue
        }

        $escapedServiceName = [System.Text.RegularExpressions.Regex]::Escape($serviceName)
        if ($ContainerName -match "(^|[-_])$escapedServiceName([-_]\d+)?$") {
            return $true
        }
    }

    return $false
}

function Test-ContainerPortMatch {
    param(
        [string]$PublishedPorts,

        [string[]]$HostPorts
    )

    foreach ($hostPort in $HostPorts) {
        if ([string]::IsNullOrWhiteSpace($hostPort)) {
            continue
        }

        $escapedHostPort = [System.Text.RegularExpressions.Regex]::Escape($hostPort)
        if ($PublishedPorts -match "(^|[^0-9])$escapedHostPort->") {
            return $true
        }
    }

    return $false
}

function Get-ManagedComposeContainers {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootDir,

        [Parameter(Mandatory = $true)]
        [string[]]$Services,

        [string[]]$ProjectNames = @(),

        [string[]]$HostPorts = @()
    )

    $rootDirNormalized = Normalize-PathValue $RootDir

    try {
        $rawContainers = @(
            docker ps -a --format '{{.ID}}|{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.service"}}|{{.Label "com.docker.compose.project.working_dir"}}|{{.Label "com.docker.compose.project.config_files"}}|{{.Ports}}' 2>$null
        )
        $global:LASTEXITCODE = 0
    }
    catch {
        $global:LASTEXITCODE = 0
        return @()
    }

    $containers = foreach ($line in $rawContainers) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $parts = $line -split '\|', 7
        if ($parts.Length -lt 7) {
            continue
        }

        $containerId = $parts[0]
        $containerName = $parts[1]
        $projectName = $parts[2]
        $serviceName = $parts[3]
        $workingDirectory = $parts[4]
        $configFiles = $parts[5]
        $publishedPorts = $parts[6]

        $matchesServiceLabel = $serviceName -in $Services

        $normalizedWorkingDirectory = Normalize-PathValue $workingDirectory
        $matchesRootDirectory = -not [string]::IsNullOrWhiteSpace($normalizedWorkingDirectory) -and $normalizedWorkingDirectory -eq $rootDirNormalized
        $matchesConfigFile = $false

        foreach ($configFile in ($configFiles -split ',')) {
            $normalizedConfigFile = Normalize-PathValue $configFile
            if ([string]::IsNullOrWhiteSpace($normalizedConfigFile)) {
                continue
            }

            if (
                $normalizedConfigFile -eq $rootDirNormalized -or
                $normalizedConfigFile.StartsWith("$rootDirNormalized/") -or
                $normalizedConfigFile.StartsWith("$rootDirNormalized\")
            ) {
                $matchesConfigFile = $true
                break
            }
        }

        $matchesProject = -not [string]::IsNullOrWhiteSpace($projectName) -and $projectName -in $ProjectNames
        $matchesAspireProject = -not [string]::IsNullOrWhiteSpace($projectName) -and $projectName.StartsWith("aspire-", [System.StringComparison]::OrdinalIgnoreCase)
        $matchesContainerName = Test-ContainerNameMatch -ContainerName $containerName -ServiceNames $Services
        $matchesPublishedPorts = Test-ContainerPortMatch -PublishedPorts $publishedPorts -HostPorts $HostPorts
        $matchesMetadata = $matchesServiceLabel -and ($matchesProject -or $matchesRootDirectory -or $matchesConfigFile -or $matchesAspireProject)
        $matchesFallback = ($matchesContainerName -and ($matchesAspireProject -or $matchesPublishedPorts -or $matchesServiceLabel)) -or
            ($matchesPublishedPorts -and ($matchesContainerName -or $matchesAspireProject -or $matchesServiceLabel))

        if (-not ($matchesMetadata -or $matchesFallback)) {
            continue
        }

        [pscustomobject]@{
            Id = $containerId
            Name = $containerName
            Project = $projectName
            Service = $serviceName
        }
    }

    return @($containers | Sort-Object Service, Name -Unique)
}

function Remove-ManagedComposeContainersIfPresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,

        [Parameter(Mandatory = $true)]
        [string]$RootDir,

        [Parameter(Mandatory = $true)]
        [string[]]$Services,

        [string[]]$ProjectNames = @(),

        [string[]]$HostPorts = @()
    )

    $containers = Get-ManagedComposeContainers `
        -RootDir $RootDir `
        -Services $Services `
        -ProjectNames $ProjectNames `
        -HostPorts $HostPorts
    if ($containers.Count -eq 0) {
        return
    }

    $containerDescriptions = $containers | ForEach-Object {
        if ([string]::IsNullOrWhiteSpace($_.Project)) {
            "$($_.Name) [$($_.Service)]"
        }
        else {
            "$($_.Name) [$($_.Project)/$($_.Service)]"
        }
    }

    Write-Host "Removing lingering $Description containers: $($containerDescriptions -join ', ')..."

    $containerIds = @($containers.Id | Select-Object -Unique)
    Invoke-BestEffortNativeCommand {
        docker rm -f $containerIds
    } "docker rm -f for lingering $Description containers"
}

function Get-ComposeServicesFromContainers {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComposeFile,

        [string]$EnvFile,

        [switch]$IncludeAll,

        [string[]]$Statuses = @()
    )

    if (-not (Test-Path $ComposeFile)) {
        return @()
    }

    $composeArgs = @()
    if (-not [string]::IsNullOrWhiteSpace($EnvFile) -and (Test-Path $EnvFile)) {
        $composeArgs += @("--env-file", $EnvFile)
    }
    $composeArgs += @("-f", $ComposeFile, "ps", "--services")
    if ($IncludeAll) {
        $composeArgs += "--all"
    }
    foreach ($status in $Statuses) {
        if (-not [string]::IsNullOrWhiteSpace($status)) {
            $composeArgs += @("--status", $status)
        }
    }

    try {
        $services = @(docker compose @composeArgs 2>$null)
        $global:LASTEXITCODE = 0
        return @($services | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
    catch {
        $global:LASTEXITCODE = 0
        return @()
    }
}

function Remove-StoppedComposeServicesIfPresent {
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

    $existingServices = Get-ComposeServicesFromContainers `
        -ComposeFile $ComposeFile `
        -EnvFile $EnvFile `
        -IncludeAll `
        -Statuses @("created", "exited", "dead")
    $presentServices = @($Services | Where-Object { $_ -in $existingServices })
    if ($presentServices.Count -eq 0) {
        return
    }

    Write-Host "Removing stopped $Description services if present: $($presentServices -join ', ')..."

    if (-not [string]::IsNullOrWhiteSpace($EnvFile) -and (Test-Path $EnvFile)) {
        Invoke-BestEffortNativeCommand {
            docker compose --env-file $EnvFile -f $ComposeFile rm -f $presentServices
        } "docker compose rm stopped services for $Description"
        return
    }

    Invoke-BestEffortNativeCommand {
        docker compose -f $ComposeFile rm -f $presentServices
    } "docker compose rm stopped services for $Description"
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

    $existingServices = Get-ComposeServicesFromContainers -ComposeFile $ComposeFile -EnvFile $EnvFile -IncludeAll
    $runningServices = Get-ComposeServicesFromContainers `
        -ComposeFile $ComposeFile `
        -EnvFile $EnvFile `
        -Statuses @("running", "restarting", "paused")
    $presentServices = @($Services | Where-Object { $_ -in $existingServices })
    if ($presentServices.Count -eq 0) {
        return
    }

    Write-Host "Restarting existing $Description services: $($presentServices -join ', ')..."

    $presentRunningServices = @($presentServices | Where-Object { $_ -in $runningServices })
    if ($presentRunningServices.Count -gt 0) {
        Write-Host "Stopping running $Description services first: $($presentRunningServices -join ', ')..."

        if (-not [string]::IsNullOrWhiteSpace($EnvFile) -and (Test-Path $EnvFile)) {
            Invoke-BestEffortNativeCommand {
                docker compose --env-file $EnvFile -f $ComposeFile stop $presentRunningServices
            } "docker compose stop for $Description"
        }
        else {
            Invoke-BestEffortNativeCommand {
                docker compose -f $ComposeFile stop $presentRunningServices
            } "docker compose stop for $Description"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($EnvFile) -and (Test-Path $EnvFile)) {
        Invoke-BestEffortNativeCommand {
            docker compose --env-file $EnvFile -f $ComposeFile rm -f $presentServices
        } "docker compose rm for $Description"
        return
    }

    Invoke-BestEffortNativeCommand {
        docker compose -f $ComposeFile rm -f $presentServices
    } "docker compose rm for $Description"
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

$staleServices = @("postgres", "redis", "app", "lies-app", "apphost-monitor", "lies-apphost-monitor", "dashboard", "compose-dashboard", "lies-compose-dashboard")
$restartServices = @("app", "lies-app", "apphost-monitor", "lies-apphost-monitor", "dashboard", "compose-dashboard", "lies-compose-dashboard")
$composeProjectNames = Get-ComposeProjectCandidates `
    -RootDir $RootDir `
    -ConfiguredProjectName ([System.Environment]::GetEnvironmentVariable("Deployment__Docker__ComposeProjectName", "Process"))
$managedPorts = @(
    [System.Environment]::GetEnvironmentVariable("Deployment__Docker__AppPort", "Process"),
    [System.Environment]::GetEnvironmentVariable("Deployment__Docker__DashboardPort", "Process"),
    "5516",
    "18888"
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -ne "0" } | Select-Object -Unique
$frontendBuildImage = [System.Environment]::GetEnvironmentVariable("Deployment__Docker__FrontendBuildImage", "Process")
if ([string]::IsNullOrWhiteSpace($frontendBuildImage)) {
    $frontendBuildImage = "mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm"
}

Remove-ManagedComposeContainersIfPresent `
    -Description "workspace non-data" `
    -RootDir $RootDir `
    -Services $restartServices `
    -ProjectNames $composeProjectNames `
    -HostPorts $managedPorts

Write-Host "Pre-pulling frontend build image: $frontendBuildImage"
Pull-DockerImageWithRetry -Image $frontendBuildImage

Remove-StoppedComposeServicesIfPresent -Description "legacy compose" -ComposeFile $LegacyComposeFile -EnvFile $LegacyEnvFile -Services $staleServices
Recreate-ComposeServicesIfPresent -Description "legacy compose" -ComposeFile $LegacyComposeFile -EnvFile $LegacyEnvFile -Services $restartServices
if (-not [string]::IsNullOrWhiteSpace($AppHostComposeFile)) {
    Remove-StoppedComposeServicesIfPresent -Description "AppHost compose" -ComposeFile $AppHostComposeFile -EnvFile $AppHostComposeEnvFile -Services $staleServices
    Recreate-ComposeServicesIfPresent -Description "AppHost compose" -ComposeFile $AppHostComposeFile -EnvFile $AppHostComposeEnvFile -Services $restartServices
}

[System.Environment]::SetEnvironmentVariable("LIES_APPHOST_DISABLE_DASHBOARD", "true", "Process")

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
