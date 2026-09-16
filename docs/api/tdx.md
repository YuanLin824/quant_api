# 通达信（TDX）接口

[← 返回目录](../../API.md)

> 所有接口需要 JWT 认证，请在请求头中携带 `Authorization: Bearer <access_token>`
>
> 基于 [node-tdx-market](https://github.com/interstellarmt/node-tdx)（通达信 TCP 协议客户端）直连行情服务器

## 重要说明

### 价格单位是「厘」

⚠️ **所有价格字段的单位是厘（元 × 1000）**，与常见的以「元」为单位的行情接口不同。

| 返回的原始值 | 实际价格   |
| ------------ | ---------- |
| `1800000`    | 1800.00 元 |
| `12345`      | 12.345 元  |

换算公式：`元 = 厘 / 1000`。`node-tdx-market` 提供 `priceToYuan()` / `yuanToPrice()` 两个换算函数。

这样返回是有意为之——上游解析结果**原样透传**，不在此层做字段级转换（价格字段散布在 K线、盘口、分时、分笔、证券列表等各类响应中，逐个转换容易遗漏）。

### 连接与错误

服务启动时会主动连接通达信行情服务器，**但连接失败不会阻塞应用启动**（仅记录警告）。
首次请求时会重试连接；连接不可用时返回：

```json
{
  "code": 503,
  "data": null,
  "message": "通达信行情服务器连接失败，请稍后重试"
}
```

> 服务器地址由 `TDX_HOST` / `TDX_PORT` 配置；留空则由库自动测速选择最快的服务器。

### 股票代码格式

路径参数 `:code` 接受两种格式：纯数字 `600036` 或带市场前缀 `sh600036`。

---

## 获取 K 线

**请求**

```
GET /api/tdx/kline/:code?period=day&start=0&count=100
Authorization: Bearer <access_token>
```

**路径参数**

| 参数 | 类型   | 必填 | 说明                               |
| ---- | ------ | ---- | ---------------------------------- |
| code | string | 是   | 股票代码，如 `600036` / `sh600036` |

**查询参数**

| 参数   | 类型   | 必填 | 说明                                                                                |
| ------ | ------ | ---- | ----------------------------------------------------------------------------------- |
| period | string | 否   | K线周期：`1m` / `5m` / `15m` / `30m` / `60m` / `day` / `week` / `month`，默认 `day` |
| start  | number | 否   | 起始位置（`0` = 最新，往前倒推），默认 0                                            |
| count  | number | 否   | 返回数量，最大 800                                                                  |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "count": 2,
    "bars": [
      {
        "time": "2026-09-12T00:00:00.000Z",
        "open": 1720000,
        "high": 1745000,
        "low": 1718000,
        "close": 1740000,
        "volume": 12345,
        "amount": 2143800000
      }
    ]
  }
}
```

> `bars[].time` 为 Date（JSON 序列化为 ISO 字符串）；价格字段单位为厘。

**示例**

```bash
curl "http://localhost:3001/api/tdx/kline/600036?period=week&count=50" \
  -H "Authorization: Bearer <access_token>"
```

---

## 批量获取五档盘口

**请求**

```
POST /api/tdx/quotes
Authorization: Bearer <access_token>
```

**请求体**

| 参数  | 类型     | 必填 | 说明         |
| ----- | -------- | ---- | ------------ |
| codes | string[] | 是   | 股票代码数组 |

**请求示例**

```json
{
  "codes": ["600036", "000001", "sh601318"]
}
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "exchange": 1,
      "code": "600036",
      "lastClose": 1718000,
      "open": 1720000,
      "high": 1745000,
      "low": 1718000,
      "price": 1740000,
      "volume": 12345,
      "amount": 2143800000,
      "bid": [
        { "price": 1739000, "volume": 100 },
        { "price": 1738000, "volume": 200 }
      ],
      "ask": [
        { "price": 1740000, "volume": 150 },
        { "price": 1741000, "volume": 250 }
      ]
    }
  ]
}
```

> `bid` / `ask` 各 5 档（买一至买五 / 卖一至卖五）；`exchange` 为数字（0=深，1=沪，2=北）。

**示例**

```bash
curl -X POST "http://localhost:3001/api/tdx/quotes" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["600036", "000001"]}'
```

---

## 获取当日分时

**请求**

```
GET /api/tdx/minute/:code
Authorization: Bearer <access_token>
```

**路径参数**

| 参数 | 类型   | 必填 | 说明                               |
| ---- | ------ | ---- | ---------------------------------- |
| code | string | 是   | 股票代码，如 `600036` / `sh600036` |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "count": 2,
    "items": [
      { "time": "09:31", "price": 1720000, "avgPrice": 1720100, "volume": 120 },
      { "time": "09:32", "price": 1721000, "avgPrice": 1720500, "volume": 95 }
    ]
  }
}
```

**示例**

```bash
curl "http://localhost:3001/api/tdx/minute/600036" \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取历史分时

**请求**

```
GET /api/tdx/minute/:code/history?date=20260914
Authorization: Bearer <access_token>
```

**路径参数**

| 参数 | 类型   | 必填 | 说明                               |
| ---- | ------ | ---- | ---------------------------------- |
| code | string | 是   | 股票代码，如 `600036` / `sh600036` |

**查询参数**

| 参数 | 类型   | 必填 | 说明                      |
| ---- | ------ | ---- | ------------------------- |
| date | string | 是   | 交易日期，格式 `YYYYMMDD` |

**响应**

结构同当日分时。

**示例**

```bash
curl "http://localhost:3001/api/tdx/minute/600036/history?date=20260914" \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取当日分笔成交

**请求**

```
GET /api/tdx/trade/:code?start=0&count=100
Authorization: Bearer <access_token>
```

**路径参数**

| 参数 | 类型   | 必填 | 说明                               |
| ---- | ------ | ---- | ---------------------------------- |
| code | string | 是   | 股票代码，如 `600036` / `sh600036` |

**查询参数**

| 参数  | 类型   | 必填 | 说明                           |
| ----- | ------ | ---- | ------------------------------ |
| start | number | 否   | 起始位置（`0` = 最新），默认 0 |
| count | number | 否   | 返回数量                       |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "count": 2,
    "items": [
      { "time": "09:31:05", "price": 1720000, "volume": 20, "direction": 0 },
      { "time": "09:31:08", "price": 1719000, "volume": 15, "direction": 1 }
    ]
  }
}
```

> `direction` 为成交方向：`0` = 买，`1` = 卖，`2` = 中性。

**示例**

```bash
curl "http://localhost:3001/api/tdx/trade/600036?count=50" \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取历史分笔成交

**请求**

```
GET /api/tdx/trade/:code/history?date=20260914&start=0&count=100
Authorization: Bearer <access_token>
```

**路径参数**

| 参数 | 类型   | 必填 | 说明                               |
| ---- | ------ | ---- | ---------------------------------- |
| code | string | 是   | 股票代码，如 `600036` / `sh600036` |

**查询参数**

| 参数  | 类型   | 必填 | 说明                           |
| ----- | ------ | ---- | ------------------------------ |
| date  | string | 是   | 交易日期，格式 `YYYYMMDD`      |
| start | number | 否   | 起始位置（`0` = 最新），默认 0 |
| count | number | 否   | 返回数量                       |

**响应**

结构同当日分笔成交。

**示例**

```bash
curl "http://localhost:3001/api/tdx/trade/600036/history?date=20260914" \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取证券数量

**请求**

```
GET /api/tdx/stocks/:exchange/count
Authorization: Bearer <access_token>
```

**路径参数**

| 参数     | 类型   | 必填 | 说明                                         |
| -------- | ------ | ---- | -------------------------------------------- |
| exchange | string | 是   | 交易所：`sz`(深圳) / `sh`(上海) / `bj`(北京) |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": 23156
}
```

**示例**

```bash
curl "http://localhost:3001/api/tdx/stocks/sh/count" \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取全量证券列表

底层按 1000 条/页自动分页拉取，一次调用返回该交易所全部证券。

**请求**

```
GET /api/tdx/stocks/:exchange
Authorization: Bearer <access_token>
```

**路径参数**

| 参数     | 类型   | 必填 | 说明                                         |
| -------- | ------ | ---- | -------------------------------------------- |
| exchange | string | 是   | 交易所：`sz`(深圳) / `sh`(上海) / `bj`(北京) |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "exchange": 1,
      "code": "600036",
      "fullCode": "sh600036",
      "name": "招商银行",
      "volUnit": 100,
      "decimalPoint": 2,
      "preClose": 1718000
    }
  ]
}
```

**响应字段说明**

| 字段         | 说明                       |
| ------------ | -------------------------- |
| exchange     | 交易所（0=深，1=沪，2=北） |
| code         | 纯数字代码，如 `600036`    |
| fullCode     | 带前缀代码，如 `sh600036`  |
| name         | 证券名称                   |
| volUnit      | 每手股数                   |
| decimalPoint | 小数位数                   |
| preClose     | 昨收价（**厘**）           |

> ⚠️ 单个交易所可达数千至数万条，响应体较大且耗时较长（需多次分页请求）。
> 建议按需调用并考虑缓存，不要高频轮询。

**示例**

```bash
curl "http://localhost:3001/api/tdx/stocks/sh" \
  -H "Authorization: Bearer <access_token>"
```
