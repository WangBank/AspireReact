$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$AppHostProject = Join-Path $RootDir "Lies.AppHost/Lies.AppHost.csproj"
$OutputDir = Join-Path $RootDir ".aspire-output/docker-compose"

if (-not (Get-Command aspire -ErrorAction SilentlyContinue)) {
    Write-Host "The aspire CLI is required."
    Write-Host "Install it with: dotnet tool install --global Aspire.Cli --prerelease"
    exit 1
}

aspire destroy --apphost $AppHostProject --output-path $OutputDir --non-interactive

Write-Host ""
Write-Host "Aspire Docker deployment is down."
Write-Host "Artifacts kept at: $OutputDir"
