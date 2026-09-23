# 架构设计

## 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫、请求日志中间件
- **AppSetup** (`src/app.setup.ts`) — 应用公共装配（Helmet / CORS / 全局前缀 / 校验管道），由 `main.ts` 与 e2e 测试共用，避免测试环境与线上配置漂移
- **AppController / AppService** (`src/app.controller.ts` / `src/app.service.ts`) — 健康检查接口，返回服务状态、版本号、运行时长与内存占用
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **Common** (`src/common/`) — 跨模块共享件：`BaseEntity` 实体基类、全局异常过滤器、请求日志中间件
- **Config** (`src/config/`) — 配置集中管理：`ENV_KEYS` 常量、`registerAs` 命名空间配置、Winston 日志器
- **PostgresModule** (`src/database/postgres.module.ts`) — TypeORM 数据源配置
- **RedisModule** (`src/database/redis.module.ts`) — ioredis 连接管理

## 关键设计决策

1. **JWT 双密钥方案**: access token 和 refresh token 使用不同密钥签名，防止密钥误用。JwtModule 不注册默认 secret，guard 验签时显式传入各自密钥。
   两个守卫继承 `BaseJwtGuard` (`src/auth/guards/base-jwt.guard.ts`)，共同流程（提取 Bearer 令牌 → 验签 → 校验载荷 → 挂载 `req.user`）在基类收口；
   子类经 `super()` 传入密钥选择器与错误消息，基类在**构造期解析并缓存**（勿移入 `canActivate`，否则认证热路径每请求重复读配置），子类再实现 `isPayloadValid` 声明令牌类型校验。

2. **多设备控制**: 基于 Redis Hash 存储用户设备会话（key: `auth:devices:{userId}`，field 为 refresh token 的 jti，value 为设备信息 JSON），默认最多 5 个设备同时登录。
   - 超限淘汰：先清理已过期的条目，再淘汰 `loginAt` 最早者
   - **不做 key 级 TTL** —— 那会让整个会话集合集体过期；改为条目内记录 `expiresAt` + 惰性清理

3. **令牌轮换**: 每次刷新令牌时，旧 refresh token 的 jti 立即从白名单移除，实现单次使用。旧 token 重用会被 `hGet` 判空拦截。

4. **环境变量配置**: 使用 `@nestjs/config` 的 `registerAs` 命名空间机制，配置键名集中在 `src/config/constants.ts` 的 `ENV_KEYS` 对象中。

5. **实体基类**: 业务实体继承 `BaseEntity` (`src/common/base.entity.ts`)，获得 UUID 主键、状态字段、创建/更新时间、软删除支持。

6. **限流策略**: 全局限流由 `APP_GUARD` 的 `ThrottlerGuard` 提供（60 秒 60 次，按 IP），`auth` 模块在此之上按接口差异化
   （注册/改密 5 次/时、登录 10 次/10 分、刷新 20 次/10 分；两个登出用 `@SkipThrottle` 豁免——登出是幂等的清理动作）。

7. **异常统一收口**: 全局 `AllExceptionsFilter` 将 HttpException、TypeORM `QueryFailedError`（按 PostgreSQL 错误码映射）及未知异常统一为 `{ code, data, message }`，并记录含客户端 IP 的结构化日志。
   - **失败时 `data` 恒为 `null`**：具体原因一律由 `message` 承载，不再把 Nest 的原始响应对象塞进 `data`（那会让 `{ message, error, statusCode }` 与顶层字段重复）
   - **校验错误并入 `message`**：ValidationPipe 抛出的 `BadRequestException`，其 `exception.message` 只有固定的 `Bad Request Exception`，故优先取 `getResponse().message` 数组并以 `; ` 连接，保证调用方能定位到具体参数

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
- 全局限流：60 秒内最多 60 次请求（按 IP），`auth` 另按接口收紧（注册/改密 5 次/时、登录 10 次/10 分、刷新 20 次/10 分）
- 登录限流：10 分钟内最多 10 次尝试
- 登录失败锁定：连续失败 5 次后锁定 15 分钟（计数 key `auth:fail:{username}`）
- 密码 bcrypt 加密（12 轮）
- 防时序攻击：密码比对使用恒定时间算法，用户不存在时执行等价比对以避免时序差异
- 防用户名枚举：用户不存在与密码错误返回相同消息
- 请求体大小限制：10KB
- 生产环境强制配置 `ALLOWED_ORIGINS`，否则启动失败
