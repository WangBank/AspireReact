# 心魔录

心魔录是一个面向个人投资复盘的全栈 Web 应用，用来记录每日账户资金、银证转账、持仓/清仓明细，并提供统计、笔记和图片识别导入能力。

项目当前基于以下栈实现：

- 前端：React 19 + TypeScript + Vite + MobX
- 后端：.NET 10 Web API + EF Core + Aspire
- 数据：PostgreSQL + Redis
- OCR：RapidOCRSharpOnnx

## 主要功能

- 账户资金录入：记录日期、总资产、持仓市值、可用资金、当日盈亏。
- 银证流水录入：记录转入/转出、金额、备注。
- 交易持仓录入：支持单日多只股票批量录入，区分持仓和清仓。
- 图片识别导入：识别券商截图，自动回填账户、银证流水和股票明细。
- 统一数据列表：按账户、流水、交易三类查看，支持筛选、批量删除、编辑。
- 统计汇总：支持今日/本周/本月/本年/全部/自定义区间统计。
- 复盘笔记：支持全局笔记和按股票管理笔记。
- 用户系统：注册、登录、验证码、个人信息、修改密码。
- 配置管理：支持修改同花顺股票详情链接前缀。

## 快速开始

### 1. 环境要求

- .NET SDK 10
- Node.js 20.19+ 或 22.12+
- PostgreSQL
- Redis

### 2. 基础配置

后端配置文件在 [AspireReact.Server/appsettings.json](AspireReact.Server/appsettings.json)。

至少需要确认以下配置：

- `ConnectionStrings:PostgreSQL`
- `Redis:ConnectionString`
- `Jwt`
- `RapidOcr`
- `Tonghuashun:LinkPrefix`

说明：

- `RapidOcr.AutoDownloadModels=true` 时，首次识别截图会自动下载 OCR 模型到 `AspireReact.Server/RuntimeData/RapidOcr`。
- 如果你修改了数据库或 Redis 地址，前后端都不需要额外改代码，只要改配置即可。

### 3. 启动方式

#### 方式 A：通过 Aspire AppHost 启动

```bash
dotnet run --project AspireReact.AppHost
```

默认前端入口为：

```text
http://localhost:5516
```

适合日常开发，前端会自动通过服务发现代理到后端。

#### 方式 B：前后端分开启动

先启动后端：

```bash
dotnet run --project AspireReact.Server/AspireReact.Server.csproj --urls http://127.0.0.1:6202
```

再启动前端：

```bash
cd frontend
npm install
SERVER_HTTP=http://127.0.0.1:6202 npm run dev
```

Vite 会把 `/api` 请求代理到 `SERVER_HTTP`。

## 使用流程

### 首次使用

1. 打开登录页。
2. 切换到注册模式。
3. 获取验证码，填写邮箱、用户名、密码后完成注册。
4. 登录进入首页。

### 日常录入

推荐使用当前主入口：

- 录入页：`/entry/unified`
- 数据列表：`/list/unified`

常见流程：

1. 在统一录入页手动填写账户资金、银证流水、交易持仓。
2. 或上传券商截图，先识别回填。
3. 检查识别结果。
4. 点击“一键保存识别结果”或分别保存表单。
5. 到数据列表或统计页复核结果。

## 图片识别导入

统一录入页支持图片识别导入，当前支持：

- 同花顺手机端持仓页整屏截图
- 包含“当日买入 / 当日卖出 / 买入均价 / 卖出均价 / 收盘价”的流水表截图
- 左侧为账户历史汇总、右侧为当日流水明细的组合截图

识别流程：

1. 选择图片。
2. 指定导入日期。
3. 点击“识别并回填”。
4. 页面会显示识别原图，便于对照。
5. 识别结果不会直接入库，而是先回填到表单。
6. 确认无误后点击“一键保存识别结果”。

当前识别会尝试回填：

- 交易日期
- 账户总资产、持仓市值、可用资金、当日盈亏
- 银证转入/转出金额
- 股票代码、名称、板块
- 买入/卖出数量与价格
- 持仓数量、当日盈亏、累计盈亏
- 清仓状态

## 主要页面

- `/dashboard`：首页概览，展示最近交易日期、当日盈亏、区间统计和最近记录。
- `/entry/unified`：统一录入页，包含手工录入和图片识别导入。
- `/list/unified`：统一列表页，查看账户、流水、交易三类数据。
- `/statistics`：统计汇总页。
- `/notes/global`：全局复盘笔记。
- `/notes/stock`：按股票查看笔记。
- `/config`：系统配置。
- `/profile`：个人资料与密码管理。

兼容页面仍保留：

- `/entry/account`
- `/entry/bankflow`
- `/entry/trade`
- `/list/account`
- `/list/bankflow`
- `/list/trade`

## 后端接口概览

主要控制器如下：

- `api/auth`：注册、登录、验证码、个人信息、修改密码
- `api/account`：账户资金 CRUD、最新记录
- `api/bankflow`：银证流水 CRUD、最近记录
- `api/stocktrade`：交易记录 CRUD、批量新增/修改、统计汇总
- `api/stock`：股票搜索、详情、缓存统计、缓存刷新
- `api/note`：全局/个股笔记 CRUD
- `api/dashboard`：首页概览数据
- `api/config`：系统配置
- `api/portfolio-import/screenshot`：券商截图识别导入

## 目录说明

```text
AspireReact.AppHost/     Aspire 编排入口
AspireReact.Server/      .NET 10 后端 API
frontend/                React 前端
心魔录-项目文档.md         详细中文使用文档
```

## 详细文档

更完整的页面说明、接口说明、数据结构和图片识别说明见：

[心魔录-项目文档.md](心魔录-项目文档.md)
