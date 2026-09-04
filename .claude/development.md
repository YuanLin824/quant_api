# 开发流程

## 启动服务

1. 启动数据库：`docker compose up -d`
2. 配置环境变量：复制 `.env.example` 为 `.env` 或 `.env.development.local`
3. 启动开发服务器：`npm run start:dev`
4. 访问 API：`http://localhost:3001/api`

## 默认管理员账户

- **用户名**: `QuantAdmin`
- **密码**: `Quant.Admin`

## 文档结构

API 文档已拆分到 `docs` 目录：

- `docs/index.md` — 基础信息、通用响应格式、错误码说明
- `docs/health.md` — 健康检查接口
- `docs/auth.md` — 认证接口（注册、登录、刷新、登出、用户信息）
- `docs/stock-api.md` — Stock API 接口（行情、K线、搜索）
- `docs/stock-sdk.md` — Stock SDK 接口（股票、基金、搜索）
- `docs/config.md` — 系统配置（认证机制、环境变量、开发环境）
