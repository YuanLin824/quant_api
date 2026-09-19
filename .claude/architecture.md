# 架构设计

## 模块结构

- **AppModule** (`src/app.module.ts`) — 根模块，全局注册 Redis 服务、异常过滤器、限流守卫、请求日志中间件
- **AppSetup** (`src/app.setup.ts`) — 应用公共装配（Helmet / CORS / 全局前缀 / 校验管道），由 `main.ts` 与 e2e 测试共用，避免测试环境与线上配置漂移
- **AppController / AppService** (`src/app.controller.ts` / `src/app.service.ts`) — 健康检查接口，返回服务状态、版本号、运行时长与内存占用
- **AuthModule** (`src/auth/`) — 认证模块，JWT 双密钥方案（access + refresh token）
- **TdxModule** (`src/tdx/`) — 行情数据能力（基于 `node-tdx-market`，通达信 TCP 协议）：K线 / 五档盘口（批量） / 当日与历史分时 / 当日与历史分笔成交 / 证券数量 / 全量证券列表。**内部服务，不对外暴露 HTTP 接口**
- **WestockCliModule** (`src/westock-cli/`) — K 线能力（子进程调用腾讯 Go CLI `westock.exe`）。**内部服务，不对外暴露 HTTP 接口**
- **WestockDataModule** (`src/westock-data/`) — 搜索与分时能力（子进程调用 `westock-data-clawhub` bundle）。**内部服务，不对外暴露 HTTP 接口**
- **StockSdkModule** (`src/stock-sdk/`) — 证券代码能力（`stock-sdk` npm 包，HTTP 公开数据源），纯透传、不落库。**内部服务，不对外暴露 HTTP 接口**
- **SymbolsModule** (`src/symbols/`) — 标的代码模块，每日定时同步全量股票代码（A股/港股/美股/基金）入库，并提供手动触发与查询接口
- **KlinesModule** (`src/klines/`) — K 线模块。落库路径每日盘后经 TdxModule 同步 A 股全市场**日线**入库（首次回补近两年），并提供手动触发与概览统计；**实时查询**路径经 WestockCliModule 拉取、不读库、周期任选
- **Common** (`src/common/`) — 跨模块共享件：`BaseEntity` 实体基类、全局异常过滤器、请求日志中间件、校验装饰器
  - `common/cli/` — 两个 westock CLI 服务（`westock-cli` / `westock-data`）的共用层：`CliRunnerBase`（子进程调用与错误分类）、`table-parser`（输出解析）、通用常量与类型
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
   **例外**：`stock_symbols` 与 `daily_klines` 有意不继承——两者都是「业务主键天然唯一」的纯数据表（`code` / `code + trade_date`），不需要代理键；且带 `delete_at` 会让软删的行一直占住唯一索引位，后续 upsert 命中死行却查不出来。

6. **限流策略**: 全局限流由 `APP_GUARD` 的 `ThrottlerGuard` 提供（60 秒 60 次），`auth` 模块另按接口收紧（注册/登录/改密等）。对外暴露的 `symbols`、`klines` 沿用全局策略——它们会拉全量数据或批量写库，不是轻量读接口。

7. **异常统一收口**: 全局 `AllExceptionsFilter` 将 HttpException、TypeORM `QueryFailedError`（按 PostgreSQL 错误码映射）及未知异常统一为 `{ code, data, message }`，并记录含客户端 IP 的结构化日志。
   - **失败时 `data` 恒为 `null`**：具体原因一律由 `message` 承载，不再把 Nest 的原始响应对象塞进 `data`（那会让 `{ message, error, statusCode }` 与顶层字段重复）
   - **校验错误并入 `message`**：ValidationPipe 抛出的 `BadRequestException`，其 `exception.message` 只有固定的 `Bad Request Exception`，故优先取 `getResponse().message` 数组并以 `; ` 连接，保证调用方能定位到具体参数

8. **通达信行情模块**: `TdxModule` (`src/tdx/`) 基于 `node-tdx-market`（通达信 TCP 协议）提供行情数据能力，**作为内部服务供其他模块注入**（不对外暴露 HTTP 接口，目前的消费者是 `KlinesModule`）。
   - **长连接管理**：与服务端维持一条 TCP 长连接（区别于常见的 HTTP 行情接口）。启动时主动建连但**不阻塞应用启动**——行情服务不可达只记 warn；请求前检查连接状态（懒连接兜底），断线重连由库的 `autoReconnect` 负责；模块销毁时断开
   - **价格单位为厘（元 × 1000）**：上游解析结果**原样返回**，不在服务层做字段级换算——需要「元」的调用方（如 `KlinesService`）自行 ÷1000
   - **连接不可用时返回 503**（而非 500）：区分「依赖服务不可用」与「服务内部错误」
   - **不使用库的 `KlineCategory`**：它是 `declare const enum`，与 tsconfig 的 `isolatedModules: true` 冲突（值位置不可用），改用 `tdx.constants.ts` 的数值映射表，对调用方暴露 `1m`/`day`/`week` 等语义化取值

9. **CLI 子进程调用**: 本项目用 `execFile` 调用第三方 CLI，是本项目**唯一使用子进程**的地方。公共部分（execFile 调用、超时与错误分类、在途进程的生命周期、输出解析）抽在 `CliRunnerBase`（`src/common/cli/cli-runner.base.ts`），由两个服务继承：
   - `WestockCliService`（`src/westock-cli/`）→ K 线，直接执行 Go CLI 二进制
   - `WestockDataService`（`src/westock-data/`）→ 搜索、分时，经 `node <bundle入口>` 执行
   - **用到两个 CLI，能力互补**：`westock-data-clawhub`（`src/scripts/` 下的单文件 bundle，不入库）负责 search 与 minute；腾讯 Go CLI（`src/scripts/westock.exe`，由 setup 脚本下载）负责 kline。之所以不能统一——clawhub 的 kline **不支持分钟周期**（传 `m1`/`5m` 等会**静默回退到日线**，调用方会拿到错误粒度的数据），而 Go CLI 没有 minute 命令
   - **两者启动方式不同**：bundle 经 `process.execPath` 执行入口（Windows 下 `.bin` 是 shell 脚本，execFile 无法直接运行），Go CLI 直接执行二进制
   - **由 nest-cli 的 assets 同步到 `dist/`**：`dist/` 是 `src/` 的镜像，但 tsc 只编译 `.ts`，故 `nest-cli.json` 需显式配置把 `src/scripts/**` 拷进 `dist/scripts/`，否则 prod（`node dist/main`）找不到入口。用 `**` 而非只拷 `.mjs`，是为了让 dist 自包含——二进制缺失时可在目标机器直接跑 `dist/scripts/setup.*` 重新获取。有此配置后，`src/westock-cli/`（及 `src/westock-data/`）与 `dist/` 下的对应目录都可用 `../scripts/` 定位，dev 与 prod 的路径解析一致
   - **bundle 扩展名必须是 `.mjs`**：源文件是 ESM，而本项目 `package.json` 无 `type: module`，用 `.js` 会让 Node 先按 CommonJS 解析失败再回退重解析——既慢又喷 warning
   - **参数以数组传递、不经 shell**：天然免疫命令注入；多代码以逗号分隔**整体作为单个 argv**
   - **K 线日期参数原样转发、不代填**：`start`/`end` 只在调用方显式传入时才追加，缺的一端交给上游取默认值（`1990-12-01` / 当日）。跨度校验因此也只在两端都传入时才有意义。
     注意「不代填」是 `WestockCliService` 这一层的原则；`KlinesService.getRealtime` 会在**调用它之前**把缺省的 `start` 补成 `1990-07-31`（见第 11 条），补完的值对跨度校验是可⻅的
   - **退出码不可靠**：两个 CLI 对「无结果」「参数非法」「上游报错」都返回退出码 0，仅凭退出码无法区分。故一律解析输出内容——已知的无结果文案（`数据为空`/`无分时数据`）视为空结果（返回空数组，**非错误**），解析不出表格则报 503
   - **输出无 JSON 开关**：成功时是一张扁平 Markdown 表格，**列随命令变化**（search 三列、minute 五/六列、kline 九列且多代码时多一列 `code`；多代码另有 `[Batch]` 摘要行，不以 `|` 开头故被自然跳过）。解析器 `src/common/cli/table-parser.ts` 因此独立成纯函数便于单测，列名一律从表头读取（不硬编码），按 `columns` + 行对象表达
   - **超时用 504**（而非 408）：客户端发得快、是上游慢，504 语义更准

10. **标的代码定时同步**: `SymbolsService` 每夜全量拉取股票代码并 upsert 入库（`src/symbols/`）。
    - **数据源是 `stock-sdk`**（见第 12 条），不是 TDX。上游返回的是**纯代码数组**（不含名称/每手股数/小数位），故 `stock_symbols` 表只有 `market` 与 `code` 两列
    - **A 股是单一市场 `cn`**：交易所前缀编码在代码里（`sh600036`/`sz000001`/`bj430047`），不像 TDX 那样按交易所分开查询
    - **cron 必须显式指定 timeZone**：容器多为 UTC，不指定会与北京时间差 8 小时。且 `@Cron` 在装饰器求值期（模块 import 时）取参，而 `.env` 要到 `ConfigModule.forRoot()` 才写入 `process.env`，故表达式**作为模块常量而非环境变量**
    - **调度器绝不外抛异常**：全局 `AllExceptionsFilter` 依赖 HTTP 上下文（`host.switchToHttp()` / `httpAdapter.reply()`），cron 抛出的异常进入该过滤器会在 `getResponse()` 处二次报错，把真实错误盖掉
    - **去重不可省**：upsert 把整批拼成**单条** INSERT，同批内出现重复冲突键时 PostgreSQL 报 `cannot affect row a second time` 并整批失败；分批 1000 行则是因为 PG 单语句参数上限为 65535
    - **只 upsert、从不删除**：上游返回不完整也不会损坏已有数据，故单市场失败无需重试补偿；`skipUpdateIfNoValuesChanged` 让属性无变化的行完全不写，首日之后近乎零写入
    - **`@nestjs/schedule` 12.x 是纯 ESM**：Jest 的 CJS runtime 无法加载它，spec 中需 `jest.mock` 掉装饰器；Node 26 运行时支持 `require(esm)`，应用侧无影响

11. **K 线模块**: `KlinesService` 提供两条**互不依赖**的取数路径（`src/klines/`），且**用的是两个不同的数据源**——落库（`sync`／`getStats`）走 `TdxService`，实时（`getRealtime`，供 `GET /api/klines`）走 `WestockCliService`。
    - **查询接口走实时而非查库**：库里的数据要等每日 16:00 的同步任务跑完（约 90 分钟）才更新，实时拉取没有这个滞后
    - **两条路径的量纲来源不同**：TDX 原样返回「厘」（元 × 1000），落库时 ÷1000；CLI 直接给「元」。接口层统一为元。⚠️ 但**成交额精度不同**（CLI 侧截断，实测 1972730000 vs TDX 的 1972732160），**不可逐值比对**
    - **响应行的时间字段是 `time` 而非 `tradeDate`**：分钟级必须带上时分，否则同一天的 241 根 1 分钟线会得到同一个标识。入库行仍用 `tradeDate`（列名对齐实体）
    - **`period` 取值直接透传 CLI 的 `--period`**（`m1`~`m120`/`day`/`week`/`month`/`season`/`year`，**分钟级前缀是 `m` 不是后缀**），不做别名映射——少一层翻译就少一处漂移。落库路径固定日线（表就是 `daily_klines`）
    - **`start` 缺省补 `1990-07-31`、`end` 缺省不补**：CLI **只在两端都给**时才校验跨度，故单给 `start` 安全；但「分钟周期 + 只给 `end`」会因补出来的 `start` 触发跨度校验 → 400（已知取舍，错误信息明确）
    - **`limit` 取的是 `[start, end]` 区间的「尾部」N 根**，不是从 `start` 往后数——要取早期数据必须把 `end` 也限定住
    - **`fq` 不传时不补默认值**：实测上游默认是**前复权**（与 `--fq qfq` 输出逐字节相同），但不落常量——保持与上游默认解耦，上游改了口径这边不会被静默带走。⚠️ **落库路径（TDX）存的是不复权价**，两条路径的数值不可比；且前复权价会随新的除权**回溯变动**，要稳定可比须显式传 `nofq`
    - **`bfq` 对 A 股会触发上游报错**（`service error` → 503），港股正常。取值仍予暴露以与 CLI 对齐
    - **CLI 的列名映射收在 `KLINE_COLUMN_MAP`**：收盘价在 CLI 里叫 **`last`** 而非 `close`，按 `close` 取值只会静默拿到 `undefined`；故取值前先 `assertColumns()`，缺列直接抛 503 而不是返回空值
    - **`limit` 是上限而非保证**：CLI 会**静默少返回**（实测 `--limit 5000` 只回 2494 行，无任何提示），且各周期有各自的数据深度上限（分钟级仅最近一个交易日）。⚠️ `year` 传 `limit=1000` 会触发上游报错（`[code=1620053001] service error`）→ 503
    - **入库路径：上游量纲必须显式换算**：`node-tdx-market` 的价格与成交额是「厘」、成交量是「手」，而 `TdxService` 是**原样返回**的。落库时换算为**元**，成交量保持「手」
    - **入库路径：`count` 上限 800 是库内硬编码的静默截断**（`Math.min(request.count, 800)`）。**TDX 无法按日期限定区间**（`start` 是「从最新往前倒推的偏移量」而非日期），只能取完再按两年窗口裁剪
    - **入库路径：`time` 必须按本地时区取日期**：库内 `decodeDayTime` 按进程本地时区构造 `new Date(y, m-1, d, 15, 0)`，走 `toISOString()` 会把交易日整体偏移到前一天
    - **不继承 `BaseEntity`**：`(code, trade_date)` 天然唯一，直接作复合主键——无需 uuid 代理键；软删除对时序数据无意义（退市股票的历史行情要保留），且 `delete_at` 会占住唯一索引位；数百万行下额外的 `id`/`status`/时间戳（约 42 字节/行）也是开销
    - **入库路径：串行且带间隔**：上游库用 Promise 链强制同一连接只有一个在途请求（单次实测约 20ms），相邻请求间**再加 1 秒间隔**——上游是公开的行情服务器，不宜高频拉取。代价是全市场约 5400 只要跑 **约 90 分钟**（16:00 启动、约 17:30 结束）
    - **只保留近两年**：拉取时的 `since` 过滤只管住**本次拉回来的**超期数据，库里随日历滑出窗口的旧行靠每次同步后的**硬删除**（`DELETE ... WHERE trade_date < 两年前`）清理。本表无软删除，删除即物理删除，条数见 `purged`

12. **stock-sdk 代码查询**: `StockSdkService` 封装 `stock-sdk`（npm 包，HTTP 公开数据源）的代码列表能力（`src/stock-sdk/`）。
    - **服务与模块分工**：`StockSdkService` 只负责**实时获取**（纯透传、不落库、不暴露接口）；`SymbolsModule` 在此之上做定时**落库**（A股/港股/美股/基金四个市场，持久化、可离线查询、可被其他模块直接查表复用）
    - **透传接口不落库**：无表结构、无定时任务，数据实时获取
    - 该包是**双格式**（CJS + ESM），不像 `@nestjs/schedule` 那样只有纯 ESM，故 spec 里无需绕开加载问题

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
- 全局限流：60 秒内最多 60 次请求（无接口级豁免；仅 `auth` 的登出用 `@SkipThrottle`）
- 登录限流：10 分钟内最多 10 次尝试
- 登录失败锁定：连续失败 5 次后锁定 15 分钟（计数 key `auth:fail:{username}`）
- 密码 bcrypt 加密（12 轮）
- 防时序攻击：密码比对使用恒定时间算法，用户不存在时执行等价比对以避免时序差异
- 防用户名枚举：用户不存在与密码错误返回相同消息
- 请求体大小限制：10KB
- 生产环境强制配置 `ALLOWED_ORIGINS`，否则启动失败
