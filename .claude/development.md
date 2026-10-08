# 开发流程

## 启动服务

1. 准备 PostgreSQL 与 Redis 实例（自备，项目内不附带本地容器编排）
2. 配置环境变量：复制 `.env.example` 为 `.env` 或 `.env.development.local`，
   按实际地址填写 `PG_URL` / `REDIS_URL`
3. 启动开发服务器：`npm run start:dev`（自动注入 `NODE_ENV=dev`）
4. 访问 API：`http://localhost:3001/api`

> 不要自动启动其他服务，需先获得授权确认。

## 默认管理员账户

应用启动时由 `AuthInitService` 自动创建（仅当用户不存在时）：

- **用户名**: `QuantAdmin`
- **密码**: `Quant.Admin`

> ⚠️ 生产环境请及时修改默认密码。
>
> 该内置账户的 access token 有效期为 **24 小时**（其他用户走 `JWT_ACCESS_EXPIRES_IN`，默认 15 分钟）。

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

## 数据库

开发环境 `synchronize = true`（见 `src/database/postgres.module.ts`），启动时按实体自动对账表结构，
**新增/修改实体后重启即可生效，无需手工迁移**。

> ⚠️ 该对账**只增不减**：它会建表、加列、改列、建索引，但**不会 drop 表**——
> 实体被删除后，对应的表会原样留在库中（含数据），需要手工 `DROP TABLE` 清理。
> 生产环境 `synchronize = false`，既不建表也不改表，需手工执行建表 DDL。

### 生产环境的建表 DDL

可从开发库直接导出（`synchronize` 已按实体建好）：

```bash
pg_dump --schema-only -t stock_symbols "$PG_URL" > stock_symbols.sql
```

> ⚠️ **`thscode` 必须是主键**：标的同步用 `upsert(..., ['thscode'])` 生成 `ON CONFLICT (thscode)`，
> 该列须有主键（或唯一约束/索引），否则会直接报错，而不会降级为普通插入。
> 列名一律 snake_case，与实体上的显式 `name:` 一一对应——`synchronize` 的对账按列名比对。

## 定时任务

`ScheduleModule.forRoot()` 已在 `AppModule` 注册，当前有 1 个任务：

| 任务           | 位置                                  | 时间                                | 说明                                      |
| -------------- | ------------------------------------- | ----------------------------------- | ----------------------------------------- |
| 标的代码表同步 | `StockSymbolsSchedule.handleSync`     | 每周一至周五 17:30（Asia/Shanghai） | 从同花顺拉取个股与指数/板块并 upsert 落库 |
| 交易日历同步   | `StockTradingDaysSchedule.handleSync` | 每天凌晨 3:00（Asia/Shanghai）      | 从同花顺拉取近一年交易日并 upsert 落库    |

> **约定**：定时任务写在模块的 `模块.schedule.ts` 中（只负责触发时机与异常收口），
> 业务实现留在 `模块.service.ts`，两者分离以便单测与手动调用。
>
> 新增任务时注意：cron 表达式与时区须是**模块常量**而非环境变量——
> `@Cron` 在装饰器求值期（模块 import 时）取参，而 `.env` 要到 `ConfigModule.forRoot()`
> 执行时才写入 `process.env`，用 `process.env.XXX` 会静默拿到 `undefined`
> （范例见 `src/stock-symbols/stock-symbols.constants.ts`）。

> ⚠️ **`@nestjs/schedule` 的版本须锁在 6.x**：12.x 起该包已 ESM-only（`type: module`），
> 与本项目的 CJS 体系冲突——jest 会直接报 `Must use import to load ES Module`。
> 6.x 是 CJS，且 peerDependencies 兼容 Nest 11。升级 Nest 12 时需一并评估模块体系迁移。

> ⚠️ **e2e 测试的副作用**：`test/app.e2e-spec.ts` 跑的是完整 `AppModule` 与真实数据库。
> 若库里 `stock_symbols` 为空且 `.env` 配了 `THS_API_KEY`，启动补齐会**真的打同花顺**并写入数据。
> 需要隔离时，先给测试库预置任意一行标的即可跳过补齐（判据是 `repo.count() > 0`）。

## 测试

分两套，配置各自独立：

- **单元测试** — 与源码同目录（`src/模块/模块.service.spec.ts`），`npm test`
  （配置见 `package.json` 的 `jest` 字段，rootDir 为 `src`，testRegex 为 `.*\.spec\.ts$`）
- **端到端测试** — `test/*.e2e-spec.ts`，`npm run test:e2e`（配置见 `test/jest-e2e.json`）

单元测试的写法约定（沿用 `auth.service.spec.ts` / `api-ths.service.spec.ts`）：

- **不开 `Test.createTestingModule`** —— 直接 `new Service(mock依赖 as unknown as 真类型)`，省去 DI 容器开销
- 依赖用 `jest.fn()` 手写 mock；在 `beforeEach` 中重置 mock 并重建被测服务
- 用例描述用中文；断言优先 `rejects.toBeInstanceOf(...)` 配 `rejects.toThrow('中文消息')`
- 复杂的上游响应在文件顶部用工厂函数构造（如 `okResponse()` / `makeItems()`），避免各用例重复拼装

> ⚠️ **外部依赖必须 mock，且默认应拒绝**：`jest.spyOn(globalThis, 'fetch')` 若不提供 mock 实现，
> 调用时会**真的发出网络请求**（本仓库曾因此在单元测试里误打到上游 API）。
> 推荐在 `beforeEach` 里统一 `mockRejectedValue(new Error('单元测试不应发起真实网络请求'))`，
> 各用例再按需 `mockResolvedValue(...)` 覆盖——漏 mock 只会让测试失败，而不会静默发出真实请求。

## 接口调试

- `REST_CLIENT.http` — VS Code REST Client 可直接执行的接口集合，覆盖健康检查、认证与标的代码表接口
- 该文件可直接复用登录接口返回的 `accessToken`（通过 `{{login.response.body.data.accessToken}}` 变量引用）

## 文档结构

文档位于项目根目录与 `docs/` 下：

- `API.md` — API 文档入口，包含基础信息、认证与限流说明、通用响应格式、错误码与数据库错误映射
- `docs/api-health.md` — 健康检查接口
- `docs/api-auth.md` — 认证接口（注册、登录、刷新、登出、用户信息、修改密码、登出所有设备）
- `docs/api-config.md` — 系统配置（认证机制、环境变量、开发环境）
- `docs/api-symbols.md` — 标的代码表（分页查询、同步状态概要、手动触发同步）
- `docs/api-stock-trading-days.md` — 交易日历（手动触发同步）

> `docs/api-*.md` 的文档顶部有返回 `API.md` 的导航链接。
> 接口有变动时需同步更新对应文档（见 `CLAUDE.md` 代码规范）。
