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

| 服务     | 镜像                | 默认端口 |
| -------- | ------------------- | -------- |
| postgres | timescaledb-ha:pg18 | 5432     |
| redis    | redis:8-alpine      | 6379     |

> 账号初始化脚本位于 `docker-compose/postgres.sh` 与 `docker-compose/redis.sh`。

## 接口调试

- `REST_CLIENT.http` — VS Code REST Client 可直接执行的接口集合，覆盖健康检查、认证与全部行情接口
- 该文件可直接复用登录接口返回的 `accessToken`（通过 `{{login.response.body.data.accessToken}}` 变量引用）

## 文档结构

API 文档位于项目根目录和 `docs` 目录：

- `API.md` — API 文档入口，包含基础信息、认证与限流说明、通用响应格式、错误码与数据库错误映射
- `docs/health.md` — 健康检查接口
- `docs/auth.md` — 认证接口（注册、登录、刷新、登出、用户信息、修改密码、登出所有设备）
- `docs/stock-api.md` — Stock API 接口（行情、K线、搜索）
- `docs/stock-sdk.md` — Stock SDK 接口（行情、基金、批量行情、K线、K线信号、大单、代码列表、搜索）
- `docs/config.md` — 系统配置（认证机制、环境变量、开发环境）

> `docs/` 下每个文档顶部均有返回 `API.md` 的导航链接。
> 接口有变动时需同步更新对应文档（见 `CLAUDE.md` 代码规范）。
