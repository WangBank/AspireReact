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

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$DefaultValue
    )

    if (-not (Test-Path $FilePath)) {
        return $DefaultValue
    }

    $pattern = "^{0}=(.+)$" -f [Regex]::Escape($Name)
    foreach ($line in Get-Content $FilePath) {
        if ($line -match $pattern) {
            return $Matches[1].Trim()
        }
    }

    return $DefaultValue
}

function Invoke-Postgres {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    Invoke-NativeCommand {
        docker exec $ContainerId @Arguments
    } $FailureMessage
}

function Get-FirstExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Paths
    )

    return $Paths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Get-PostgresContainerId {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootDir,

        [Parameter(Mandatory = $true)]
        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string]$ComposeFile
    )

    $containerId = docker compose --env-file $EnvFile -f $ComposeFile ps -q postgres
    if (-not [string]::IsNullOrWhiteSpace($containerId)) {
        return $containerId
    }

    $AppHostOutputDir = Join-Path $RootDir ".aspire-output/docker-compose"
    $AppHostComposeFile = Get-FirstExistingPath @(
        (Join-Path $AppHostOutputDir "docker-compose.yaml"),
        (Join-Path $AppHostOutputDir "docker-compose.yml")
    )
    $AppHostEnvFile = Join-Path $AppHostOutputDir ".env.Production"

    if (-not [string]::IsNullOrWhiteSpace($AppHostComposeFile)) {
        $containerId = docker compose --env-file $AppHostEnvFile -f $AppHostComposeFile ps -q postgres
        if (-not [string]::IsNullOrWhiteSpace($containerId)) {
            return $containerId
        }
    }

    return ""
}

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ComposeFile = Join-Path $RootDir "docker-compose.yml"

if ($args.Count -lt 1) {
    Write-Host "Usage: powershell -ExecutionPolicy Bypass -File .\scripts\db-restore.ps1 <dump-file> [database]"
    Write-Host "Supported formats: .sql, .dump, .backup, .tar"
    exit 1
}

$DumpFile = Resolve-Path $args[0]
$TargetDatabase = if ($args.Count -ge 2 -and -not [string]::IsNullOrWhiteSpace($args[1])) {
    $args[1]
}
else {
    Get-EnvValue -FilePath $EnvFile -Name "POSTGRES_DB" -DefaultValue "lies"
}

$PostgresUser = Get-EnvValue -FilePath $EnvFile -Name "POSTGRES_USER" -DefaultValue "postgres"
$PostgresPassword = Get-EnvValue -FilePath $EnvFile -Name "POSTGRES_PASSWORD" -DefaultValue "postgres123"
$ContainerId = Get-PostgresContainerId -RootDir $RootDir -EnvFile $EnvFile -ComposeFile $ComposeFile

if ([string]::IsNullOrWhiteSpace($ContainerId)) {
    throw "Postgres container is not running. Start the Docker stack first."
}

$DumpExtension = [System.IO.Path]::GetExtension($DumpFile.Path).ToLowerInvariant()
$ContainerDumpPath = "/tmp/restore-input$DumpExtension"
$QuotedPassword = $PostgresPassword.Replace("'", "''")
$QuotedUser = $PostgresUser.Replace("'", "''")
$QuotedDb = $TargetDatabase.Replace("'", "''")

Write-Host "Copying dump into postgres container..."
Invoke-NativeCommand {
    docker cp $DumpFile.Path "${ContainerId}:${ContainerDumpPath}"
} "Failed to copy dump into postgres container."

Write-Host "Recreating database '$TargetDatabase'..."
Invoke-Postgres -ContainerId $ContainerId -Arguments @(
    "sh", "-lc",
    "export PGPASSWORD='$QuotedPassword'; dropdb --if-exists -U '$QuotedUser' '$QuotedDb'; createdb -U '$QuotedUser' '$QuotedDb'"
) -FailureMessage "Failed to recreate database."

if ($DumpExtension -eq ".sql") {
    Write-Host "Restoring SQL dump..."
    Invoke-Postgres -ContainerId $ContainerId -Arguments @(
        "sh", "-lc",
        "export PGPASSWORD='$QuotedPassword'; psql -v ON_ERROR_STOP=1 -U '$QuotedUser' -d '$QuotedDb' -f '$ContainerDumpPath'"
    ) -FailureMessage "Failed to restore SQL dump."
}
else {
    Write-Host "Restoring pg_dump archive..."
    Invoke-Postgres -ContainerId $ContainerId -Arguments @(
        "sh", "-lc",
        "export PGPASSWORD='$QuotedPassword'; pg_restore --no-owner --no-privileges -U '$QuotedUser' -d '$QuotedDb' '$ContainerDumpPath'"
    ) -FailureMessage "Failed to restore pg_dump archive."
}

Invoke-NativeCommand {
    docker exec $ContainerId rm -f $ContainerDumpPath
} "Failed to remove temporary dump from postgres container."

Write-Host ""
Write-Host "Database restore completed."
Write-Host "Database: $TargetDatabase"
Write-Host "User: $PostgresUser"
