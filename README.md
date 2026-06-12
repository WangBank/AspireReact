# Lies

Lies是一个围绕“每日交易复盘”设计的全栈应用，用来统一管理三类核心数据：

- 账户日资金：总资产、持仓市值、可用资金、当日盈亏
- 银证转账：转入、转出、金额、备注
- 股票交易：建仓、加仓、减仓、做 T、清仓、持仓快照

在此基础上，项目已经集成：

- 手机券商截图 OCR 识别与回填
- OCR 识别审计与原图回查
- 统一录入页与统一列表页
- 股票历史流水页与周期统计
- 数据体检与异常提醒
- 复盘笔记、心魔笔记、吾日三省吾身

## 技术栈

- 前端：React 19 + TypeScript + Vite + MobX
- 后端：.NET 10 + ASP.NET Core Web API + EF Core
- 数据：PostgreSQL + Redis
- OCR：RapidOCRSharpOnnx
- 编排：Lies AppHost
- 部署：Docker / Docker Compose

## 推荐入口

日常使用优先走这几个页面：

- `/dashboard`：首页概览、收益日历、盈亏榜、快捷录入
- `/entry/unified`：统一录入页，支持手工录入和截图识别回填
- `/list/unified`：统一列表页，按账户 / 流水 / 交易切换查看
- `/statistics`：统计分析页
- `/stocks/:stockCode/history`：单票历史流水、周期、盈亏比

补充页面：

- `/health`：数据体检
- `/audits/imports`：图片识别审计
- `/notes/global`：全局笔记
- `/notes/stock`：心魔笔记
- `/notes/reflection`：吾日三省吾身
- `/config`：系统配置
- `/profile`：个人资料

兼容入口仍保留：

- `/entry/account`
- `/entry/bankflow`
- `/entry/trade`
- `/list/account`
- `/list/bankflow`
- `/list/trade`

## 项目结构

```text
Lies/
├── Lies.AppHost/         Lies 编排入口
├── Lies.Server/          后端 API、OCR、数据体检、审计
├── frontend/                    React 前端
├── scripts/                     Docker 启停脚本
├── docker-compose.yml           Docker 编排
├── Dockerfile                   生产镜像构建
├── README.md                    快速开始
└── Lies-项目文档.md             详细说明
```

几个重要的运行时目录：

- `Lies.Server/Logs/`：Serilog 日志
- `Lies.Server/RuntimeData/RapidOcr/`：OCR 模型
- `Lies.Server/RuntimeData/PortfolioImportAudits/`：识别审计原图与数据

这些目录属于运行时产物，不应该提交到仓库。

## 环境要求

- .NET SDK 10
- Node.js 20.19+ 或 22.12+
- PostgreSQL
- Redis
- Docker Desktop 或 Docker Engine（如果走容器部署）

## 配置说明

后端主配置文件：

- [Lies.Server/appsettings.json](/Users/wangzhen/codes/Lies/Lies/Lies.Server/appsettings.json)

至少需要关注：

- `ConnectionStrings:PostgreSQL`
- `Redis:ConnectionString`
- `Jwt`
- `RapidOcr`
- `Tonghuashun:LinkPrefix`

补充说明：

- `RapidOcr.AutoDownloadModels=true` 时，首次 OCR 会自动下载模型
- Docker 场景下优先改 `.env.docker`
- 默认前端对外端口统一使用 `5516`

## 启动方式

### 1. Lies 开发启动

```bash
dotnet run --project Lies.AppHost
```

访问：

```text
http://localhost:5516
```

适合本地开发联调。

### 2. 前后端分开启动

先启动后端：

```bash
dotnet run --project Lies.Server/Lies.Server.csproj --urls http://127.0.0.1:6202
```

再启动前端：

```bash
cd frontend
npm install
SERVER_HTTP=http://127.0.0.1:6202 npm run dev
```

### 3. Docker 一键启动

首次使用：

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

或使用脚本：

- macOS / Linux

```bash
bash scripts/docker-up.sh
```

- Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\docker-up.ps1
```

默认访问：

```text
http://localhost:5516
```

手写 `docker-compose.yml` 这条链路会启动一个仅本机可访问的部署态 Aspire Dashboard：

```text
http://localhost:18888
```

默认端口可在 `.env.docker` 中调整：

```env
ASPIRE_DASHBOARD_BIND_HOST=127.0.0.1
ASPIRE_DASHBOARD_PORT=18888
```

当前这套部署态 Dashboard 由 `apphost-monitor` 自己提供页面和资源服务，用来把部署态的 `postgres`、`redis`、`server`、`webfrontend` 资源树接回 Aspire 视图。

如果你想在本地开发时看完整资源视图（`postgres`、`redis`、`server`、`webfrontend` 的依赖与状态），请运行：

```bash
dotnet run --project Lies.AppHost
```

说明：

- `Lies.AppHost` 现在已经建模了 PostgreSQL、Redis、Server 和前端资源
- 部署态会通过 `apphost-monitor` 直接承载 Dashboard 和资源状态
- `server` 和 `webfrontend` 在 Docker 部署里仍由同一个 `app` 容器承载，但 Dashboard 会按两个资源节点展示健康状态，方便和本地视图保持一致

`.env.docker` 里可以单独指定 PostgreSQL 镜像，例如：

```env
POSTGRES_IMAGE=postgres:latest
```

项目现在已经按 PostgreSQL 18+ 的官方建议，把数据卷挂载到 `/var/lib/postgresql`，以适配 `latest`。

如果你已经有旧的 PostgreSQL 数据卷，直接从一个大版本切到更新的大版本仍然可能导致容器启动失败。已有数据建议先备份，再做数据库升级或迁移。

如果启动时报 `dependency postgres failed to start`，优先怀疑这一点。最常见处理方式：

- 还需要旧数据：把 `.env.docker` 里的 `POSTGRES_IMAGE` 先改回旧大版本，例如你之前一直用的 `postgres:17-alpine`
- 不需要旧数据：执行 `docker compose --env-file .env.docker down -v` 后再重新 `up -d --build`

如果要正式升级到 `18/latest`，推荐流程是：

1. 用旧版本镜像把旧数据启动起来并导出
2. 清理旧卷
3. 用新 compose 启动 `postgres:latest`
4. 再把导出的数据导回去

常用命令：

```bash
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker logs -f apphost-monitor
docker compose --env-file .env.docker down
```

### 数据库备份恢复

如果你已经有导出的 PostgreSQL 备份文件，可以直接恢复到当前运行中的 Docker Postgres。

项目提供两个恢复脚本：

- `scripts/db-restore.ps1`
- `scripts/db-restore.sh`

支持格式：

- `.sql`
- `.dump`
- `.backup`
- `.tar`

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\db-restore.ps1 C:\Users\12243\Downloads\lies.dump lies
```

macOS / Linux：

```bash
bash scripts/db-restore.sh /path/to/lies.dump lies
```

说明：

- 恢复前先启动 Docker 栈，`docker-up` 和 `aspire-docker-up` 两条链路都可以
- 脚本会自动寻找当前运行中的 `postgres` 容器，复制备份文件，断开活动连接，重建目标库，然后执行恢复
- 目标库会被重建，原有数据会被覆盖
- 第二个参数不传时，默认恢复到 `.env.docker` 中的 `POSTGRES_DB`，默认值是 `lies`
- 恢复凭据读取 `.env.docker` 中的 `POSTGRES_USER` 和 `POSTGRES_PASSWORD`
- 如果你使用的是 AppHost Docker 链路，建议把 `.env.docker` 和 `.env.aspire-docker` 里的 PostgreSQL 用户名和密码保持一致
- 如果本机同时运行了多套 PostgreSQL 容器，先停掉旧栈，避免恢复到错误容器

## 自动发布

如果你不想每次都去 Windows 主机上手动 `git pull` 再执行发布命令，当前项目已经可以接成：

- GitHub Actions
- Windows 自托管 runner
- 当前仓库自带的 `scripts/release-prod.ps1`

对应 workflow 文件：

- [.github/workflows/deploy-windows-self-hosted.yml](/Users/wangzhen/codes/Aspire/AspireReact/.github/workflows/deploy-windows-self-hosted.yml)

### 方案特点

- 代码推到 `main` 后自动发布
- 也支持在 GitHub Actions 页面里手动触发发布
- 复用现有发布脚本：
  - `scripts/aspire-docker-up.ps1`
  - `scripts/release-prod.ps1`
  - `scripts/cloudflare-purge.ps1`
- 发布完成后会自动清理 Cloudflare 缓存

### 1. 在 Windows 主机安装自托管 runner

建议在生产机器上单独建一个目录，例如：

```powershell
mkdir C:\actions-runner\lies-prod
cd C:\actions-runner\lies-prod
```

然后去 GitHub 仓库页面：

```text
Settings -> Actions -> Runners -> New self-hosted runner
```

按 GitHub 给出的 Windows 步骤下载并注册 runner。

建议标签至少包含：

- `self-hosted`
- `Windows`
- `X64`
- `lies-prod`

当前 workflow 默认就是绑定这组标签：

```yaml
runs-on: [self-hosted, Windows, X64, lies-prod]
```

如果你想用别的标签，记得同步修改 workflow。

### 2. 确保 runner 账户能真正执行发布

这一步很关键。

自托管 runner 必须运行在“和你手动发布时一样能执行这些命令”的 Windows 账户下：

- `docker`
- `dotnet`
- `aspire`
- `git`

如果你当前是用 Docker Desktop，并且只有你自己的登录用户能正常执行 Docker 命令，那么 runner 服务也要用同一个用户运行。否则 workflow 虽然触发了，真正发布时会因为拿不到 Docker 上下文而失败。

### 3. 配置生产环境 secret

这个 workflow 每次执行时，会先把 GitHub Secret 写成仓库根目录下的 `.env.aspire-docker`，再调用发布脚本。

你需要在仓库或 `production` Environment 里新增一个多行 Secret：

```text
ASPIRE_DOCKER_ENV_FILE
```

内容直接参考：

- [.env.aspire-docker.example](/Users/wangzhen/codes/Aspire/AspireReact/.env.aspire-docker.example)

把真实值填进去，例如：

```env
Deployment__Docker__ComposeProjectName=lies
Deployment__Docker__AppPort=5516
Deployment__Docker__DashboardPort=18888
Deployment__Docker__PostgresPort=5432
Deployment__Docker__RedisPort=6379
Deployment__Docker__PostgresDatabase=lies
Deployment__Docker__PostgresImageTag=latest
Deployment__Docker__RapidOcrAutoDownloadModels=true
Parameters__postgresUser=postgres
Parameters__postgresPassword=你的密码
Parameters__redisPassword=你的密码
CLOUDFLARE_BASE_URL=https://lies.wangbank.top
CLOUDFLARE_ZONE_ID=你的 zone id
CLOUDFLARE_API_TOKEN=你的 api token
CLOUDFLARE_EXTRA_PURGE_URLS=
CLOUDFLARE_PURGE_EVERYTHING=false
```

推荐做法：

- 把这个 Secret 配到 GitHub `Environment: production`
- 然后给 `main` 分支绑定 `production` 环境保护规则

### 4. 触发方式

自动触发：

```text
push 到 main
```

手动触发：

```text
GitHub -> Actions -> Deploy Production (Windows Self-Hosted) -> Run workflow
```

手动触发时支持几个参数：

- `skip_purge`
- `purge_everything`
- `skip_validation`

对应当前脚本参数：

- `-SkipPurge`
- `-PurgeEverything`
- `-SkipValidation`

### 5. 实际执行了什么

workflow 内部最终执行的是：

```powershell
.\scripts\release-prod.ps1
```

而这个脚本会继续执行：

1. `scripts/aspire-docker-up.ps1`
2. `scripts/cloudflare-purge.ps1`

所以你本地手动发布和 GitHub 自动发布走的是同一条链路，排查问题也更统一。

### 6. 常见问题

1. workflow 触发了，但 runner 一直不接单

大概率是标签不匹配。先确认 runner 上有没有：

- `self-hosted`
- `Windows`
- `X64`
- `lies-prod`

2. workflow 执行到 Docker 命令时报错

优先怀疑 runner 服务使用的账户不对。很多 Windows 机器上，Docker Desktop 只对当前登录用户可用。

3. workflow 报缺少 `.env.aspire-docker`

说明 GitHub Secret `ASPIRE_DOCKER_ENV_FILE` 没配，或者配到了错误的仓库 / Environment。

4. 发布成功了但外网还是旧页面

先看 Cloudflare purge 步骤有没有成功，再检查浏览器缓存和 PWA 缓存。

如果你想把 Docker 方案再往前推进成“Docker + AppHost 参与资源服务”的结构，现在也已经支持一套官方的 AppHost 驱动链路。

首次使用先安装 Aspire CLI：

```bash
dotnet tool install --global Aspire.Cli --prerelease
```

准备环境文件：

```bash
cp .env.aspire-docker.example .env.aspire-docker
```

如果生产前面挂了 Cloudflare，再把下面几项补到 `.env.aspire-docker`：

```env
CLOUDFLARE_BASE_URL=https://lies.wangbank.top
CLOUDFLARE_ZONE_ID=你的_zone_id
CLOUDFLARE_API_TOKEN=你的_api_token
CLOUDFLARE_EXTRA_PURGE_URLS=/notes/global,/notes/stock,/notes/reflection
CLOUDFLARE_PURGE_EVERYTHING=false
```

一键生产发布并清理 Cloudflare 缓存：

- macOS / Linux

```bash
bash scripts/release-prod.sh
```

- Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release-prod.ps1
```

这套命令内部会先执行 `aspire-docker-up`，然后调用 Cloudflare Purge API 清理缓存，并回显 `sw.js` / `manifest.webmanifest` 的响应头，方便确认 PWA 相关缓存已经刷新。

如果只想部署，不想清缓存：

- macOS / Linux

```bash
bash scripts/release-prod.sh --skip-purge
```

- Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release-prod.ps1 -SkipPurge
```

如果这个子域名只跑这个站点，建议把 `.env.aspire-docker` 里的 `CLOUDFLARE_PURGE_EVERYTHING=true`，这样最稳，不需要维护额外路由列表。

如果只想单独清缓存：

- macOS / Linux

```bash
bash scripts/cloudflare-purge.sh
```

- Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cloudflare-purge.ps1
```

仍然保留原始发布命令：

- macOS / Linux

```bash
bash scripts/aspire-docker-up.sh
```

- Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\aspire-docker-up.ps1
```

这条链路的特点：

- 由 `Lies.AppHost` 生成 Docker Compose 产物，而不是手写维护资源关系
- 发布态资源包括 `apphost-monitor`、`postgres`、`redis`、`app`
- `postgres`、`redis` 和部署态 Dashboard 默认都只绑定到 `127.0.0.1`
- `app` 继续保持对外端口 `5516`
- `apphost-monitor` 对外提供 `18888 -> 17100` 的 Dashboard 页面，同时在容器内承载资源服务和 OTLP 接收端点
- PostgreSQL `latest` 已按 18+ 规则改成 `/var/lib/postgresql` 数据卷挂载

相关配置文件：

- `.env.aspire-docker`：AppHost 驱动 Docker 部署使用
- `.env.docker`：手写 `docker-compose.yml` 使用

常用命令：

```bash
bash scripts/aspire-docker-down.sh
aspire publish --non-interactive --nologo --output-path ./.aspire-output/docker-compose
```

Cloudflare API Token 最少需要对应 Zone 的缓存清理权限；如果脚本提示缺少配置，优先检查 `.env.aspire-docker` 里的 `CLOUDFLARE_*` 项。

## 日常使用流程

1. 打开 `/entry/unified`
2. 手工填写，或上传截图执行“识别并回填”
3. 对照原图检查账户、流水、交易是否完整
4. 点击“一键保存识别结果”或分别保存
5. 到 `/list/unified` 复核持仓 / 清仓状态
6. 到 `/statistics` 看区间表现
7. 到笔记页面补充复盘

## OCR 能力概览

当前重点支持：

- 同花顺手机端整屏持仓截图
- 含当日买入 / 当日卖出 / 均价 / 收盘价的流水截图
- 左侧账户汇总 + 右侧当日流水的组合截图

OCR 结果会先回填表单，不会直接入库。系统同时支持：

- 识别提醒
- 原图预览
- 一键保存
- 清空识别回填
- 审计页回查识别结果

## 统计与分析

统计页当前不只是区间汇总，还包括：

- 按日 / 月 / 年切换的收益日历
- 单票累计盈亏排行
- 周期统计：从建仓到清仓
- 净入金修正收益率
- 胜率、连赢连亏、最大回撤与恢复
- 做 T 专项分析
- 按周 / 月 / 季度的盈亏分布
- 盈利最多 / 亏损最多股票排行

## 仓库维护约定

已经清理掉历史模板残留和调试产物，后续建议继续遵守：

- 不提交 `Logs/`、`RuntimeData/`、`.codex-artifacts/`
- OCR 原图只保存在审计目录，不放仓库
- 开发说明放 `README.md`
- 更完整的功能说明放 [Lies-项目文档.md](/Users/wangzhen/codes/Lies/Lies/Lies-项目文档.md)

## 相关文件

- 前端路由：[frontend/src/App.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/App.tsx)
- 统一录入页：[frontend/src/pages/UnifiedEntryPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/UnifiedEntryPage.tsx)
- 统一列表页：[frontend/src/pages/UnifiedListPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/UnifiedListPage.tsx)
- 统计页：[frontend/src/pages/StatisticsPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/StatisticsPage.tsx)
- 股票历史页：[frontend/src/pages/StockHistoryPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/StockHistoryPage.tsx)
- OCR 服务：[Lies.Server/Services/PortfolioScreenshotImportService.cs](/Users/wangzhen/codes/Lies/Lies/Lies.Server/Services/PortfolioScreenshotImportService.cs)
- 数据体检服务：[Lies.Server/Services/DataHealthService.cs](/Users/wangzhen/codes/Lies/Lies/Lies.Server/Services/DataHealthService.cs)
