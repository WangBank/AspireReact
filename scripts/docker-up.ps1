$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir ".env.docker"
$ExampleFile = Join-Path $RootDir ".env.docker.example"

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleFile $EnvFile
    Write-Host "已生成 $EnvFile，请按需修改其中的密码和端口配置。"
}

docker compose --env-file $EnvFile -f (Join-Path $RootDir "docker-compose.yml") up -d --build

$AppPort = "5516"
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^APP_PORT=(.+)$') {
        $AppPort = $Matches[1]
    }
}

Write-Host ""
Write-Host "Docker 服务已启动。"
Write-Host "前端访问地址: http://localhost:$AppPort"
Write-Host "查看日志: docker compose --env-file `"$EnvFile`" logs -f app"
