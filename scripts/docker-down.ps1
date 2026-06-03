$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"

if (-not (Test-Path $EnvFile)) {
    Write-Host "未找到 $EnvFile，使用示例环境文件继续关闭服务。"
    $EnvFile = Join-Path $RootDir ".env.docker.example"
}

docker compose --env-file $EnvFile -f (Join-Path $RootDir "docker-compose.yml") down
