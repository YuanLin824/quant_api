# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

量化交易系统 API，基于 NestJS 11 + TypeORM + PostgreSQL + Redis 构建。提供用户认证（JWT 双密钥方案）和股票行情查询功能。

**TdxModule / WestockCliModule / WestockDataModule / StockSdkModule 是内部数据源，不对外暴露 HTTP 接口**，只供其他模块注入：

- **TdxModule** — 基于 `node-tdx-market`（通达信 TCP 协议）直连行情服务器，提供 K线/五档盘口/分时/分笔成交/证券列表
- **WestockCliModule** — 通过子进程调用腾讯 Go CLI（`src/scripts/westock.exe`），提供 K 线与统一搜索
- **WestockDataModule** — 通过子进程调用 `src/scripts/westock-data-clawhub.mjs`（单文件 bundle），提供搜索与分时
- **StockSdkModule** — 通过 `stock-sdk`（npm 包，HTTP 公开数据源）获取 A股/港股/美股/基金代码，纯透传不落库

对外提供的行情接口只有三个模块：

- **StockSymbolsModule** — 每日 08:00 定时通过 `stock-sdk` 同步全量证券代码入库，提供手动触发与数量统计接口（具体代码的获取是 service 内部能力）
- **StockSearchModule** — 经 WestockCliModule **按关键词实时搜索**（不落库），支持类型/市场/分页；多类型时响应**按类型分段**
- **StockKlineModule** — 每日 16:00 经 TdxModule 同步 A 股全市场日线（首次回补近两年，之后增量补最新几根）落库到 `daily_klines` 表；`GET /api/stock-kline` 查询走 WestockCliModule（腾讯 Go CLI）**实时拉取、不读库**，由 `period`（`m1`~`m120`/`day`/`week`/`month`/`season`/`year`）+ `fq`（`qfq`/`hfq`/`bfq`/`nofq`，不传为上游默认的前复权）+ `start`（默认 `1990-07-31`）+ `end`（可选）限定

## 常用命令

```bash
# 开发
npm run start:dev          # 启动开发服务器（监听文件变化）
npm run start:debug        # 启动调试模式

# 构建与运行
npm run build              # 生产环境构建
npm run start:prod         # 运行生产版本

# 测试
npm test                   # 运行单元测试
npm run test:watch         # 监听模式运行测试
npm run test:e2e           # 运行端到端测试
npm run test:cov           # 运行测试并生成覆盖率报告

# 代码质量
npm run lint               # ESLint 检查并自动修复
npm run format             # Prettier 格式化

# 数据库
docker compose up -d       # 启动 PostgreSQL 和 Redis 容器

# 提交
npm run commit             # czg 交互式生成符合 commitlint 规范的提交信息
```

> `start:dev` / `start:prod` 分别注入 `NODE_ENV=dev` / `NODE_ENV=prod`，
> 该变量决定 `.env.*` 加载文件与 CORS 策略（`IS_PROD` 依据它判断），详见[环境变量](./.claude/environment.md)。

## 代码规范

- api 有变动时, 自动更新 API.md 文档
- 使用 TypeScript 严格模式（`tsconfig.json` 已开启 `strictNullChecks`、`noImplicitAny`、`strictBindCallApply`，未启用完整 `strict`）
- DTO 使用 class-validator 进行参数校验
- 控制器方法返回统一响应格式 `{ code, message, data }`
- 环境变量键名必须定义在 `ENV_KEYS` 中
- 配置命名空间使用 `CONFIG_MODULES` 中的 Symbol
- 从不自动提交任何代码
- commitlint.config.cjs 是 commitlint 的配置文件(按照这个格式 type(scope): emoji subject 生成提交信息)
- docker-compose 默认已执行过
- 不自动启动任何服务，需要启动其他服务时，要进行授权确认
- 模块的 dto 相关的放到 `模块/dto` 目录下，每个接口的 dto 对应一个文件；
  模块级共享的枚举/常量放 `模块/模块.constants.ts`，跨模块复用的校验装饰器放 `common/decorators/`
- DTO 校验优先复用已有的组合装饰器（如 `IsCodeArray`），避免在各 DTO 中重复堆砌校验装饰器

## 更多文档

| 文档                                      | 说明                                                 |
| ----------------------------------------- | ---------------------------------------------------- |
| [架构设计](./.claude/architecture.md)     | 模块结构、关键设计决策、安全机制                     |
| [环境变量](./.claude/environment.md)      | 必需和可选环境变量配置                               |
| [开发流程](./.claude/development.md)      | 启动服务、默认账户、文档结构                         |
| [API 文档](./API.md)                      | 基础信息、认证与限流、错误码；拆分到 `docs/api-*.md` |
| [WESTOCK CLI](./WESTOCK_CLI.md)           | westock（腾讯 Go CLI）命令用法                       |
| [WESTOCK DATA](./WESTOCK_DATA_CLAWHUB.md) | westock-data-clawhub 命令用法                        |
