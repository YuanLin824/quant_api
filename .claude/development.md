# 开发流程

## 启动服务

1. 启动数据库：`docker compose up -d`
2. 配置环境变量：复制 `.env.example` 为 `.env` 或 `.env.development.local`
3. 启动开发服务器：`npm run start:dev`（自动注入 `NODE_ENV=dev`）
4. 访问 API：`http://localhost:3001/api`

> 除数据库容器外，不要自动启动其他服务，需先获得授权确认。

## 默认管理员账户

应用启动时由 `AuthInitService` 自动创建（仅当用户不存在时）：

- **用户名**: `QuantAdmin`
- **密码**: `Quant.Admin`

> ⚠️ 生产环境请及时修改默认密码。

## 提交规范

由 husky 钩子强制校验：

| 钩子         | 动作                                                       |
| ------------ | ---------------------------------------------------------- |
| `pre-commit` | `lint-staged` → 对暂存的 `js`/`ts`/`md`/`json` 跑 prettier |
| `commit-msg` | `commitlint` 校验提交信息格式                              |

- 交互式提交用 `npm run commit`（czg），自动带 emoji
- 格式为 `type(scope): emoji subject`，`type` 限定在 `commitlint.config.cjs` 的 `TYPE_ENUM` 中
- `scope` 选项由 `src/` 下的目录名自动生成
- **从不自动提交代码**，提交需由开发者本人执行

## 容器服务

`docker-compose.yml` 启动两个容器（`docker compose up -d`）：

| 服务     | 镜像               | 默认端口 |
| -------- | ------------------ | -------- |
| postgres | postgres:18-alpine | 5432     |
| redis    | redis:8-alpine     | 6379     |

> 账号初始化脚本位于 `docker-compose/postgres.sh` 与 `docker-compose/redis.sh`。

## 定时任务

使用 `@nestjs/schedule`，在 `AppModule` 中注册 `ScheduleModule.forRoot()`
（其探索器会全局扫描各模块的 `@Cron`，故子模块不必再 import）。

| 任务名               | 时间                        | 说明                               |
| -------------------- | --------------------------- | ---------------------------------- |
| `stock-symbols-sync` | 每天 08:00（Asia/Shanghai） | 同步 A股/港股/美股全量股票代码入库 |
| `stock-kline-sync`   | 每天 16:00（Asia/Shanghai） | 盘后同步 A 股全市场日 K 线入库     |

> cron 表达式与时区是**模块常量**（`src/stock-symbols/stock-symbols.constants.ts`）而非环境变量——
> `@Cron` 在装饰器求值期（模块 import 时）取参，而 `.env` 要到 `ConfigModule.forRoot()`
> 执行时才写入 `process.env`，用 `process.env.XXX` 会静默拿到 `undefined`。

### 首次部署：创建数据表

生产环境 `synchronize = false`（见 `src/database/postgres.module.ts`），**不会自动建表**，
首次部署需手工执行 `db/` 下的建表脚本各一次：

```bash
psql "$PG_URL" -f db/001-stock-symbols.sql
psql "$PG_URL" -f db/002-daily-klines.sql
```

**开发环境无需执行**：`synchronize` 会自动建表。

> `stock_symbols` 表**没有软删除**（不继承 `BaseEntity`）：要删标的一律硬删
> （`DELETE FROM stock_symbols WHERE code = '...'`）。

### 首次部署：获取 CLI 二进制

`src/scripts/westock.exe`（腾讯 Go CLI）与 `westock-data-clawhub.mjs` **不入库**
（被 .gitignore 排除），克隆后需执行一次：

```bash
npm run setup:westock
```

> 缺失时不会导致应用起不来，但**相关的 K 线/搜索/分时接口会返回 503** 并提示该命令。
>
> `nest-cli.json` 已把 `src/scripts/**` 同步到 `dist/scripts/`，故 prod 下路径解析与 dev 一致，
> 且可在目标机器上直接跑 `dist/scripts/setup.*` 重新获取。

## 接口调试

- `REST_CLIENT.http` — VS Code REST Client 可直接执行的接口集合，覆盖健康检查、认证、标的代码（StockSymbols）与 K 线（StockKline）接口
- 该文件可直接复用登录接口返回的 `accessToken`（通过 `{{login.response.body.data.accessToken}}` 变量引用）

## 文档结构

文档位于项目根目录与 `docs/` 下：

- `API.md` — API 文档入口，包含基础信息、认证与限流说明、通用响应格式、错误码与数据库错误映射
- `WESTOCK_CLI.md` — westock（腾讯 Go CLI）命令行接口手册（按分类列出各命令的用法、参数与示例）
- `WESTOCK_DATA_CLAWHUB.md` — westock-data-clawhub CLI 用法（npx 包，命令语法与示例）
- `docs/api-health.md` — 健康检查接口
- `docs/api-auth.md` — 认证接口（注册、登录、刷新、登出、用户信息、修改密码、登出所有设备）
- `docs/api-config.md` — 系统配置（认证机制、环境变量、开发环境）
- `docs/api-stock-symbols.md` — 标的代码（stock-sdk 数据源，每日定时同步落库、手动触发、数量统计）
- `docs/api-stock-kline.md` — K 线（盘后同步、单位换算、多周期实时查询）
- `docs/api-stock-search.md` — 证券搜索（关键词检索、类型/市场/分页、分段响应）
- `db/001-stock-symbols.sql` — 标的代码表的生产建表 DDL（生产手工执行一次）
- `db/002-daily-klines.sql` — 日 K 线表的生产建表 DDL（生产手工执行一次）

> `docs/api-*.md` 的文档顶部有返回 `API.md` 的导航链接。
> 接口有变动时需同步更新对应文档（见 `CLAUDE.md` 代码规范）。
