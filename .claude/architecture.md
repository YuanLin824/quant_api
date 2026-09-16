# 架构设计

## 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫、请求日志中间件
- **AppSetup** (`src/app.setup.ts`) — 应用公共装配（Helmet / CORS / 全局前缀 / 校验管道），由 `main.ts` 与 e2e 测试共用，避免测试环境与线上配置漂移
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **StockApiModule** (`src/stock-api/`) — 股票行情模块，基于 `stock-api` 库，`stocks.auto` 在 tencent → sina → eastmoney 间自动兜底
- **StockSdkModule** (`src/stock-sdk/`) — 股票行情模块，基于 `stock-sdk` 库，提供行情 / K线（含技术指标） / 信号 / 大单 / 代码列表，支持 A 股/港股/美股/基金；另含四个每日定时任务：标的代码同步（`symbols/`）、个股资金流排名（`fund-flows/`）、大盘资金流（`market-flows/`）、板块资金流（`sectors/`）
- **TdxModule** (`src/tdx/`) — 通达信行情模块，基于 `node-tdx-market`（通达信 TCP 协议），提供 K线 / 五档盘口（批量） / 当日与历史分时 / 当日与历史分笔成交 / 证券数量 / 全量证券列表
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

6. **K线接口合并**: `GET /stock-sdk/kline/:market/:code` 单入口按参数分派 —— 分钟周期（`1/5/15/30/60`）优先走分钟K线接口，其次是带 `indicators` 的指标K线，否则走历史K线。分钟周期下 `indicators` 不再生效。

7. **分钟K线交易日自动定位**: `period=1` 且未指定日期范围时，依据 `sdk.calendar.marketStatus()` 判断当前所处交易时段：盘前/休市回退到前一交易日，交易中/午休/盘后取当天。避免盘前或非交易日请求到空数据。

8. **行情接口不限流**: StockApi / StockSdk 控制器整体 `@SkipThrottle()`，仅在 `auth` 模块按接口配置限流。理由是行情数据为公开信息，且上游 SDK 自带请求频率控制与数据源兜底。

9. **异常统一收口**: 全局 `AllExceptionsFilter` 将 HttpException、TypeORM `QueryFailedError`（按 PostgreSQL 错误码映射）及未知异常统一为 `{ code, data, message }`，并记录含客户端 IP 的结构化日志。

10. **信号默认回溯窗口**: `GET /stock-sdk/kline/:market/:code/signals` 未传 `startDate` 时按 `period` 套用默认窗口（日线 1 月 / 周线 6 月 / 月线 36 月），避免默认扫描全历史。基准时间取 `endDate`（若提供）或当前时间，保证窗口不会落在查询区间之外。

11. **每日标的代码同步**: `StockSymbolScheduler` 每天 09:00（开盘前）触发（`@Cron` 显式指定 `timeZone: 'Asia/Shanghai'`——容器多为 UTC，不指定会相差 8 小时），把 A股/美股/港股/基金代码同步到 `stock_symbols` 表。
    - **以 `code` 为唯一键的 upsert**：不存在则新增，已存在且 `market` 有变化时更新，无变化则不写入——`skipUpdateIfNoValuesChanged` 让 PostgreSQL 生成 `WHERE ... IS DISTINCT FROM ...`，避免无意义的写放大；不删除退市记录
    - 用 `ON CONFLICT` 而非「先查后插」：一次往返、无竞态，也避免为数千条代码逐条查询。`code` 统一为「市场前缀 + 代码」（`sh600000` / `usAAPL` / `hk00700`）后基本全局唯一，但**并非天然如此**——美股剥掉东财板块前缀（`105`/`106`/`107`）是**有损**的：同一标的可能同时挂在两个板块下（实测 `105.PC` 与 `106.PC` 同为 `PC.OQ`），规范化后撞成同一个 `code`
    - **写库前必须去重**（`normalize`）：`upsert` 把整批拼成**单条** INSERT，同批内出现重复冲突键会让 PostgreSQL 报 `ON CONFLICT DO UPDATE command cannot affect row a second time`，整批失败并连带中断该市场当次同步。去重保留先出现的一条——被丢弃的是同一标的的重复挂载，不会丢标的；A股/港股/基金经同一逻辑校验无此问题
    - **各市场相互独立**：单个失败只记录并继续，下次任务自然补上
    - **异常自洽**：任务内全量 try/catch，绝不向调度器抛出——全局异常过滤器依赖 HTTP 上下文（`host.switchToHttp()`），捕获 cron 异常会在过滤器内二次报错

12. **每日板块资金流采集**: `SectorFlowScheduler` 每天 17:00（时区同上，A 股收盘后）通过 `fundFlow.sectorRank` 采集板块资金流排名，写入 `sector_fund_flows`，保留最近一个月。
    - **数据归属日**：下午 5 点当天已收盘、数据完整，故交易日归属当天；非交易日（周末/节假日）归属之前最近的交易日
    - **唯一键含板块类型与排名周期** `(trade_date, sector_type, indicator, code)`：同一交易日可按行业/概念/地域与不同周期分别采集，互不覆盖
    - **空数据保护**：上游返回空数组时跳过落库，避免把已有记录清成空
    - 落库为覆盖式（先删同批再写），保留原始净额与净占比字段，便于事后回溯

13. **每日个股资金流排名采集**: `StockFundFlowScheduler` 每天 16:00（时区同上，A 股收盘后）通过 `fundFlow.rank` 采集全市场个股资金流排名，写入 `stock_fund_flows`，保留最近一个月。
    - **落库用分批 insert**（每批 1000 条）而非逐条 save：单日数据为全市场数千条，逐条 save 会生成数千次 SQL
    - **查询强制分页**（默认 50 条/页，上限 200）：整批返回会造成数百 KB 的响应体，与板块接口（约 86 条，可整批返回）的处理方式不同
    - 表内保留各单类（超大/大/中/小）的净额与净占比，便于分析资金结构
    - 数据归属日、覆盖式落库、空数据保护与清理策略同板块任务

14. **每日大盘资金流采集**: `MarketFundFlowScheduler` 每天 16:30（时区同上，A 股收盘后）通过 `fundFlow.market` 采集沪深大盘资金流，写入 `market_fund_flows`，保留最近一个月。
    - 上游返回的是**按日历史序列**（每条自带 `date`），故日期取自数据本身，无需按运行时推导——与其它三个任务不同
    - **只写入保留期内的数据**：更早的写入后也会被清理，没必要先写一遍
    - **增量插入**（`ON CONFLICT DO NOTHING`）而非覆盖式重写：已收盘交易日的历史值不会变动，每天实际新增 1 条
    - 唯一键只有 `trade_date`——大盘是沪深两市合计口径，每个交易日仅一条记录

> 四个定时任务的时间：标的代码 09:00（开盘前）、个股资金流 16:00、大盘资金流 16:30、板块资金流 17:00——均在开盘前或 A 股收盘后，互不重叠。

15. **通达信行情模块**: `TdxModule` (`src/tdx/`) 基于 `node-tdx-market`（通达信 TCP 协议）提供 8 个查询接口。
    - **长连接管理**：与服务端维持一条 TCP 长连接（区别于其它模块的 HTTP 库）。启动时主动建连但**不阻塞应用启动**——行情服务不可达只记 warn；请求前检查连接状态（懒连接兜底），断线重连由库的 `autoReconnect` 负责；模块销毁时断开
    - **价格单位为厘（元 × 1000）**：上游解析结果**原样透传**，不在网关层做字段级换算——价格字段散布在 K线、盘口、分时、分笔、证券列表等各类响应中，逐个转换容易遗漏，改由文档显著说明
    - **连接不可用时返回 503**（而非 500）：区分「依赖服务不可用」与「服务内部错误」
    - **不使用库的 `KlineCategory`**：它是 `declare const enum`，与 tsconfig 的 `isolatedModules: true` 冲突（值位置不可用），改用 `tdx.constants.ts` 的数值映射表，对调用方暴露 `1m`/`day`/`week` 等语义化取值

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
