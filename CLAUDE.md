# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

量化交易系统 API，基于 NestJS 11 + TypeORM + PostgreSQL + Redis 构建。提供用户认证（JWT 双密钥方案）和股票行情查询（A股/港股/美股/基金）功能。

行情数据由两个独立模块提供，二者底层库不同、接口互不替代：

- **StockApiModule** — 基于 `stock-api` 库，`stocks.auto` 在 tencent → sina → eastmoney 间自动兜底
- **StockSdkModule** — 基于 `stock-sdk` 库，覆盖面更广（行情/K线/技术指标/信号/大单/代码列表）

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
- 模块的 dto 相关的放到 `模块/dto` 目录下，每个接口的 dto 对应一个文件

## 更多文档

| 文档                                  | 说明                             |
| ------------------------------------- | -------------------------------- |
| [架构设计](./.claude/architecture.md) | 模块结构、关键设计决策、安全机制 |
| [环境变量](./.claude/environment.md)  | 必需和可选环境变量配置           |
| [开发流程](./.claude/development.md)  | 启动服务、默认账户、文档结构     |

接口文档入口为 [API.md](./API.md)，按模块拆分到 `docs/` 目录。
