# Stock SDK 接口

[← 返回目录](../API.md)

> 所有 Stock SDK 接口需要 JWT 认证，请在请求头中携带 `Authorization: Bearer <access_token>`
>
> 使用 stock-sdk 库，支持 A 股、港股、美股和基金行情查询
>
> 响应数据直接返回 stock-sdk 原始格式，详见 [stock-sdk 文档](https://stock-sdk.linkdiary.cn)

## 获取股票行情

批量获取指定市场的股票行情数据。

**请求**

```
POST /api/stock-sdk/quotes/:market
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                          |
| ------ | ------ | ---- | --------------------------------------------- |
| market | string | 是   | 市场类型: `cn`(A股) / `hk`(港股) / `us`(美股) |

**请求体**

| 参数  | 类型     | 必填 | 说明         |
| ----- | -------- | ---- | ------------ |
| codes | string[] | 是   | 股票代码数组 |

**请求示例**

```json
{
  "codes": ["600519", "000651", "000858"]
}
```

### A 股响应 (FullQuote)

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "marketId": "sh600519",
      "name": "贵州茅台",
      "code": "600519",
      "price": 1800.0,
      "prevClose": 1779.5,
      "open": 1785.0,
      "volume": 123456,
      "outerVolume": 60000,
      "innerVolume": 63456,
      "bid": [
        { "price": 1799.0, "volume": 100 },
        { "price": 1798.0, "volume": 200 }
      ],
      "ask": [
        { "price": 1800.0, "volume": 150 },
        { "price": 1801.0, "volume": 250 }
      ],
      "time": "20240115150000",
      "timestamp": 1705276800000,
      "tz": "Asia/Shanghai",
      "change": 20.5,
      "changePercent": 1.15,
      "high": 1810.0,
      "low": 1780.0,
      "volume2": 123456,
      "amount": 222222,
      "turnoverRate": 0.85,
      "pe": 35.5,
      "amplitude": 1.68,
      "circulatingMarketCap": 22500,
      "totalMarketCap": 28000,
      "pb": 10.2,
      "limitUp": 1957.5,
      "limitDown": 1601.5,
      "volumeRatio": 1.2,
      "avgPrice": 1795.0,
      "peStatic": 35.5,
      "peDynamic": 32.8,
      "high52w": 1900.0,
      "low52w": 1500.0,
      "circulatingShares": 1250000000,
      "totalShares": 1560000000,
      "market": "CN",
      "assetType": "stock",
      "source": "tencent"
    }
  ]
}
```

> **字段单位提示**：`volume` / `outerVolume` / `innerVolume` / `volume2` 单位为**手**，
> `amount` 为**万元**，`circulatingMarketCap` / `totalMarketCap` 为**亿元**。
> `timestamp` 在时间无法解析时为 `null`；估值类字段（`pe` / `pb` / `turnoverRate` 等）也可能为 `null`。

### 港股响应 (HKQuote)

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "marketId": "hk00700",
      "name": "腾讯控股",
      "code": "00700",
      "price": 380.0,
      "prevClose": 375.0,
      "open": 375.0,
      "volume": 8000000,
      "time": "20240115160000",
      "timestamp": 1705282800000,
      "tz": "Asia/Hong_Kong",
      "change": 5.0,
      "changePercent": 1.33,
      "high": 385.0,
      "low": 370.0,
      "amount": 3040000,
      "lotSize": 100,
      "circulatingMarketCap": 36000,
      "totalMarketCap": 38000,
      "currency": "HKD",
      "market": "HK",
      "assetType": "stock",
      "source": "tencent"
    }
  ]
}
```

### 美股响应 (USQuote)

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "marketId": "usAAPL",
      "name": "苹果",
      "code": "AAPL",
      "price": 195.0,
      "prevClose": 191.5,
      "open": 192.0,
      "volume": 50000000,
      "time": "20240115160000",
      "timestamp": 1705282800000,
      "tz": "America/New_York",
      "change": 3.5,
      "changePercent": 1.83,
      "high": 196.0,
      "low": 191.0,
      "amount": 9750000,
      "turnoverRate": 0.32,
      "pe": 30.5,
      "amplitude": 2.61,
      "totalMarketCap": 30000,
      "pb": 50.2,
      "high52w": 199.0,
      "low52w": 120.0,
      "market": "US",
      "assetType": "stock",
      "source": "tencent"
    }
  ]
}
```

**示例**

```bash
# 批量获取A股行情
curl -X POST http://localhost:3001/api/stock-sdk/quotes/cn \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["600519", "000651", "000858"]}'

# 批量获取港股行情
curl -X POST http://localhost:3001/api/stock-sdk/quotes/hk \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["00700", "09988"]}'

# 批量获取美股行情
curl -X POST http://localhost:3001/api/stock-sdk/quotes/us \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["AAPL", "MSFT"]}'
```

---

## 获取基金行情

批量获取基金的实时净值数据。

**请求**

```
POST /api/stock-sdk/funds
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数  | 类型     | 必填 | 说明         |
| ----- | -------- | ---- | ------------ |
| codes | string[] | 是   | 基金代码数组 |

**请求示例**

```json
{
  "codes": ["005827", "161725", "110011"]
}
```

**响应 (FundQuote)**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "code": "005827",
      "name": "易方达蓝筹精选混合",
      "nav": 1.2345,
      "accNav": 1.2345,
      "change": 0.0123,
      "navDate": "2024-01-15",
      "timestamp": 1705276800000,
      "tz": "Asia/Shanghai",
      "market": "CN",
      "assetType": "fund",
      "source": "eastmoney"
    }
  ]
}
```

**响应字段说明**

| 字段      | 说明                                       |
| --------- | ------------------------------------------ |
| code      | 基金代码                                   |
| name      | 基金名称                                   |
| nav       | 单位净值                                   |
| accNav    | 累计净值                                   |
| change    | 当日涨跌额                                 |
| navDate   | 净值日期 (YYYY-MM-DD)                      |
| timestamp | 净值日期时间戳 (毫秒)，无法解析时为 `null` |
| tz        | 时区 (`Asia/Shanghai`)                     |
| market    | 市场 (`CN`)                                |
| assetType | 资产类型 (`fund`)                          |
| source    | 数据源                                     |

**示例**

```bash
# 批量获取基金行情
curl -X POST http://localhost:3001/api/stock-sdk/funds \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["005827", "161725", "110011"]}'
```

---

## 搜索股票/指数/基金

根据关键词搜索股票、指数或基金。

**请求**

```
GET /api/stock-sdk/search
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**查询参数**

| 参数    | 类型   | 必填 | 说明       |
| ------- | ------ | ---- | ---------- |
| keyword | string | 是   | 搜索关键词 |

**响应 (SearchResult)**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "code": "sh600519",
      "name": "贵州茅台",
      "market": "sh",
      "type": "GP-A",
      "category": "stock"
    },
    {
      "code": "sh000300",
      "name": "沪深300",
      "market": "sh",
      "type": "ZS",
      "category": "index"
    },
    {
      "code": "005827",
      "name": "易方达蓝筹精选混合",
      "market": "",
      "type": "JJ",
      "category": "fund"
    }
  ]
}
```

**响应字段说明**

| 字段     | 说明                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| code     | 代码（带市场前缀，如 `sh600519`）                                                                          |
| name     | 名称                                                                                                       |
| market   | 市场标识（如 `sh`/`sz`/`hk`/`us`）                                                                         |
| type     | 上游原始资产类型字符串（如 `GP-A` 股票 / `ZS` 指数 / `JJ`、`KJ` 基金 / `ZQ` 债券 / `QH` 期货 / `QZ` 期权） |
| category | 标准化资产分类，可选字段，取值：`stock` / `index` / `fund` / `bond` / `futures` / `option` / `other`       |

> 建议使用归一化后的 `category` 做类型判断，`type` 保留上游原值以兼容。

**示例**

```bash
# 搜索茅台
curl http://localhost:3001/api/stock-sdk/search?keyword=茅台 \
  -H "Authorization: Bearer <access_token>"

# 搜索沪深300指数
curl http://localhost:3001/api/stock-sdk/search?keyword=沪深300 \
  -H "Authorization: Bearer <access_token>"

# 搜索基金
curl http://localhost:3001/api/stock-sdk/search?keyword=易方达 \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取全部市场行情

获取指定市场的全部股票行情数据。

**请求**

```
GET /api/stock-sdk/batch/:market
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                          |
| ------ | ------ | ---- | --------------------------------------------- |
| market | string | 是   | 市场类型: `cn`(A股) / `hk`(港股) / `us`(美股) |

**查询参数**

| 参数        | 类型   | 必填 | 说明                         |
| ----------- | ------ | ---- | ---------------------------- |
| batchSize   | number | 否   | 单次请求的股票数量，默认 500 |
| concurrency | number | 否   | 最大并发请求数，默认 7       |

**响应**

返回 stock-sdk 原始格式的行情数组。

**示例**

```bash
# 获取全部 A 股行情
curl http://localhost:3001/api/stock-sdk/batch/cn \
  -H "Authorization: Bearer <access_token>"

# 获取全部港股行情
curl http://localhost:3001/api/stock-sdk/batch/hk \
  -H "Authorization: Bearer <access_token>"

# 获取全部美股行情（指定批次大小和并发数）
curl http://localhost:3001/api/stock-sdk/batch/us?batchSize=100&concurrency=5 \
  -H "Authorization: Bearer <access_token>"
```

---

## 按代码批量获取行情

根据股票代码批量获取行情数据。

**请求**

```
POST /api/stock-sdk/batch
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数        | 类型     | 必填 | 说明               |
| ----------- | -------- | ---- | ------------------ |
| codes       | string[] | 是   | 股票代码数组       |
| batchSize   | number   | 否   | 单次请求的股票数量 |
| concurrency | number   | 否   | 最大并发请求数     |

**请求示例**

```json
{
  "codes": ["sh600519", "sz000651", "hk00700", "usAAPL"],
  "batchSize": 100,
  "concurrency": 5
}
```

**响应**

返回 stock-sdk 原始格式的行情数组（FullQuote）。

**示例**

```bash
# 按代码批量获取行情
curl -X POST http://localhost:3001/api/stock-sdk/batch \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["sh600519", "sz000651", "hk00700", "usAAPL"]}'
```

---

## 获取K线数据

获取指定股票的历史K线、分钟K线或带技术指标的K线数据。单接口按参数自动分派，**优先级自上而下**：

1. `period` 为 `1` / `5` / `15` / `30` / `60` → **分钟K线**（此时 `indicators` 不生效）
2. `indicators` 非空 → **带技术指标K线**（仅支持 `daily` / `weekly` / `monthly`）
3. 其余情况 → **历史K线**（`daily` / `weekly` / `monthly`）

**请求**

```
GET /api/stock-sdk/kline/:market/:code
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                          |
| ------ | ------ | ---- | --------------------------------------------- |
| market | string | 是   | 市场类型: `cn`(A股) / `hk`(港股) / `us`(美股) |
| code   | string | 是   | 股票代码                                      |

**查询参数**

| 参数       | 类型   | 必填 | 说明                                                                                                           |
| ---------- | ------ | ---- | -------------------------------------------------------------------------------------------------------------- |
| period     | string | 否   | K线周期: `daily`(日K) / `weekly`(周K) / `monthly`(月K) 或 分钟K线 `1` / `5` / `15` / `30` / `60`，默认 `daily` |
| adjust     | string | 否   | 复权类型: `qfq`(前复权) / `hfq`(后复权) / 空字符串(不复权)，默认 `qfq`。**1 分钟K线不支持复权**                |
| startDate  | string | 否   | 开始日期 (YYYYMMDD 或 YYYY-MM-DD)                                                                              |
| endDate    | string | 否   | 结束日期 (YYYYMMDD 或 YYYY-MM-DD)                                                                              |
| indicators | object | 否   | 指标配置 JSON 对象，传入时返回带指标的K线；分钟周期下会被忽略                                                  |

> **参数校验**：`period` 仅接受上述枚举值，`startDate` / `endDate` 需符合 `YYYYMMDD` 或 `YYYY-MM-DD` 格式，否则返回 `400`。

### 1 分钟K线的交易日自动定位

`period=1` 且**未指定** `startDate` / `endDate` 时，服务端会依据当前交易时段自动确定目标交易日，避免盘前或非交易日取到空数据：

| 当前时段 | 状态值        | 目标交易日 |
| -------- | ------------- | ---------- |
| 盘前     | `pre_market`  | 前一交易日 |
| 交易中   | `open`        | 当天       |
| 午休     | `lunch_break` | 当天       |
| 盘后     | `after_hours` | 当天       |
| 休市     | `closed`      | 前一交易日 |

> `closed` 涵盖周末、节假日与凌晨等远离交易时段的时间。
> 该行为**仅对 `period=1` 生效**；`5` / `15` / `30` / `60` 分钟周期由上游返回默认区间。
> 显式传入 `startDate` / `endDate` 时不作任何调整，按传入值查询。

**indicators 指标配置**

| 指标 | 类型     | 说明                              |
| ---- | -------- | --------------------------------- |
| ma   | number[] | MA 均线周期数组，如 `[5, 10, 20]` |
| macd | boolean  | 是否启用 MACD                     |
| boll | boolean  | 是否启用布林带                    |
| kdj  | boolean  | 是否启用 KDJ                      |
| rsi  | boolean  | 是否启用 RSI                      |
| wr   | boolean  | 是否启用威廉指标                  |
| bias | boolean  | 是否启用乖离率                    |
| cci  | boolean  | 是否启用 CCI                      |
| atr  | boolean  | 是否启用 ATR                      |
| obv  | boolean  | 是否启用 OBV                      |
| roc  | boolean  | 是否启用 ROC                      |
| dmi  | boolean  | 是否启用 DMI                      |
| sar  | boolean  | 是否启用 SAR                      |
| kc   | boolean  | 是否启用 KC                       |

**响应**

返回 stock-sdk 原始格式的数据数组，**结构随周期不同**：

| 周期                           | 结构           | 时间字段                     | 特有字段                     |
| ------------------------------ | -------------- | ---------------------------- | ---------------------------- |
| `daily` / `weekly` / `monthly` | HistoryKline   | `date`（`YYYY-MM-DD`）       | `code`、`turnoverRate`       |
| `1`                            | MinuteTimeline | `time`（`YYYY-MM-DD HH:mm`） | `avgPrice`（均价）           |
| `5` / `15` / `30` / `60`       | MinuteKline    | `time`（`YYYY-MM-DD HH:mm`） | `amplitude`、`changePercent` |

三者共有的字段：`timestamp`、`tz`、`open`、`close`、`high`、`low`、`volume`、`amount`；价格类字段均可能为 `null`。

A 股日K线示例：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "date": "2024-01-15",
      "timestamp": 1705276800000,
      "tz": "Asia/Shanghai",
      "code": "600519",
      "open": 1785.0,
      "close": 1800.0,
      "high": 1810.0,
      "low": 1780.0,
      "volume": 12345678,
      "amount": 222222,
      "amplitude": 1.68,
      "changePercent": 1.15,
      "change": 20.5,
      "turnoverRate": 0.85
    }
  ]
}
```

1 分钟K线（分时结构，注意 `time` 与 `avgPrice`）示例：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "time": "2024-01-15 09:31",
      "timestamp": 1705282260000,
      "tz": "Asia/Shanghai",
      "open": 1785.0,
      "close": 1786.5,
      "high": 1787.0,
      "low": 1784.5,
      "volume": 1200,
      "amount": 2143800,
      "avgPrice": 1786.2
    }
  ]
}
```

**示例**

```bash
# 获取A股日K线
curl http://localhost:3001/api/stock-sdk/kline/cn/600519 \
  -H "Authorization: Bearer <access_token>"

# 获取港股周K线
curl http://localhost:3001/api/stock-sdk/kline/hk/00700?period=weekly \
  -H "Authorization: Bearer <access_token>"

# 获取美股月K线
curl http://localhost:3001/api/stock-sdk/kline/us/AAPL?period=monthly \
  -H "Authorization: Bearer <access_token>"

# 获取A股1分钟K线（自动定位当前/前一交易日）
curl http://localhost:3001/api/stock-sdk/kline/cn/600519?period=1 \
  -H "Authorization: Bearer <access_token>"

# 获取A股1分钟K线（显式指定交易日，不触发自动定位）
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519?period=1&startDate=20240115&endDate=20240115" \
  -H "Authorization: Bearer <access_token>"

# 获取A股5分钟K线
curl http://localhost:3001/api/stock-sdk/kline/cn/600519?period=5 \
  -H "Authorization: Bearer <access_token>"

# 获取港股15分钟K线
curl http://localhost:3001/api/stock-sdk/kline/hk/00700?period=15 \
  -H "Authorization: Bearer <access_token>"

# 获取美股60分钟K线
curl http://localhost:3001/api/stock-sdk/kline/us/AAPL?period=60 \
  -H "Authorization: Bearer <access_token>"

# 获取指定日期范围的K线
curl http://localhost:3001/api/stock-sdk/kline/cn/600519?startDate=20240101&endDate=20240131 \
  -H "Authorization: Bearer <access_token>"

# 获取带 MA 均线的K线
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519?period=daily&indicators=%7B%22ma%22%3A%5B5%2C10%2C20%5D%7D" \
  -H "Authorization: Bearer <access_token>"

# 获取带 MACD 的K线
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519?indicators=%7B%22macd%22%3Atrue%7D" \
  -H "Authorization: Bearer <access_token>"

# 获取带多个指标的K线
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519?indicators=%7B%22ma%22%3A%5B5%2C10%2C20%5D%2C%22macd%22%3Atrue%2C%22boll%22%3Atrue%2C%22rsi%22%3Atrue%7D" \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取大单数据

获取指定股票的大单成交数据。

**请求**

```
POST /api/stock-sdk/large-order
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数  | 类型     | 必填 | 说明         |
| ----- | -------- | ---- | ------------ |
| codes | string[] | 是   | 股票代码数组 |

**请求示例**

```json
{
  "codes": ["600519", "000651"]
}
```

**响应**

响应 `data` 为单个交易日的买卖盘大单/小单占比数组（PanelLargeOrder）：

| 字段           | 类型   | 说明         |
| -------------- | ------ | ------------ |
| buyLargeRatio  | number | 买盘大单占比 |
| buySmallRatio  | number | 买盘小单占比 |
| sellLargeRatio | number | 卖盘大单占比 |
| sellSmallRatio | number | 卖盘小单占比 |

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "buyLargeRatio": 0.32,
      "buySmallRatio": 0.18,
      "sellLargeRatio": 0.28,
      "sellSmallRatio": 0.22
    }
  ]
}
```

> ⚠️ 返回元素**不包含股票代码**，批量查询时需按请求 `codes` 的顺序自行对应。

**示例**

```bash
# 获取大单数据
curl -X POST http://localhost:3001/api/stock-sdk/large-order \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["600519", "000651"]}'
```

---

## 获取代码列表

获取指定市场的股票/基金代码列表。

**请求**

```
GET /api/stock-sdk/codes/:market
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                                         |
| ------ | ------ | ---- | ------------------------------------------------------------ |
| market | string | 是   | 市场类型: `cn`(A股) / `hk`(港股) / `us`(美股) / `fund`(基金) |

**响应**

响应 `data` 为代码字符串数组（纯代码，不含市场前缀）。

```json
{
  "code": 200,
  "message": "获取成功",
  "data": ["600519", "000651", "000858"]
}
```

**示例**

```bash
# 获取A股代码列表
curl http://localhost:3001/api/stock-sdk/codes/cn \
  -H "Authorization: Bearer <access_token>"

# 获取港股代码列表
curl http://localhost:3001/api/stock-sdk/codes/hk \
  -H "Authorization: Bearer <access_token>"

# 获取美股代码列表
curl http://localhost:3001/api/stock-sdk/codes/us \
  -H "Authorization: Bearer <access_token>"

# 获取基金代码列表
curl http://localhost:3001/api/stock-sdk/codes/fund \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取K线信号

获取指定股票的K线技术分析信号（金叉/死叉、超买/超卖等）。

**请求**

```
GET /api/stock-sdk/kline/:market/:code/signals
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                          |
| ------ | ------ | ---- | --------------------------------------------- |
| market | string | 是   | 市场类型: `cn`(A股) / `hk`(港股) / `us`(美股) |
| code   | string | 是   | 股票代码                                      |

**查询参数**

| 参数      | 类型   | 必填 | 说明                                                  |
| --------- | ------ | ---- | ----------------------------------------------------- |
| period    | string | 否   | K线周期: `daily` / `weekly` / `monthly`，默认 `daily` |
| adjust    | string | 否   | 复权类型: `qfq` / `hfq` / 空字符串                    |
| startDate | string | 否   | 开始日期 (YYYYMMDD 或 YYYY-MM-DD)                     |
| endDate   | string | 否   | 结束日期 (YYYYMMDD 或 YYYY-MM-DD)                     |
| maFast    | number | 否   | MA 快线周期，默认 5                                   |
| maSlow    | number | 否   | MA 慢线周期，默认 20                                  |

**响应**

响应 `data` 为识别出的信号数组：

| 字段      | 类型                   | 说明                                                 |
| --------- | ---------------------- | ---------------------------------------------------- |
| type      | string                 | 信号类型，共 14 种，取值见下表                       |
| date      | string                 | 信号发生K线的日期（通常 `YYYY-MM-DD`）               |
| timestamp | number                 | 信号发生K线的时间戳（毫秒）                          |
| close     | number \| null         | 信号发生K线的收盘价                                  |
| detail    | Record<string, number> | 附加信息（如金叉的快慢周期、超买超卖的指标值），可选 |

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "type": "ma_golden_cross",
      "date": "2026-06-15",
      "timestamp": 1781481600000,
      "close": 1720.0,
      "detail": { "fast": 5, "slow": 20 }
    }
  ]
}
```

**信号类型取值**

| 分类      | 取值                                                                       |
| --------- | -------------------------------------------------------------------------- |
| MA 交叉   | `ma_golden_cross` / `ma_death_cross`                                       |
| MACD 交叉 | `macd_golden_cross` / `macd_death_cross`                                   |
| KDJ       | `kdj_golden_cross` / `kdj_death_cross` / `kdj_overbought` / `kdj_oversold` |
| RSI       | `rsi_overbought` / `rsi_oversold`                                          |
| BOLL      | `boll_break_upper` / `boll_break_lower`                                    |
| SAR       | `sar_reversal_up` / `sar_reversal_down`                                    |

> 不传 `startDate` 时将在全部历史上识别信号，数据量可能较大；
> 只关注近期信号时建议传入 `startDate` 收窄窗口。

**示例**

```bash
# 获取K线信号
curl http://localhost:3001/api/stock-sdk/kline/cn/600519/signals?period=daily&maFast=5&maSlow=20 \
  -H "Authorization: Bearer <access_token>"
```
