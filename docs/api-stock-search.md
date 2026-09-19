# 证券搜索（StockSearch）

[← 返回目录](../API.md)

> 所有接口需要 JWT 认证，请在请求头中携带 `Authorization: Bearer <access_token>`

## 说明

**按关键词搜索证券**，数据源是 **westock CLI**（腾讯 Go CLI，经子进程调用）。

- **不落库、不缓存**——每次请求起一个子进程实时取数
- 覆盖股票、ETF、可转债、板块、指数、期货、外汇，以及日股/韩股
- 响应**按类型分段**（见下），因为一次可以搜多个类型

> 与 `stock-symbols` 的分工：那个模块是**全量代码的本地快照**（定时落库、可批量列举），
> 本模块是**按关键词的实时检索**（不落库、带名称）。

## 关键词搜索

**请求**

```
GET /api/stock-search?keyword=腾讯&type=stock&market=hk&limit=10
Authorization: Bearer <access_token>
```

> **用 curl 调用时注意关键词的编码。** 关键词通常是中文，而部分终端（如 Windows 的 Git Bash）
> 不是 UTF-8，直接写 `curl "…?keyword=腾讯"` 会把参数变成乱码——服务端收到的是无效字节，
> **返回 400 且响应体为空**（框架在异常过滤器之前就拒了）。
>
> **无条件可靠的是百分号编码**（`腾讯` = `%E8%85%BE%E8%AE%AF`）：
>
> ```bash
> curl "http://localhost:3001/api/stock-search?keyword=%E8%85%BE%E8%AE%AF" \
>   -H "Authorization: Bearer <access_token>"
> ```
>
> `--data-urlencode "keyword=腾讯"` 写法更易读，但它**依赖终端按 UTF-8 传参**，
> 在非 UTF-8 终端下同样会乱码——不是所有终端都能用。
>
> 浏览器、REST Client 等会自行编码，不受影响。

**查询参数**

| 参数      | 类型   | 必填 | 说明                                                                |
| --------- | ------ | ---- | ------------------------------------------------------------------- |
| `keyword` | string | 是   | 搜索关键词，最长 50 字符                                            |
| `type`    | string | 否   | 证券类型，**多个用逗号分隔**；不传则**仅搜股票**（排除 ETF/可转债） |
| `market`  | string | 否   | 市场；不传则不限                                                    |
| `limit`   | number | 否   | 返回条数，1–100，默认 **10**                                        |
| `offset`  | number | 否   | 偏移量，≥ 0，默认 0                                                 |

**type 取值**

| `type`    | 段标题              |
| --------- | ------------------- |
| `stock`   | `股票`              |
| `etf`     | `ETF/LOF/QDII 基金` |
| `bond`    | `可转债`            |
| `sector`  | `板块`              |
| `index`   | `指数`              |
| `futures` | `期货合约`          |
| `forex`   | `外汇`              |

**market 取值**：`hs`（沪深）、`bj`、`hk`、`us`、`jp`、`kr`

> `jp`/`kr` 走的是**日韩股专用接口**，其段标题与列都与其他类型不同（见下）。
> CLI 的 help 里写「`jp`/`kr` 与 `--type` 互斥」，但**实测组合时并不报错**（`--type` 被忽略），
> 故本接口也不做互斥校验。
>
> `type` 支持 `?type=stock,bond` 与 `?type=stock&type=bond` 两种写法。

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "keyword": "兴业",
    "types": ["stock", "bond"],
    "limit": 3,
    "offset": 0,
    "sections": [
      {
        "title": "股票",
        "total": 3,
        "columns": ["code", "name", "type"],
        "rows": [
          { "code": "sh601166", "name": "兴业银行", "type": "GP-A" },
          { "code": "sz002674", "name": "兴业科技", "type": "GP-A" }
        ]
      },
      {
        "title": "可转债",
        "total": 1,
        "columns": ["code", "name", "type"],
        "rows": [{ "code": "sh113052", "name": "兴业转债", "type": "ZQ-KZZ" }]
      }
    ],
    "total": 3
  }
}
```

**字段说明**

| 字段               | 说明                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `keyword`          | 关键词（已 trim，原样回显）                                                |
| `types` / `market` | 请求里传入的取值；未传时不出现                                             |
| `limit` / `offset` | 实际生效的分页参数                                                         |
| `sections`         | **按类型分段的结果**；`title` 是上游的段标题（带市场后缀，如 `股票·港股`） |
| `total`            | 各段行数之和（顶层）；**不等于**上游命中总数，见下                         |

### 分段与计数

- **`sections[].columns` 逐段独立**：不同段的列可能不同，不要跨段复用。
- **`sections[].total` 是上游命中数，`sections[].rows.length` 是实际返回行数**，
  两者**可以不同**——实测 7 条命中 + `limit=100&offset=5` 时是「共 7 条，显示前 2」。
  另外 `total` 本身也**受 `limit` 约束**（命中数超过 `limit` 时只报 `limit`）。
- **某一类无结果不产生段**：CLI 只打一行提示（如 `未找到匹配的结果（期货合约）。`），
  该提示会被丢弃。故**全部无结果时 `sections` 是空数组**，`total` 为 0。
- 顶层 `total` 是**本次返回的行数之和**，用于快速判断有没有结果；要分页请用 `offset`。

### 日韩股（`market=jp` / `kr`）的形态差异

走的是独立接口，输出与其余类型不同，**这两点已在本模块内被抹平**（调用方无需特殊处理）：

- 段标题**没有「共 N 条」**，只有 `**日股** — 显示 1 条`
- 列是 `code` / `name` / **`market`**（而非 `type`）

```json
{
  "title": "日股",
  "total": 1,
  "columns": ["code", "name", "market"],
  "rows": [{ "code": "t7203", "name": "TOYOTA MOTOR CORPORATION", "market": "jp" }]
}
```

**错误响应**

- `400` - 参数校验失败，含：
  - `keyword` 为空或超过 50 字符
  - `type 必须是 stock/etf/bond/sector/index/futures/forex 之一，多个用逗号分隔`
  - `market 必须是 hs/bj/hk/us/jp/kr 之一`
  - `limit` 越界（1–100）、`offset` 为负
  - 未定义的查询参数
- `401` - `访问令牌无效或已过期`（由守卫抛出）
- `429` - 触发全局限流（每 60 秒 60 次）
- `503` - CLI 不可用（二进制缺失，提示 `npm run setup:westock`）或输出无法解析
- `504` - CLI 执行超时

> ⚠️ 本接口**每次请求 fork 一个子进程**，不宜高频调用（限流沿用全局的 60 秒 60 次）。
