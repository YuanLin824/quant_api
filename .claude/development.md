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

## 接口调试

- `REST_CLIENT.http` — VS Code REST Client 可直接执行的接口集合，覆盖健康检查、认证、通达信与证券数据（WeStock）接口
- 该文件可直接复用登录接口返回的 `accessToken`（通过 `{{login.response.body.data.accessToken}}` 变量引用）

## 文档结构

文档位于项目根目录与 `docs/` 下：

- `API.md` — API 文档入口，包含基础信息、认证与限流说明、通用响应格式、错误码与数据库错误映射
- `WESTOCK_CLI.md` — westock（腾讯 Go CLI）命令行接口手册（按分类列出各命令的用法、参数与示例）
- `WESTOCK_DATA_CLAWHUB.md` — westock-data-clawhub CLI 用法（npx 包，命令语法与示例）
- `docs/api-health.md` — 健康检查接口
- `docs/api-auth.md` — 认证接口（注册、登录、刷新、登出、用户信息、修改密码、登出所有设备）
- `docs/api-tdx.md` — 通达信接口（K线、五档盘口、当日与历史分时、当日与历史分笔成交、证券数量与列表）
- `docs/api-config.md` — 系统配置（认证机制、环境变量、开发环境）
- `docs/api-westock.md` — 证券数据（搜索、分时、K线；表格列随命令变化、503/504 错误说明）

> `docs/api-*.md` 的文档顶部有返回 `API.md` 的导航链接。
> 接口有变动时需同步更新对应文档（见 `CLAUDE.md` 代码规范）。
