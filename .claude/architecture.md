# 架构设计

## 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **StockApiModule** (`src/stock-api/`) — 股票行情模块，调用新浪/腾讯/Yahoo 免费 API
- **StockSdkModule** (`src/stock-sdk/`) — 股票行情模块，调用 stock-sdk 库，支持 A 股/港股/美股/基金
- **PostgresModule** (`src/database/postgres.module.ts`) — TypeORM 数据源配置
- **RedisModule** (`src/database/redis.module.ts`) — ioredis 连接管理

## 关键设计决策

1. **JWT 双密钥方案**: access token 和 refresh token 使用不同密钥签名，防止密钥误用。JwtModule 不注册默认 secret，guard 验签时显式传入各自密钥。

2. **多设备控制**: 基于 Redis Hash 存储用户设备会话（key: `auth:devices:{userId}`），默认最多 5 个设备同时登录，超限踢出最早登录设备。

3. **令牌轮换**: 每次刷新令牌时，旧 refresh token 的 jti 立即从白名单移除，实现单次使用。

4. **环境变量配置**: 使用 `@nestjs/config` 的 `registerAs` 命名空间机制，配置键名集中在 `src/config/constants.ts` 的 `ENV_KEYS` 对象中。

5. **实体基类**: 所有业务实体继承 `BaseEntity` (`src/common/base.entity.ts`)，获得 UUID 主键、状态字段、创建/更新时间、软删除支持。

## 安全机制

- Helmet 安全头（CSP、HSTS、XSS 保护）
- 全局限流：60 秒内最多 100 次请求
- 登录限流：10 分钟内最多 10 次尝试
- 密码 bcrypt 加密（12 轮）
- 防时序攻击：密码比对使用恒定时间算法
- 请求体大小限制：10KB
