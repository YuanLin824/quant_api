# 架构设计

## 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫、请求日志中间件
- **AppSetup** (`src/app.setup.ts`) — 应用公共装配（Helmet / CORS / 全局前缀 / 校验管道），由 `main.ts` 与 e2e 测试共用，避免测试环境与线上配置漂移
- **AppController / AppService** (`src/app.controller.ts` / `src/app.service.ts`) — 健康检查接口，返回服务状态、版本号、运行时长与内存占用
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **TdxModule** (`src/tdx/`) — 行情模块，基于 `node-tdx-market`（通达信 TCP 协议），提供 K线 / 五档盘口（批量） / 当日与历史分时 / 当日与历史分笔成交 / 证券数量 / 全量证券列表
- **WestockModule** (`src/westock/`) — 证券数据模块，通过子进程调用两个第三方 CLI，提供证券搜索、当日/五日分时与 K 线数据
- **Common** (`src/common/`) — 跨模块共享件：`BaseEntity` 实体基类、全局异常过滤器、请求日志中间件、校验装饰器
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

5. **实体基类**: 所有业务实体继承 `BaseEntity` (`src/common/base.entity.ts`)，获得 UUID 主键、状态字段、创建/更新时间、软删除支持。

6. **行情接口不限流**: TdxController 整体 `@SkipThrottle()`，仅在 `auth` 模块按接口配置限流。理由是行情数据为公开信息，且底层连接已串行化请求。

7. **异常统一收口**: 全局 `AllExceptionsFilter` 将 HttpException、TypeORM `QueryFailedError`（按 PostgreSQL 错误码映射）及未知异常统一为 `{ code, data, message }`，并记录含客户端 IP 的结构化日志。
   - **失败时 `data` 恒为 `null`**：具体原因一律由 `message` 承载，不再把 Nest 的原始响应对象塞进 `data`（那会让 `{ message, error, statusCode }` 与顶层字段重复）
   - **校验错误并入 `message`**：ValidationPipe 抛出的 `BadRequestException`，其 `exception.message` 只有固定的 `Bad Request Exception`，故优先取 `getResponse().message` 数组并以 `; ` 连接，保证调用方能定位到具体参数

8. **通达信行情模块**: `TdxModule` (`src/tdx/`) 基于 `node-tdx-market`（通达信 TCP 协议）提供 8 个查询接口。
   - **长连接管理**：与服务端维持一条 TCP 长连接（区别于常见的 HTTP 行情接口）。启动时主动建连但**不阻塞应用启动**——行情服务不可达只记 warn；请求前检查连接状态（懒连接兜底），断线重连由库的 `autoReconnect` 负责；模块销毁时断开
   - **价格单位为厘（元 × 1000）**：上游解析结果**原样透传**，不在网关层做字段级换算——价格字段散布在 K线、盘口、分时、分笔、证券列表等各类响应中，逐个转换容易遗漏，改由文档显著说明
   - **连接不可用时返回 503**（而非 500）：区分「依赖服务不可用」与「服务内部错误」
   - **不使用库的 `KlineCategory`**：它是 `declare const enum`，与 tsconfig 的 `isolatedModules: true` 冲突（值位置不可用），改用 `tdx.constants.ts` 的数值映射表，对调用方暴露 `1m`/`day`/`week` 等语义化取值

9. **WeStock 子进程调用**: `WestockService` 用 `execFile` 调用第三方 CLI，是本项目**唯一使用子进程**的地方。
   - **用到两个 CLI，能力互补**：`westock-data-clawhub`（`src/scripts/` 下的单文件 bundle，不入库）负责 search 与 minute；腾讯 Go CLI（`src/scripts/westock.exe`，由 setup 脚本下载）负责 kline。之所以不能统一——clawhub 的 kline **不支持分钟周期**（传 `m1`/`5m` 等会**静默回退到日线**，调用方会拿到错误粒度的数据），而 Go CLI 没有 minute 命令
   - **两者启动方式不同**：bundle 经 `process.execPath` 执行入口（Windows 下 `.bin` 是 shell 脚本，execFile 无法直接运行），Go CLI 直接执行二进制
   - **由 nest-cli 的 assets 同步到 `dist/`**：`dist/` 是 `src/` 的镜像，但 tsc 只编译 `.ts`，故 `nest-cli.json` 需显式配置把 `src/scripts/**` 拷进 `dist/scripts/`，否则 prod（`node dist/main`）找不到入口。用 `**` 而非只拷 `.mjs`，是为了让 dist 自包含——二进制缺失时可在目标机器直接跑 `dist/scripts/setup.*` 重新获取。有此配置后，`src/westock/` 与 `dist/westock/` 都可用 `../scripts/` 定位，dev 与 prod 的路径解析一致
   - **bundle 扩展名必须是 `.mjs`**：源文件是 ESM，而本项目 `package.json` 无 `type: module`，用 `.js` 会让 Node 先按 CommonJS 解析失败再回退重解析——既慢又喷 warning
   - **参数以数组传递、不经 shell**：天然免疫命令注入；多代码以逗号分隔**整体作为单个 argv**
   - **K 线日期参数原样转发、不代填**：`start`/`end` 只在调用方显式传入时才追加，缺的一端交给上游取默认值（`1990-12-01` / 当日）。跨度校验因此也只在两端都传入时才有意义
   - **退出码不可靠**：两个 CLI 对「无结果」「参数非法」「上游报错」都返回退出码 0，仅凭退出码无法区分。故一律解析输出内容——已知的无结果文案（`数据为空`/`无分时数据`）视为空结果（返回空数组，**非错误**），解析不出表格则报 503
   - **输出无 JSON 开关**：成功时是一张扁平 Markdown 表格，**列随命令变化**（search 三列、minute 五/六列、kline 九列且多代码时多一列 `code`；多代码另有 `[Batch]` 摘要行，不以 `|` 开头故被自然跳过）。解析器 `westock.parser.ts` 因此独立成纯函数便于单测，列名一律从表头读取（不硬编码），按 `columns` + 行对象表达
   - **超时用 504**（而非 408）：客户端发得快、是上游慢，504 语义更准
   - **不豁免限流**（与 TdxModule 有意偏离）：每次请求 fork 一个子进程并请求第三方上游，不是复用长连接。上游自身也有限流，密集调用会返回「请求过于频繁」

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
- 全局限流：60 秒内最多 60 次请求（行情接口豁免）
- 登录限流：10 分钟内最多 10 次尝试
- 登录失败锁定：连续失败 5 次后锁定 15 分钟（计数 key `auth:fail:{username}`）
- 密码 bcrypt 加密（12 轮）
- 防时序攻击：密码比对使用恒定时间算法，用户不存在时执行等价比对以避免时序差异
- 防用户名枚举：用户不存在与密码错误返回相同消息
- 请求体大小限制：10KB
- 生产环境强制配置 `ALLOWED_ORIGINS`，否则启动失败
