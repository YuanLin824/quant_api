# 架构设计

## 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫、请求日志中间件
- **AppSetup** (`src/app.setup.ts`) — 应用公共装配（Helmet / CORS / 全局前缀 / 校验管道），由 `main.ts` 与 e2e 测试共用，避免测试环境与线上配置漂移
- **AppController / AppService** (`src/app.controller.ts` / `src/app.service.ts`) — 健康检查接口，返回服务状态、版本号、运行时长与内存占用
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **StockKlineModule** (`src/stock-kline/`) — 股票 K 线服务；
  每交易日 17:45 从通达信同步全市场 A 股日 K（近 1 年回补 + 自适应增量）、19:00 整窗重取
  五个分钟周期（1m/5m/15m/30m/60m，保留最近 5 个交易日、超窗即清理），统一落表 `stock_kline`；
  对外提供单端点分页查询（需登录），刻意不提供手动触发接口（一轮同步以十分钟计）
- **StockSymbolsModule** (`src/stock-symbols/`) — 股票标的（代码表）服务；
  每交易日 17:30 从同花顺同步个股与指数/板块并 upsert 落库（表 `stock_symbols`），
  同时对外提供分页查询、同步状态概要、手动触发同步三个接口（均需登录）
- **StockTradingDaysModule** (`src/stock-trading-days/`) — 交易日历服务；
  每天凌晨 3 点从同花顺同步近一年交易日并 upsert 落库（表 `trading_days`），
  同时对外提供手动触发同步的接口（需登录）
- **ApiThsModule** (`src/api-ths/`) — 同花顺数据源接入，纯服务层（无 controller），契约见 `API_THS.md`；
  已实现「标的列表获取」「交易日历」，并收口通用请求层（鉴权 / 超时 / 信封解包 / 错误码映射）
- **ApiTdxModule** (`src/api-tdx/`) — 通达信数据源接入，纯服务层（无 controller），契约见 `API_TDX.md`；
  基于 `node-tdx-market` 的 **TCP 长连接**（懒连接、断线重连），已实现 **K 线**（多周期，含分钟级）
- **Common** (`src/common/`) — 跨模块共享件：`BaseEntity` 实体基类、全局异常过滤器、请求日志中间件
- **Config** (`src/config/`) — 配置集中管理：`ENV_KEYS` 常量、`registerAs` 命名空间配置、Winston 日志器
- **PostgresModule** (`src/database/postgres.module.ts`) — TypeORM 数据源配置
- **RedisModule** (`src/database/redis.module.ts`) — ioredis 连接管理

## 关键设计决策

1. **JWT 双密钥方案**: access token 和 refresh token 使用不同密钥签名，防止密钥误用。JwtModule 不注册默认 secret，guard 验签时显式传入各自密钥。
   - **内置管理员（`QuantAdmin`）的 access token 用固定 24 小时**（`auth.constants.ts` 的 `ADMIN_ACCESS_EXPIRES_IN`），其余用户走 `JWT_ACCESS_EXPIRES_IN` 配置（默认 15 分钟）。这是**刻意的不对称**：管理员多用于运维与调试，频繁续期不便；代价是 token 泄露后的可用窗口变长，故只对这一个内置账户生效
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

8. **同花顺数据源（api-ths）**: 请求层在 `ApiThsService` 的私有 `request()` 中收口——注入 `X-api-key`、`AbortSignal.timeout` 超时、解包 `{ code, message, request_id, data }` 信封、上游错误码经 `THS_ERROR_MAP` 映射为内置异常（表结构对齐 `DB_ERROR_MAP`）。
   - **`THS_API_KEY` 缺失不阻塞启动**：与 Redis / JWT 的 fail-fast 相反，缺 Key 只在发起请求时抛 503。同花顺是可选外部数据源，不应因未配置就阻止「本地只调认证接口」或「CI 无密钥跑测试」
   - **不做自动重试、翻页串行**：契约明确要求限流（HTTP 429 / `code=4001`）时避免立即连续重试；`getAllTickers()` 因此串行翻页，并设轮数上限兜底防上游行为异常导致死循环
   - **服务层自带入参校验**：本模块没有 controller，不经全局 ValidationPipe，DTO 上的校验装饰器**不会自动生效**——故由 `assertValidDto()` 在服务入口用 `validate()` 显式触发。异常消息传字符串而非数组，否则 `HttpException` 会把数组消息退化成构造器名（`Bad Request`）
   - **交易日历带 6 小时内存缓存**：该接口无入参、固定返回「近一年」窗口，一天最多变一次，不必每次都打上游；缓存**只在结果非空时写入**，避免上游异常把「空日历」缓存住

9. **标的代码表同步（stock-symbols）**: 定时（每交易日 17:30）同步同花顺的 `a-share` + `a-share-index` 并落库。
   采用**增量 upsert**（`conflictPaths: ['thscode']`，行的 `id` 跨轮次保持稳定），上游本轮未返回的标的**不删除**，
   而是置 `delistedAt` 标记为「已消失」，使下游能按 thscode 稳定引用而不产生悬空引用。
   - **两段式标记**：事务内先全量置 `delistedAt`、再由 upsert 把本轮返回的置回 `NULL`——不比较时间戳，规避 NTP 回拨导致的漏标
   - **实体不继承 `BaseEntity`**：表结构直接映射上游 `ThsTickerItem` 的**全部字段**，以 `thscode` 为主键——省去代理主键 uuid，也让 upsert 的冲突键与主键合一；代码表没有「人工停用」需求，故不需要 status / 软删除那一套。仅额外保留两个本地字段：`syncAt`（最后同步时间）与 `delistedAt`（退市标记）
   - **网络在事务外 + upsert 按 1000 行分片**：一次 sweep 最坏几十秒，进事务会长期占用连接池；全量约 7000 行 × 9 列会逼近 PostgreSQL 的 65535 绑定参数上限（`EntityManager.upsert` **不自动分片**）
   - **两道上游异常护栏**：返回空列表时跳过写入；返回量不足存量活跃数一半时只写入、不标记——都为防止把大批正常标的误判为退市
   - **重入返回 `skipped` 而非抛异常**：防重入标志由定时任务、启动补齐、手动接口三方共用；返回 `skipped` 让手动接口能回「已有同步正在进行中」（HTTP 200）而不是向调用方抛 409

10. **交易日历同步（stock-trading-days）**: 与标的代码表同范式（定时 + 启动补齐 + 防重入），但本表是**追加型**数据：
    - **不做「标记消失」**：上游每次只返回近一年窗口，本表保留全部历史——窗口滑动不该删除更早的交易日，实体因此也不需要 `delistedAt` 那类失效标记
    - **主键用 `date`（yyyyMMdd）**：与 `thscode` 同理，天然唯一且稳定，让 upsert 的冲突键与主键合一
    - **窗口右边界是「今日」**：日历只有过去、没有未来，所以「上一交易日」可算、「下一交易日」不能算

11. **`main.ts` 启用了关闭钩子**: `app.enableShutdownHooks()` 让 SIGTERM / SIGINT（容器停止、Ctrl+C）触发 `onModuleDestroy`，使 Redis 等长连接资源优雅释放（未启用时它们只在显式 `app.close()` 时才触发）。
12. **通达信数据源（api-tdx）**: 基于 `node-tdx-market` 直连通达信公开行情服务器（**TCP 长连接**，非 HTTP，免费零鉴权）。
    - **连接所有权在模块**（与 `RedisModule` 同范式）：工厂创建客户端并挂 `error`/`connected` 监听，`onModuleDestroy` 里断开；**懒连接的触发在 service**——首次调用才 `connect()` 并缓存 Promise，失败或断线事件时清空以便重连（启动阶段不连接，行情服务器不可用不影响应用启动）
    - **隔离底层细节**：对外用项目的 thscode（`600519.SH`）与自定义周期枚举（`1m`…`year`），内部才转成库要求的 `sh600519` 与 `KlineCategory`
    - ⚠️ **周期映射用数值字面量**：库把 `KlineCategory` 声明为 `const enum`，而本项目开启了 `isolatedModules`（会报 TS2748 无法访问 ambient const enum），故映射表直接写数值并注明来源——**升级该依赖时需核对这张表**
    - **单位换算**：价格与成交额上游都是「厘」（元 × 1000），对外统一换算为元；成交量单位是「手」，已是可读量级故透传
    - 该源也提供分时数据，但**每分钟只有成交价与量、没有开高低**，且历史分时均价字段上游失真（实测茅台均价算成 1~3 元），故未采用——K 线有标准 OHLC，满足技术分析需求

13. **K 线同步（stock-kline）**: 日 K 与分钟 K **均来自通达信**（此前日 K 曾走同花顺的「历史 K 线」，
    已整体切换并**删除**了该能力——单一数据源、不依赖 THS key，且其 count 语义让日 K 也能整窗重取）。
    两者统一存于单表 `stock_kline`，复合主键 `(thscode, category, datetime)`——同构
    （都有标准 OHLC），差异只在 `category` 与保留策略。
    - **datetime 混合长度**：日 K 为 `yyyyMMdd`（8 位）、分钟 K 为 `yyyyMMddHHmm`（12 位）；
      同类别内字典序即时间序，跨类别比较会错位（`'20261008' < '202610080000'`），
      查询边界因此**按 category 分流补零**（收口在 `StockKlineService.findKlines()`）
    - **单位统一为「元 / 股」**：通达信成交量上游是「手」（×100 换算），价格已是元
    - **时间取本地 getter**：`bar.time` 是库用**本地时区构造函数**拼出的 Date（字段值即中国墙钟时间），
      按其本地字段拼 `datetime` 即可——**不能**按 Asia/Shanghai 格式化（非中国时区机器上会偏移 8 小时）
    - **日 K 自适应整窗回取**：首次回补 250 根（≈ 近 1 年）；之后按「与在库最新日期的自然日间隔
      × 5/7 + 10 根余量」推算需回取的根数（上限 800）——固定小窗口在长停机后会在日 K 历史里
      留下**永久空洞**（日 K 从不清理），自适应可避免
    - **分钟 K 每夜整窗重取 = 幂等自愈**：窗口取「恰好 5 个交易日」（= 保留窗；`1m` 因单次上限
      800 根拆两个窗口 800+400），每轮运行都会把保留窗完整铺满，漏跑一夜由下一轮覆盖；
      刻意不留余量——多取的根数只会「当夜先写入、再被清理删掉」
    - **写入用 `skipUpdateIfNoValuesChanged`**：行对象不带 `syncAt`（列默认 `now()`），
      未变化行不产生新版本——否则每夜会把千万行级的整张表重写一遍（索引膨胀与 WAL 尖峰）；
      写库前按主键**批内去重**（PG 不允许同批出现重复冲突键，一行重复会让整个分片写入失败）
    - **清理以数据自身为界**：取「最近 5 个不同日期」作保留窗左边界，节假日自动正确，不引入交易日历依赖
    - **启动补齐（表空才跑，fire-and-forget）+ 熔断**：连续 20 只失败且零成功即中止本轮
      （多为行情服务器不可达；退市、停牌股的零星失败不会误触发）

> `@nestjs/schedule` 锁定在 **6.x**：12.x 起该包 ESM-only，与本项目 CJS 体系冲突，详见 `development.md` 的定时任务章节。

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
