# 架构设计

## 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫、请求日志中间件
- **AppSetup** (`src/app.setup.ts`) — 应用公共装配（Helmet / CORS / 全局前缀 / 校验管道），由 `main.ts` 与 e2e 测试共用，避免测试环境与线上配置漂移
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **StockApiModule** (`src/stock-api/`) — 股票行情模块，基于 `stock-api` 库，`stocks.auto` 在 tencent → sina → eastmoney 间自动兜底
- **StockSdkModule** (`src/stock-sdk/`) — 股票行情模块，基于 `stock-sdk` 库，提供行情 / K线（含技术指标） / 信号 / 大单 / 代码列表，支持 A 股/港股/美股/基金
- **PostgresModule** (`src/database/postgres.module.ts`) — TypeORM 数据源配置
- **RedisModule** (`src/database/redis.module.ts`) — ioredis 连接管理

## 关键设计决策

1. **JWT 双密钥方案**: access token 和 refresh token 使用不同密钥签名，防止密钥误用。JwtModule 不注册默认 secret，guard 验签时显式传入各自密钥。
   两个守卫继承 `BaseJwtGuard` (`src/auth/guards/base-jwt.guard.ts`)，共同流程（提取 Bearer 令牌 → 验签 → 校验载荷 → 挂载 `req.user`）在基类收口，子类只声明密钥来源、错误消息与载荷校验规则。

2. **多设备控制**: 基于 Redis Hash 存储用户设备会话（key: `auth:devices:{userId}`，field 为 refresh token 的 jti，value 为设备信息 JSON），默认最多 5 个设备同时登录。
   - 超限淘汰：先清理已过期的条目，再淘汰 `loginAt` 最早者
   - **不做 key 级 TTL** —— 那会让整个会话集合集体过期；改为条目内记录 `expiresAt` + 惰性清理

3. **令牌轮换**: 每次刷新令牌时，旧 refresh token 的 jti 立即从白名单移除，实现单次使用。旧 token 重用会被 `hGet` 判空拦截。

4. **环境变量配置**: 使用 `@nestjs/config` 的 `registerAs` 命名空间机制，配置键名集中在 `src/config/constants.ts` 的 `ENV_KEYS` 对象中。

5. **实体基类**: 所有业务实体继承 `BaseEntity` (`src/common/base.entity.ts`)，获得 UUID 主键、状态字段、创建/更新时间、软删除支持。

6. **K线接口合并**: `GET /stock-sdk/kline/:market/:code` 单入口按参数分派 —— 分钟周期（`1/5/15/30/60`）优先走分钟K线接口，其次是带 `indicators` 的指标K线，否则走历史K线。分钟周期下 `indicators` 不再生效。

7. **分钟K线交易日自动定位**: `period=1` 且未指定日期范围时，依据 `sdk.calendar.marketStatus()` 判断当前所处交易时段：盘前/休市回退到前一交易日，交易中/午休/盘后取当天。避免盘前或非交易日请求到空数据。

8. **行情接口不限流**: StockApi / StockSdk 控制器整体 `@SkipThrottle()`，仅在 `auth` 模块按接口配置限流。理由是行情数据为公开信息，且上游 SDK 自带请求频率控制与数据源兜底。

9. **异常统一收口**: 全局 `AllExceptionsFilter` 将 HttpException、TypeORM `QueryFailedError`（按 PostgreSQL 错误码映射）及未知异常统一为 `{ code, data, message }`，并记录含客户端 IP 的结构化日志。

## 日志

- 使用 Winston 替代 NestJS 默认 Logger（`src/config/winston.ts`）：
  - **生产环境** — 写入 `logger_prod/`，按**小时**轮转（`YYYY-MM-DD-HH`），分 `info` / `warn` / `error` 三个等级文件，压缩归档，保留 14 天
  - **开发环境** — 彩色控制台输出
- `LoggerMiddleware` 记录请求的 IP、方法、路径、Body、Params、Query；日志写入采用**发射后不管**（不 `await`），避免磁盘 I/O 拖慢接口响应
- 敏感信息双重防护：
  1. **路由级** — `auth/login` 在 `AppModule.configure` 中被中间件排除
  2. **字段级** — `sanitize()` 递归脱敏 `password` / `oldPassword` / `newPassword` / `refreshToken`，统一替换为 `***`（覆盖嵌套对象与数组）

## 安全机制

- Helmet 安全头（CSP、HSTS、XSS 保护）
- 全局限流：60 秒内最多 100 次请求（行情接口豁免）
- 登录限流：10 分钟内最多 10 次尝试
- 登录失败锁定：连续失败 5 次后锁定 15 分钟（计数 key `auth:fail:{username}`）
- 密码 bcrypt 加密（12 轮）
- 防时序攻击：密码比对使用恒定时间算法，用户不存在时执行等价比对以避免时序差异
- 防用户名枚举：用户不存在与密码错误返回相同消息
- 请求体大小限制：10KB
- 生产环境强制配置 `ALLOWED_ORIGINS`，否则启动失败
