# 证券数据（WeStock）

[← 返回目录](../../API.md)

> 所有接口需要 JWT 认证，请在请求头中携带 `Authorization: Bearer <access_token>`
>
> 基于 [`westock-data-clawhub`](https://www.npmjs.com/package/westock-data-clawhub)（其单文件 bundle 置于仓库 `src/scripts/westock-data-clawhub.mjs`，经子进程调用，非 HTTP 直连）

## 重要说明

### 每次请求会启动一个子进程

服务通过子进程调用 CLI，**每次请求约 400ms**（实测），比库调用的接口慢。上游超时上限 15 秒，超出返回 `504`。

### 结果是「表格」结构，列由命令决定

CLI 输出一张扁平表格，**不同命令的列不同**，故响应不固定字段，而是给出 `columns`（列名，有序）与 `rows`（行对象，键为列名）：

| 接口              | 列                                                  |
| ----------------- | --------------------------------------------------- |
| `/search`         | `code`、`name`、`type`                              |
| `/minute`（当日） | `code`、`time`、`price`、`volume`、`amount`         |
| `/minute`（五日） | `code`、`date`、`time`、`price`、`volume`、`amount` |

**所有值均为字符串**，不做数值推断。

### 无结果返回 200 而非 404

查询无匹配时 `rows` 为空数组、`total` 为 0，HTTP 状态码仍是 `200`——这是正常的查询结果，不是错误。

### 与 TDX 接口的区别

本模块**不豁免全局限流**（TDX 因复用长连接而豁免）。每次调用都会 fork 子进程并请求第三方上游。另外价格单位是**元**，而 TDX 是「厘」。

## 证券搜索

按关键词搜索证券代码。

**请求**

```
GET /api/westock/search?keyword=腾讯
Authorization: Bearer <access_token>
```

**查询参数**

| 参数    | 类型   | 必填 | 说明                                                      |
| ------- | ------ | ---- | --------------------------------------------------------- |
| keyword | string | 是   | 搜索关键词，最长 50 字符；不能以 `-` 开头，不能含控制字符 |
| scope   | string | 否   | `stock`（股票）或 `fund`（基金）；不传则两者都返回        |

> ⚠️ CLI 另支持 `--sector`，但实测对所有关键词均无任何输出，功能实际不可用，故本接口不提供。

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "keyword": "腾讯",
    "scope": null,
    "columns": ["code", "name", "type"],
    "rows": [
      { "code": "hk00700", "name": "腾讯控股", "type": "GP" },
      { "code": "hk80700", "name": "腾讯控股-R", "type": "GP" },
      { "code": "usTCEHY.PS", "name": "腾讯控股(ADR)", "type": "GP" }
    ],
    "total": 3
  }
}
```

> `type` 的取值由上游定义，常见：`GP-A`（A股）、`GP`（港股/美股）、`ETF`、`ZS`（指数）、`KJ`（开放式基金）等。
> **不传 `scope` 时结果可能混入指数等非股票标的**，需要精确过滤时请显式指定 `scope=stock`。

**字段说明**

| 字段      | 说明                              |
| --------- | --------------------------------- |
| `keyword` | 回显的搜索关键词（已 trim）       |
| `scope`   | 回显的搜索范围（未传则为 `null`） |
| `columns` | 列名，顺序与 CLI 表格一致         |
| `rows`    | 行数据，键为列名；值一律为字符串  |
| `total`   | 返回行数                          |

**示例**

```bash
curl "http://localhost:3001/api/westock/search?keyword=银行&scope=fund" \
  -H "Authorization: Bearer <access_token>"
```

**示例：无结果**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": { "keyword": "zzz", "scope": null, "columns": [], "rows": [], "total": 0 }
}
```

## 分时数据

获取当日或五日的分时数据。

**请求**

```
GET /api/westock/minute?code=sh600519&days=5
Authorization: Bearer <access_token>
```

**查询参数**

| 参数 | 类型   | 必填 | 说明                                                                                 |
| ---- | ------ | ---- | ------------------------------------------------------------------------------------ |
| code | string | 是   | 证券代码，**须带市场前缀**（如 `sh600519` / `hk00700` / `pt01801081`）；最长 20 字符 |
| days | number | 否   | 天数：`1` = 当日（默认），`2`~`5` = 五日                                             |

> `days` 上限为 5——实测传入大于 5 时 CLI 也只返回 5 天。

**响应（当日）**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "code": "sh600519",
    "days": 1,
    "columns": ["code", "time", "price", "volume", "amount"],
    "rows": [
      {
        "code": "sh600519",
        "time": "0930",
        "price": "1257.98",
        "volume": "140",
        "amount": "17611720.00"
      },
      {
        "code": "sh600519",
        "time": "0931",
        "price": "1261.98",
        "volume": "572",
        "amount": "71968937.77"
      }
    ],
    "total": 225
  }
}
```

**响应（五日）**——比当日多一列 `date`：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "code": "sh600519",
    "days": 5,
    "columns": ["code", "date", "time", "price", "volume", "amount"],
    "rows": [
      {
        "code": "sh600519",
        "date": "20260917",
        "time": "0930",
        "price": "1257.98",
        "volume": "140",
        "amount": "17611720.00"
      }
    ],
    "total": 1293
  }
}
```

**字段说明**

| 字段            | 说明                                           |
| --------------- | ---------------------------------------------- |
| `code` / `days` | 回显的查询参数                                 |
| `columns`       | 列名，顺序与 CLI 表格一致                      |
| `rows`          | 行数据；`date` 为 `YYYYMMDD`，`time` 为 `HHmm` |
| `total`         | 返回行数（五日约 1300 行）                     |

> `price` 单位为**元**（与 TDX 接口的「厘」不同）；`volume` / `amount` 是**当日累计值**，非单分钟增量。
>
> 上例中的 `total` 会随交易时段增长（盘中每分钟新增一行），并非固定值；收盘后当日约 240 行。

**错误响应**

- `400` - 请求参数校验失败（关键词/代码为空、过长、以 `-` 开头、`scope` 或 `days` 取值非法）
- `401` - `访问令牌无效或已过期`（由守卫抛出）
- `429` - 触发全局限流（每 60 秒 60 次）
- `503` - `证券数据组件不可用，请稍后重试`（`src/scripts/westock-data-clawhub.mjs` 缺失或无读取权限）；
  或 `证券数据服务调用失败，请稍后重试`；或 `证券数据服务返回异常，请稍后重试`（输出无法解析，如代码不被上游支持）
- `504` - `证券数据查询超时，请稍后重试`（上游超过 15 秒未返回）
