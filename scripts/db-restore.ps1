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

function Invoke-PostgresSql {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,

        [Parameter(Mandatory = $true)]
        [string]$Database,

        [Parameter(Mandatory = $true)]
        [string]$PostgresUser,

        [Parameter(Mandatory = $true)]
        [string]$PostgresPassword,

        [Parameter(Mandatory = $true)]
        [string]$Sql,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    $QuotedPassword = $PostgresPassword.Replace("'", "''")
    $QuotedUser = $PostgresUser.Replace("'", "''")
    $QuotedDatabase = $Database.Replace("'", "''")

    $Sql | & docker exec -i $ContainerId sh -lc "export PGPASSWORD='$QuotedPassword'; psql -v ON_ERROR_STOP=1 -U '$QuotedUser' -d '$QuotedDatabase'"

    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage Exit code: $LASTEXITCODE"
    }
}

function Get-FirstExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Paths
    )

    return $Paths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Get-ComposePostgresContainerId {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string]$ComposeFile
    )

    if (-not (Test-Path $EnvFile) -or -not (Test-Path $ComposeFile)) {
        return ""
    }

    $containerIds = & docker compose --env-file $EnvFile -f $ComposeFile ps -q postgres 2>$null
    if ($LASTEXITCODE -ne 0) {
        return ""
    }

    return $containerIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
}

function Get-RunningContainers {
    param(
        [string[]]$Filters = @()
    )

    $format = "{{.ID}}`t{{.Image}}`t{{.Names}}`t{{.Ports}}"
    $rows = & docker ps --format $format @Filters 2>$null

    if ($LASTEXITCODE -ne 0) {
        return @()
    }

    return @(
        $rows |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object {
                $parts = $_ -split "`t", 4
                [PSCustomObject]@{
                    Id = $parts[0]
                    Image = if ($parts.Count -ge 2) { $parts[1] } else { "" }
                    Name = if ($parts.Count -ge 3) { $parts[2] } else { "" }
                    Ports = if ($parts.Count -ge 4) { $parts[3] } else { "" }
                }
            }
    )
}

function Select-PreferredPostgresContainer {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Candidates
    )

    if ($Candidates.Count -eq 0) {
        return $null
    }

    $portMatches = @($Candidates | Where-Object { $_.Ports -match "5432->5432" })
    if ($portMatches.Count -eq 1) {
        return $portMatches[0]
    }
    if ($portMatches.Count -gt 1) {
        $Candidates = $portMatches
    }

    $exactNameMatches = @($Candidates | Where-Object { $_.Name -eq "postgres-1" })
    if ($exactNameMatches.Count -eq 1) {
        return $exactNameMatches[0]
    }

    $canonicalNameMatches = @($Candidates | Where-Object { $_.Name -match "(^|[-_])postgres(-1)?$" })
    if ($canonicalNameMatches.Count -eq 1) {
        return $canonicalNameMatches[0]
    }

    if ($Candidates.Count -eq 1) {
        return $Candidates[0]
    }

    $candidateList = $Candidates | ForEach-Object {
        " - $($_.Name) [$($_.Id)] image=$($_.Image) ports=$($_.Ports)"
    }

    throw "Multiple running postgres containers were found. Stop the old stack, or restore into one container explicitly:`n$($candidateList -join "`n")"
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

    $containerId = Get-ComposePostgresContainerId -EnvFile $EnvFile -ComposeFile $ComposeFile
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
        $containerId = Get-ComposePostgresContainerId -EnvFile $AppHostEnvFile -ComposeFile $AppHostComposeFile
        if (-not [string]::IsNullOrWhiteSpace($containerId)) {
            return $containerId
        }
    }

    $containerCandidates = Get-RunningContainers -Filters @("--filter", "label=com.docker.compose.service=postgres")
    if ($containerCandidates.Count -eq 0) {
        $containerCandidates = @(
            Get-RunningContainers |
                Where-Object {
                    $_.Image -match "postgres" -and
                    $_.Name -match "postgres"
                }
        )
    }

    $selectedContainer = Select-PreferredPostgresContainer -Candidates $containerCandidates
    if ($null -ne $selectedContainer) {
        return $selectedContainer.Id
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

${DisconnectSql} = @"
UPDATE pg_database
SET datallowconn = false
WHERE datname = '$QuotedDb';

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$QuotedDb'
  AND pid <> pg_backend_pid();
"@

Write-Host "Disconnecting active sessions from '$TargetDatabase'..."
Invoke-PostgresSql `
    -ContainerId $ContainerId `
    -Database "postgres" `
    -PostgresUser $PostgresUser `
    -PostgresPassword $PostgresPassword `
    -Sql $DisconnectSql `
    -FailureMessage "Failed to disconnect active database sessions."

Write-Host "Recreating database '$TargetDatabase'..."
try {
    Invoke-Postgres -ContainerId $ContainerId -Arguments @(
        "sh", "-lc",
        "export PGPASSWORD='$QuotedPassword'; dropdb --if-exists -U '$QuotedUser' '$QuotedDb'"
    ) -FailureMessage "Failed to drop existing database."
}
catch {
    $ReconnectSql = @"
UPDATE pg_database
SET datallowconn = true
WHERE datname = '$QuotedDb';
"@

    try {
        Invoke-PostgresSql `
            -ContainerId $ContainerId `
            -Database "postgres" `
            -PostgresUser $PostgresUser `
            -PostgresPassword $PostgresPassword `
            -Sql $ReconnectSql `
            -FailureMessage "Failed to re-enable connections after restore failure."
    }
    catch {
    }

    throw
}

Invoke-Postgres -ContainerId $ContainerId -Arguments @(
    "sh", "-lc",
    "export PGPASSWORD='$QuotedPassword'; createdb -U '$QuotedUser' '$QuotedDb'"
) -FailureMessage "Failed to create target database."

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
