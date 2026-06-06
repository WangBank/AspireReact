$ErrorActionPreference = "Stop"

param(
    [switch]$SkipPurge,
    [switch]$PurgeEverything,
    [switch]$SkipValidation,
    [string]$BaseUrl,
    [string]$ZoneId,
    [string]$ApiToken,
    [string]$ExtraUrls
)

$RootDir = Split-Path -Parent $PSScriptRoot
$DeployScript = Join-Path $PSScriptRoot "aspire-docker-up.ps1"
$PurgeScript = Join-Path $PSScriptRoot "cloudflare-purge.ps1"

if (-not (Test-Path $DeployScript)) {
    throw "Missing deploy script: $DeployScript"
}

Write-Host "Step 1/2: Deploying production stack..."
& $DeployScript

if ($SkipPurge) {
    Write-Host ""
    Write-Host "Step 2/2: Cloudflare purge skipped."
    exit 0
}

if (-not (Test-Path $PurgeScript)) {
    throw "Missing Cloudflare purge script: $PurgeScript"
}

$purgeArgs = @()
if ($PurgeEverything) {
    $purgeArgs += "-PurgeEverything"
}
if ($SkipValidation) {
    $purgeArgs += "-SkipValidation"
}
if (-not [string]::IsNullOrWhiteSpace($BaseUrl)) {
    $purgeArgs += @("-BaseUrl", $BaseUrl)
}
if (-not [string]::IsNullOrWhiteSpace($ZoneId)) {
    $purgeArgs += @("-ZoneId", $ZoneId)
}
if (-not [string]::IsNullOrWhiteSpace($ApiToken)) {
    $purgeArgs += @("-ApiToken", $ApiToken)
}
if (-not [string]::IsNullOrWhiteSpace($ExtraUrls)) {
    $purgeArgs += @("-ExtraUrls", $ExtraUrls)
}

Write-Host ""
Write-Host "Step 2/2: Purging Cloudflare cache..."
& $PurgeScript @purgeArgs
