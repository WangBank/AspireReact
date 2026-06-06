param(
    [string]$BaseUrl,
    [string]$ZoneId,
    [string]$ApiToken,
    [string]$ExtraUrls,
    [switch]$PurgeEverything,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

function Import-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return
    }

    Get-Content $Path | ForEach-Object {
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

function Get-ConfigValue {
    param(
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $value = [System.Environment]::GetEnvironmentVariable($name, "Process")
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }

    return $null
}

function Test-Truthy {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }

    return @("1", "true", "yes", "on") -contains $Value.Trim().ToLowerInvariant()
}

function Get-NormalizedBaseUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $normalized = $Value.Trim().TrimEnd("/")
    if (-not ($normalized.StartsWith("http://") -or $normalized.StartsWith("https://"))) {
        throw "CLOUDFLARE_BASE_URL must start with http:// or https://. Current value: $Value"
    }

    return $normalized
}

function Convert-ToAbsoluteUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Base,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $trimmed = $Value.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return $null
    }

    if ($trimmed.StartsWith("http://") -or $trimmed.StartsWith("https://")) {
        return $trimmed
    }

    if (-not $trimmed.StartsWith("/")) {
        $trimmed = "/$trimmed"
    }

    return "$Base$trimmed"
}

function Split-ListValue {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return @()
    }

    return @(
        $Value -split "[,\r\n]+" |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}

function Get-PurgeUrls {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NormalizedBaseUrl,

        [string]$ConfiguredExtraUrls
    )

    $defaultValues = @(
        "/",
        "/index.html",
        "/manifest.webmanifest",
        "/sw.js",
        "/registerSW.js",
        "/dashboard",
        "/statistics",
        "/entry/unified",
        "/list/unified",
        "/profile",
        "/admin"
    )

    $extraValues = Split-ListValue $ConfiguredExtraUrls
    $allValues = @($defaultValues + $extraValues)

    return @(
        $allValues |
            ForEach-Object { Convert-ToAbsoluteUrl -Base $NormalizedBaseUrl -Value $_ } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Sort-Object -Unique
    )
}

function Show-CacheHeaders {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Head -MaximumRedirection 5
        $cacheControl = $response.Headers["Cache-Control"]
        $cfCacheStatus = $response.Headers["CF-Cache-Status"]
        $serviceWorkerAllowed = $response.Headers["Service-Worker-Allowed"]

        Write-Host "$Url"
        Write-Host "  Status: $([int]$response.StatusCode)"
        if (-not [string]::IsNullOrWhiteSpace($cacheControl)) {
            Write-Host "  Cache-Control: $cacheControl"
        }
        if (-not [string]::IsNullOrWhiteSpace($cfCacheStatus)) {
            Write-Host "  CF-Cache-Status: $cfCacheStatus"
        }
        if (-not [string]::IsNullOrWhiteSpace($serviceWorkerAllowed)) {
            Write-Host "  Service-Worker-Allowed: $serviceWorkerAllowed"
        }
    }
    catch {
        Write-Host "$Url"
        Write-Host "  Header check failed: $($_.Exception.Message)"
    }
}

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.aspire-docker"
$ExampleFile = Join-Path $RootDir ".env.aspire-docker.example"

if (-not (Test-Path $EnvFile) -and (Test-Path $ExampleFile)) {
    Copy-Item $ExampleFile $EnvFile
    Write-Host "Created $EnvFile. Fill in the Cloudflare values before running again."
}

Import-EnvFile -Path $EnvFile

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = Get-ConfigValue @("CLOUDFLARE_BASE_URL", "Cloudflare__BaseUrl")
}
if ([string]::IsNullOrWhiteSpace($ZoneId)) {
    $ZoneId = Get-ConfigValue @("CLOUDFLARE_ZONE_ID", "Cloudflare__ZoneId")
}
if ([string]::IsNullOrWhiteSpace($ApiToken)) {
    $ApiToken = Get-ConfigValue @("CLOUDFLARE_API_TOKEN", "Cloudflare__ApiToken")
}
if ([string]::IsNullOrWhiteSpace($ExtraUrls)) {
    $ExtraUrls = Get-ConfigValue @("CLOUDFLARE_EXTRA_PURGE_URLS", "Cloudflare__ExtraPurgeUrls")
}
$shouldPurgeEverything = $PurgeEverything.IsPresent
if (-not $shouldPurgeEverything) {
    $configuredPurgeEverything = Get-ConfigValue @("CLOUDFLARE_PURGE_EVERYTHING", "Cloudflare__PurgeEverything")
    $shouldPurgeEverything = Test-Truthy $configuredPurgeEverything
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw "Missing Cloudflare base URL. Set CLOUDFLARE_BASE_URL in .env.aspire-docker or pass -BaseUrl."
}
if ([string]::IsNullOrWhiteSpace($ZoneId)) {
    throw "Missing Cloudflare zone id. Set CLOUDFLARE_ZONE_ID in .env.aspire-docker or pass -ZoneId."
}
if ([string]::IsNullOrWhiteSpace($ApiToken)) {
    throw "Missing Cloudflare API token. Set CLOUDFLARE_API_TOKEN in .env.aspire-docker or pass -ApiToken."
}

$NormalizedBaseUrl = Get-NormalizedBaseUrl -Value $BaseUrl
$endpoint = "https://api.cloudflare.com/client/v4/zones/$ZoneId/purge_cache"
$headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type"  = "application/json"
}

if ($shouldPurgeEverything) {
    Write-Host "Purging entire Cloudflare zone for $NormalizedBaseUrl ..."
    $body = @{ purge_everything = $true } | ConvertTo-Json
}
else {
    $purgeUrls = Get-PurgeUrls -NormalizedBaseUrl $NormalizedBaseUrl -ConfiguredExtraUrls $ExtraUrls
    if ($purgeUrls.Count -eq 0) {
        throw "No purge URLs were generated."
    }

    Write-Host "Purging Cloudflare URLs:"
    $purgeUrls | ForEach-Object { Write-Host "  $_" }
    $body = @{ files = $purgeUrls } | ConvertTo-Json -Depth 4
}

$response = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body $body
if (-not $response.success) {
    $errors = $response.errors | ConvertTo-Json -Depth 4 -Compress
    throw "Cloudflare purge failed: $errors"
}

Write-Host "Cloudflare cache purge completed."

if (-not $SkipValidation) {
    Write-Host ""
    Write-Host "Post-purge header check:"
    Show-CacheHeaders -Url "$NormalizedBaseUrl/sw.js"
    Show-CacheHeaders -Url "$NormalizedBaseUrl/manifest.webmanifest"
}
