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

## 定时任务

当前**无任何定时任务**，也**未注册 `@nestjs/schedule`**（最后一个使用它的模块已移除）。

> 新增任务时注意：cron 表达式与时区须是**模块常量**而非环境变量——
> `@Cron` 在装饰器求值期（模块 import 时）取参，而 `.env` 要到 `ConfigModule.forRoot()`
> 执行时才写入 `process.env`，用 `process.env.XXX` 会静默拿到 `undefined`。

## 接口调试

- `REST_CLIENT.http` — VS Code REST Client 可直接执行的接口集合，覆盖健康检查与认证接口
- 该文件可直接复用登录接口返回的 `accessToken`（通过 `{{login.response.body.data.accessToken}}` 变量引用）

## 文档结构

文档位于项目根目录与 `docs/` 下：

- `API.md` — API 文档入口，包含基础信息、认证与限流说明、通用响应格式、错误码与数据库错误映射
- `docs/api-health.md` — 健康检查接口
- `docs/api-auth.md` — 认证接口（注册、登录、刷新、登出、用户信息、修改密码、登出所有设备）
- `docs/api-config.md` — 系统配置（认证机制、环境变量、开发环境）

> `docs/api-*.md` 的文档顶部有返回 `API.md` 的导航链接。
> 接口有变动时需同步更新对应文档（见 `CLAUDE.md` 代码规范）。
