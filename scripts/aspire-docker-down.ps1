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

function Remove-ManagedComposeContainersIfPresent {
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
        return
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
        $workingDirectory = Normalize-PathValue $parts[4]
        $configFiles = $parts[5]
        $publishedPorts = $parts[6]

        $matchesServiceLabel = $serviceName -in $Services

        $matchesRootDirectory = -not [string]::IsNullOrWhiteSpace($workingDirectory) -and $workingDirectory -eq $rootDirNormalized
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

    Write-Host "Removing lingering workspace non-data containers: $($containerDescriptions -join ', ')..."

    $containerIds = @($containers.Id | Select-Object -Unique)
    docker rm -f $containerIds | Out-Null
    $global:LASTEXITCODE = 0
}

$RootDir = Split-Path -Parent $PSScriptRoot
$AppHostProject = Join-Path $RootDir "Lies.AppHost/Lies.AppHost.csproj"
$OutputDir = Join-Path $RootDir ".aspire-output/docker-compose"
$EnvFile = Join-Path $RootDir ".env.aspire-docker"

if (-not (Get-Command aspire -ErrorAction SilentlyContinue)) {
    Write-Host "The aspire CLI is required."
    Write-Host "Install it with: dotnet tool install --global Aspire.Cli --prerelease"
    exit 1
}

Invoke-NativeCommand {
    aspire destroy --apphost $AppHostProject --output-path $OutputDir --non-interactive --yes
} "Aspire Docker shutdown failed."

if (Test-Path $EnvFile) {
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
}

$composeProjectNames = Get-ComposeProjectCandidates `
    -RootDir $RootDir `
    -ConfiguredProjectName ([System.Environment]::GetEnvironmentVariable("Deployment__Docker__ComposeProjectName", "Process"))
$managedPorts = @(
    [System.Environment]::GetEnvironmentVariable("Deployment__Docker__AppPort", "Process"),
    [System.Environment]::GetEnvironmentVariable("Deployment__Docker__DashboardPort", "Process"),
    "5516",
    "18888"
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -ne "0" } | Select-Object -Unique

Remove-ManagedComposeContainersIfPresent `
    -RootDir $RootDir `
    -Services @("app", "lies-app", "apphost-monitor", "lies-apphost-monitor", "dashboard", "compose-dashboard", "lies-compose-dashboard") `
    -ProjectNames $composeProjectNames `
    -HostPorts $managedPorts

Write-Host ""
Write-Host "Aspire Docker deployment is down."
Write-Host "Artifacts kept at: $OutputDir"
