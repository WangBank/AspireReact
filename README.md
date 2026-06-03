# 心魔录

心魔录是一个围绕“每日交易复盘”设计的全栈应用，用来统一管理三类核心数据：

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
└── 心魔录-项目文档.md             详细说明
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
docker compose --env-file .env.docker down
```

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
- 更完整的功能说明放 [心魔录-项目文档.md](/Users/wangzhen/codes/Lies/Lies/心魔录-项目文档.md)

## 相关文件

- 前端路由：[frontend/src/App.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/App.tsx)
- 统一录入页：[frontend/src/pages/UnifiedEntryPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/UnifiedEntryPage.tsx)
- 统一列表页：[frontend/src/pages/UnifiedListPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/UnifiedListPage.tsx)
- 统计页：[frontend/src/pages/StatisticsPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/StatisticsPage.tsx)
- 股票历史页：[frontend/src/pages/StockHistoryPage.tsx](/Users/wangzhen/codes/Lies/Lies/frontend/src/pages/StockHistoryPage.tsx)
- OCR 服务：[Lies.Server/Services/PortfolioScreenshotImportService.cs](/Users/wangzhen/codes/Lies/Lies/Lies.Server/Services/PortfolioScreenshotImportService.cs)
- 数据体检服务：[Lies.Server/Services/DataHealthService.cs](/Users/wangzhen/codes/Lies/Lies/Lies.Server/Services/DataHealthService.cs)
