# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

量化交易系统 API，基于 NestJS 11 + TypeORM + PostgreSQL + Redis 构建。提供用户认证（JWT 双密钥方案）和股票行情查询（A股/港股/美股）功能。

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
```

## 架构设计

### 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **StockModule** (`src/stock/`) — 股票行情模块，调用新浪/腾讯/Yahoo 免费 API
- **PostgresModule** (`src/database/postgres.module.ts`) — TypeORM 数据源配置
- **RedisModule** (`src/database/redis.module.ts`) — ioredis 连接管理

### 关键设计决策

1. **JWT 双密钥方案**: access token 和 refresh token 使用不同密钥签名，防止密钥误用。JwtModule 不注册默认 secret，guard 验签时显式传入各自密钥。

2. **多设备控制**: 基于 Redis Hash 存储用户设备会话（key: `auth:devices:{userId}`），默认最多 5 个设备同时登录，超限踢出最早登录设备。

3. **令牌轮换**: 每次刷新令牌时，旧 refresh token 的 jti 立即从白名单移除，实现单次使用。

4. **环境变量配置**: 使用 `@nestjs/config` 的 `registerAs` 命名空间机制，配置键名集中在 `src/config/constants.ts` 的 `ENV_KEYS` 对象中。

5. **实体基类**: 所有业务实体继承 `BaseEntity` (`src/common/base.entity.ts`)，获得 UUID 主键、状态字段、创建/更新时间、软删除支持。

### 安全机制

- Helmet 安全头（CSP、HSTS、XSS 保护）
- 全局限流：60 秒内最多 100 次请求
- 登录限流：10 分钟内最多 10 次尝试
- 密码 bcrypt 加密（12 轮）
- 防时序攻击：密码比对使用恒定时间算法
- 请求体大小限制：10KB

## 环境变量

必需：

```bash
PG_URL="postgres://user:pass@host:port/db"
REDIS_URL="redis://user:pass@host:port/db"
JWT_ACCESS_SECRET_KEY="至少32字符的密钥"
JWT_REFRESH_SECRET_KEY="至少32字符的密钥（不能与access相同）"
```

可选：

```bash
PORT="3001"                    # 默认 3000
API_PREFIX="/api"              # 默认 /api
JWT_ACCESS_EXPIRES_IN="15m"   # 默认 15 分钟
JWT_REFRESH_EXPIRES_IN="7d"   # 默认 7 天
AUTH_MAX_DEVICES="5"          # 默认 5 个设备
REDIS_KEY_PREFIX="quant-"     # Redis key 前缀
ALLOWED_ORIGINS="https://example.com"  # 生产环境必须配置
```

## 开发流程

1. 启动数据库：`docker compose up -d`
2. 配置环境变量：复制 `.env.example` 为 `.env` 或 `.env.development.local`
3. 启动开发服务器：`npm run start:dev`
4. 访问 API：`http://localhost:3001/api`

默认管理员账户：`QuantAdmin` / `Quant.Admin`

## 代码规范

- api 有变动时, 自动更新 API.md 文档
- 使用 TypeScript 严格模式
- DTO 使用 class-validator 进行参数校验
- 控制器方法返回统一响应格式 `{ code, message, data }`
- 环境变量键名必须定义在 `ENV_KEYS` 中
- 配置命名空间使用 `CONFIG_MODULES` 中的 Symbol
- 从不自动提交任何代码
- DEVELOPMENT-PLAN.md 是开发计划文档，所有开发计划和任务都在此文档中列出
- git 提交代码使用 `commitlint` + `lintstage` 进行约束 (提交信息必须带上 Emoji)
- docker-compose 默认已执行过
- 不自动启动任何服务，需要启动其他服务时，要进行授权确认
