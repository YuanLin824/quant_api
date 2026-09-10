# 环境变量

所有变量名集中定义在 `src/config/constants.ts` 的 `ENV_KEYS` 对象中，新增变量需先在此登记。

## NODE_ENV

决定应用运行模式，取值只有两个（**注意不是常见的 `production`**）：

| 值     | 行为                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| `dev`  | 加载 `.env.development*`、TypeORM `synchronize` 开启、CORS 放开、日志输出到控制台 |
| `prod` | 加载 `.env.production*`、`synchronize` 关闭、CORS 白名单、日志写入文件            |

> 判断逻辑为 `process.env.NODE_ENV === 'prod'`（见 `IS_PROD`），
> 若误设为 `production` 会被当作开发模式处理 —— 生产环境下将启用表结构自动同步，切勿写错。
>
> `npm run start:dev` 与 `npm run start:prod` 已自动注入对应值。

## .env 文件加载顺序

按优先级从高到低，先命中者生效：

1. `.env.development.local` / `.env.production.local`
2. `.env.development` / `.env.production`
3. `.env.local`
4. `.env`

## 必需的环境变量

```bash
PG_URL="postgres://user:pass@host:port/db"
REDIS_URL="redis://user:pass@host:port/db"
JWT_ACCESS_SECRET_KEY="至少32字符的密钥"
JWT_REFRESH_SECRET_KEY="至少32字符的密钥（不能与access相同）"
```

## 可选的环境变量

```bash
PORT="3001"                    # 默认 3000（.env.example 中为 3001）
API_PREFIX="/api"              # 默认 /api
JWT_ACCESS_EXPIRES_IN="15m"   # 默认 15 分钟，支持 s/m/h/d 单位
JWT_REFRESH_EXPIRES_IN="7d"   # 默认 7 天，支持 s/m/h/d 单位
AUTH_MAX_DEVICES="5"          # 默认 5 个设备
REDIS_KEY_PREFIX="quant-"     # Redis key 前缀
ALLOWED_ORIGINS="https://example.com"  # 生产环境必须配置，否则启动失败；多个用逗号分隔
CRYPTO_PROXY="http://127.0.0.1:7890"   # 预留：加密数据采集代理，当前代码未使用
```

> `PG_URL` / `REDIS_URL` 是应用实际读取的统一连接串，在 `.env.example` 中分别由 `PG_*`、`REDIS_*` 分项拼接生成；
> 这些分项变量仅供 `docker-compose` 使用，应用代码只读取连接串。
