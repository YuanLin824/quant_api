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
>
> **不传日期时的范围**：不传 `startDate` / `endDate` 时，上游按 `19700101` ~ `20500101` 请求，即返回其可提供的**全部历史 K 线**，
> 数据量与耗时都较大，建议显式传入 `startDate`。（信号接口与之不同，见[默认回溯窗口](#默认回溯窗口)）

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

响应 `data` 为代码字符串数组。**各市场的代码格式并不一致**——本接口原样透传上游，不做任何转换：

| 市场   | 格式                        | 示例       |
| ------ | --------------------------- | ---------- |
| `cn`   | 带 `sh` / `sz` / `bj` 前缀  | `sh600519` |
| `hk`   | 纯数字                      | `00700`    |
| `us`   | 东财 secid（数字前缀 + 点） | `105.AAPL` |
| `fund` | 纯数字                      | `005827`   |

> 注意与下文[手动触发标的代码同步](#手动触发标的代码同步)的区别：**入库**时会统一成
> 「市场前缀 + 代码」（美股 `105.AAPL` → `usAAPL`、港股 `00700` → `hk00700`），本接口不经过该转换。

```json
{
  "code": 200,
  "message": "获取成功",
  "data": ["bj920000", "sh600519", "sz000858"]
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

| 参数      | 类型   | 必填 | 说明                                                                  |
| --------- | ------ | ---- | --------------------------------------------------------------------- |
| period    | string | 否   | K线周期: `daily` / `weekly` / `monthly`，默认 `daily`                 |
| adjust    | string | 否   | 复权类型: `qfq` / `hfq` / 空字符串                                    |
| startDate | string | 否   | 开始日期 (YYYYMMDD 或 YYYY-MM-DD)；**不传时按 `period` 套用默认窗口** |
| endDate   | string | 否   | 结束日期 (YYYYMMDD 或 YYYY-MM-DD)                                     |
| maFast    | number | 否   | MA 快线周期，默认 5                                                   |
| maSlow    | number | 否   | MA 慢线周期，默认 20                                                  |

### 默认回溯窗口

不传 `startDate` 时，服务端按 `period` 套用默认窗口，避免直接扫描全部历史：

| period    | 默认窗口   |
| --------- | ---------- |
| `daily`   | 近 1 个月  |
| `weekly`  | 近 6 个月  |
| `monthly` | 近 36 个月 |

> 周期越长单根 K 线跨度越大，需回溯更久才能覆盖相近的时间范围。
> 显式传入 `startDate` 时以传入值为准；若只传了 `endDate`，默认窗口以 `endDate` 为基准逆推（而非当前时间），
> 保证回溯范围落在查询区间内。

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

**示例**

```bash
# 获取日线信号（默认近 1 个月）
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519/signals?period=daily" \
  -H "Authorization: Bearer <access_token>"

# 获取周线信号（默认近 6 个月）
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519/signals?period=weekly" \
  -H "Authorization: Bearer <access_token>"

# 获取月线信号（默认近 36 个月）
curl "http://localhost:3001/api/stock-sdk/kline/us/AAPL/signals?period=monthly" \
  -H "Authorization: Bearer <access_token>"

# 显式指定时间范围（覆盖默认窗口）与 MA 快慢线
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519/signals?period=daily&startDate=20240101&endDate=20240131&maFast=5&maSlow=20" \
  -H "Authorization: Bearer <access_token>"
```

---

## 手动触发标的代码同步

标的代码库由定时任务每天 **09:00（北京时间，开盘前）** 自动同步 A 股 / 美股 / 港股 / 基金代码，
此接口用于首次初始化或失败补跑。

**请求**

```
POST /api/stock-sdk/symbols/sync
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**响应**

```json
{
  "code": 200,
  "message": "同步完成",
  "data": {
    "results": [
      { "market": "cn", "total": 5563, "inserted": 3 },
      { "market": "us", "total": 13538, "inserted": 0 },
      { "market": "hk", "total": 4695, "inserted": 1 },
      { "market": "fund", "total": 27851, "inserted": 0 }
    ],
    "durationMs": 8420
  }
}
```

> `inserted` 为本次**新增**条数。同步采用 **upsert**（以 `code` 为唯一键）：
> 不存在则新增；已存在且所属市场有变化时更新，无变化则不写入；不会删除已退市的历史记录。
>
> 各市场相互独立——单个市场失败只在该项的 `error` 字段体现，其余市场照常同步。
>
> 入库前会对代码做规范化并**去重**：美股剥掉东财板块前缀（`105`/`106`/`107`）是**有损**的，
> 同一标的可能同时挂在两个板块下（如 `105.PC` 与 `106.PC` 同为 `PC.OQ`），规范化后撞成同一个代码。
> 因此 `total` 为**上游原始条数**，可能略大于实际入库数（美股约 2 条），重复项会记入 WARN 日志。

**示例**

```bash
curl -X POST "http://localhost:3001/api/stock-sdk/symbols/sync" \
  -H "Authorization: Bearer <access_token>"
```

---

## 查询标的代码

**请求**

```
GET /api/stock-sdk/symbols
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**查询参数**

| 参数   | 类型   | 必填 | 说明                                                        |
| ------ | ------ | ---- | ----------------------------------------------------------- |
| market | string | 否   | 市场：`cn` / `hk` / `us` / `fund`；不传则返回各市场数量统计 |

**响应**

传 `market` 时返回该市场的代码数组（升序）：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": ["sh600000", "sh600004", "sh600006"]
}
```

不传时返回各市场的代码数量：

```json
{
  "code": 200,
  "message": "获取成功",
  "data": { "cn": 5412, "us": 8231, "hk": 2614, "fund": 19820 }
}
```

**代码格式**

代码格式统一为「市场前缀 + 代码」，港股与美股在入库时做了规范化：

| 市场 | 上游返回                      | 入库格式  |
| ---- | ----------------------------- | --------- |
| A 股 | `sh600000`（自带前缀）        | 原样      |
| 美股 | `105.AAPL`（东财 secid 前缀） | `usAAPL`  |
| 港股 | `00700`（纯数字）             | `hk00700` |
| 基金 | `005827`                      | 原样      |

> 美股上游前缀为东财 secid 市场码：`105`=NASDAQ、`106`=NYSE、`107`=AMEX，统一归一化为 `us`。
>
> 由于代码自带市场前缀，`code` 在四个市场间**全局唯一**，可作为跨市场的唯一标识
> （同步时的 upsert 即以它为冲突键）。

**示例**

```bash
# 各市场数量统计
curl "http://localhost:3001/api/stock-sdk/symbols" \
  -H "Authorization: Bearer <access_token>"

# A 股代码列表
curl "http://localhost:3001/api/stock-sdk/symbols?market=cn" \
  -H "Authorization: Bearer <access_token>"
```

---

## 手动触发板块资金流采集

板块资金流排名由定时任务每天 **17:00（北京时间，A 股收盘后）** 自动采集。此接口用于首次初始化、补跑，
或采集其他板块类型 / 排名周期。

**请求**

```
POST /api/stock-sdk/sectors/sync
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数       | 类型    | 必填 | 说明                                                                           |
| ---------- | ------- | ---- | ------------------------------------------------------------------------------ |
| tradeDate  | string  | 否   | 数据所属交易日（YYYYMMDD 或 YYYY-MM-DD）；不传则取最近一个已完成交易日         |
| sectorType | string  | 否   | 板块类型：`industry`(行业) / `concept`(概念) / `region`(地域)，默认 `industry` |
| indicator  | string  | 否   | 排名周期：`today` / `3day` / `5day` / `10day`，默认 `today`                    |
| dryRun     | boolean | 否   | 只取数不落库，用于验证                                                         |

**响应**

```json
{
  "code": 200,
  "message": "执行完成",
  "data": {
    "tradeDate": "2026-09-11",
    "sectorType": "industry",
    "indicator": "today",
    "total": 86,
    "persisted": true,
    "purged": 0,
    "durationMs": 1240
  }
}
```

> 上游返回空数据时会**跳过落库**（不覆盖已有记录），此时 `persisted` 为 `false`。

**示例**

```bash
# 采集默认类型（行业板块 / 当日）
curl -X POST "http://localhost:3001/api/stock-sdk/sectors/sync" \
  -H "Authorization: Bearer <access_token>"

# 采集概念板块的 5 日资金流，并指定日期
curl -X POST "http://localhost:3001/api/stock-sdk/sectors/sync" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"sectorType": "concept", "indicator": "5day", "tradeDate": "2026-09-11"}'
```

---

## 查询板块资金流

**请求**

```
GET /api/stock-sdk/sectors
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**查询参数**

| 参数       | 类型   | 必填 | 说明                               |
| ---------- | ------ | ---- | ---------------------------------- |
| date       | string | 否   | 数据所属交易日；不传则返回最近一批 |
| sectorType | string | 否   | 板块类型过滤（仅在传 date 时生效） |

**响应**

传 `date` 时返回该日的记录数组（按排名升序）；不传时返回 `{ tradeDate, rows }`；无数据时为 `null`。

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "tradeDate": "2026-09-11",
      "sectorType": "industry",
      "indicator": "today",
      "rank": 1,
      "code": "BK0910",
      "name": "半导体",
      "changePercent": 3.2,
      "mainNetInflow": 890000000,
      "mainNetInflowPercent": 6.8,
      "superLargeNetInflow": 610000000,
      "largeNetInflow": 280000000,
      "mediumNetInflow": 0,
      "smallNetInflow": -890000000,
      "topStockName": "中芯国际",
      "topStockCode": "688981"
    }
  ]
}
```

**响应字段说明**

| 字段                 | 说明                       |
| -------------------- | -------------------------- |
| rank                 | 排名（与上游返回顺序一致） |
| code                 | 板块代码（东财 BK 编号）   |
| name                 | 板块名称                   |
| changePercent        | 板块涨跌幅(%)              |
| mainNetInflow        | 主力净流入净额(元)         |
| mainNetInflowPercent | 主力净流入净占比(%)        |
| superLargeNetInflow  | 超大单净额(元)             |
| largeNetInflow       | 大单净额(元)               |
| mediumNetInflow      | 中单净额(元)               |
| smallNetInflow       | 小单净额(元)               |
| topStockName / Code  | 板块内主力净流入最大股     |

> 数值字段可能为 `null`（上游对无成交板块不返回）。
>
> 数据**保留最近一个月**，每个交易日一批。唯一键包含板块类型与排名周期，
> 因此同一交易日可按 `industry`/`concept`/`region` 与不同 `indicator` 分别采集，互不覆盖。

**示例**

```bash
# 最近一批
curl "http://localhost:3001/api/stock-sdk/sectors" \
  -H "Authorization: Bearer <access_token>"

# 指定交易日与板块类型
curl "http://localhost:3001/api/stock-sdk/sectors?date=2026-09-11&sectorType=industry" \
  -H "Authorization: Bearer <access_token>"
```

---

## 手动触发个股资金流采集

个股资金流排名由定时任务每天 **16:00（北京时间，A 股收盘后）** 自动采集。此接口用于首次初始化、
补跑，或采集其他排名周期。

**请求**

```
POST /api/stock-sdk/fund-flows/sync
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数      | 类型    | 必填 | 说明                                                                     |
| --------- | ------- | ---- | ------------------------------------------------------------------------ |
| tradeDate | string  | 否   | 数据所属交易日（YYYYMMDD 或 YYYY-MM-DD）；不传则取当天或之前最近的交易日 |
| indicator | string  | 否   | 排名周期：`today` / `3day` / `5day` / `10day`，默认 `today`              |
| dryRun    | boolean | 否   | 只取数不落库，用于验证                                                   |

**响应**

```json
{
  "code": 200,
  "message": "执行完成",
  "data": {
    "tradeDate": "2026-09-14",
    "indicator": "today",
    "total": 5231,
    "persisted": true,
    "purged": 0,
    "durationMs": 18200
  }
}
```

> ⚠️ 单次采集为**全市场数千条**，耗时明显长于板块接口；`dryRun` 也会真实发起上游请求。
> 上游返回空数据时会跳过落库，此时 `persisted` 为 `false`。

**示例**

```bash
curl -X POST "http://localhost:3001/api/stock-sdk/fund-flows/sync" \
  -H "Authorization: Bearer <access_token>"
```

---

## 查询个股资金流排名

**请求**

```
GET /api/stock-sdk/fund-flows
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**查询参数**

| 参数      | 类型   | 必填 | 说明                               |
| --------- | ------ | ---- | ---------------------------------- |
| date      | string | 否   | 数据所属交易日；不传则返回最近一批 |
| indicator | string | 否   | 排名周期过滤                       |
| page      | number | 否   | 页码，默认 1                       |
| pageSize  | number | 否   | 每页条数，默认 50，最大 200        |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "tradeDate": "2026-09-14",
    "indicator": "today",
    "total": 5231,
    "rows": [
      {
        "rank": 1,
        "code": "sh600519",
        "name": "贵州茅台",
        "price": 1720.0,
        "changePercent": 2.1,
        "mainNetInflow": 890000000,
        "mainNetInflowPercent": 8.2,
        "superLargeNetInflow": 610000000,
        "superLargeNetInflowPercent": 5.6,
        "largeNetInflow": 280000000,
        "largeNetInflowPercent": 2.6,
        "mediumNetInflow": -300000000,
        "mediumNetInflowPercent": -2.8,
        "smallNetInflow": -590000000,
        "smallNetInflowPercent": -5.4
      }
    ]
  }
}
```

**响应字段说明**

| 字段                         | 说明                                  |
| ---------------------------- | ------------------------------------- |
| rank                         | 排名（与上游返回顺序一致）            |
| code / name / price          | 代码 / 名称 / 最新价                  |
| changePercent                | 涨跌幅(%)，**对应排名周期**（非单日） |
| mainNetInflow(Percent)       | 主力净流入净额(元) / 净占比(%)        |
| superLargeNetInflow(Percent) | 超大单净额 / 净占比                   |
| largeNetInflow(Percent)      | 大单净额 / 净占比                     |
| mediumNetInflow(Percent)     | 中单净额 / 净占比                     |
| smallNetInflow(Percent)      | 小单净额 / 净占比                     |

> 数值字段可能为 `null`（上游对部分标的返回空值）。
>
> 与板块接口不同，**查询强制分页**——单日数据为全市场个股（数千条），
> 直接返回整批会造成数百 KB 的响应。`total` 为该批次总数，不受分页影响。
>
> 数据**保留最近一个月**，每个交易日一批。

**示例**

```bash
# 最近一批（前 50 名）
curl "http://localhost:3001/api/stock-sdk/fund-flows" \
  -H "Authorization: Bearer <access_token>"

# 指定交易日，取第 2 页
curl "http://localhost:3001/api/stock-sdk/fund-flows?date=2026-09-14&page=2&pageSize=100" \
  -H "Authorization: Bearer <access_token>"
```

---

## 手动触发大盘资金流采集

大盘资金流由定时任务每天 **16:30（北京时间，A 股收盘后）** 自动采集。此接口用于首次初始化或补跑。

**请求**

```
POST /api/stock-sdk/market-flows/sync
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数   | 类型    | 必填 | 说明         |
| ------ | ------- | ---- | ------------ |
| dryRun | boolean | 否   | 只取数不落库 |

> 无需指定日期——上游返回的是**按日历史序列**，日期取自数据本身。

**响应**

```json
{
  "code": 200,
  "message": "执行完成",
  "data": {
    "upstreamTotal": 1250,
    "inRetention": 22,
    "inserted": 1,
    "purged": 1,
    "persisted": true,
    "durationMs": 860
  }
}
```

> `upstreamTotal` 是上游返回的总条数（含保留期之外的历史），`inRetention` 是保留期内的条数。
> 只写入保留期内的数据——更早的写入后也会被清理，没必要先写一遍。
> `inserted` 为本次新增（已存在的日期会跳过，历史值不会变动）。

**示例**

```bash
curl -X POST "http://localhost:3001/api/stock-sdk/market-flows/sync" \
  -H "Authorization: Bearer <access_token>"
```

---

## 查询大盘资金流

**请求**

```
GET /api/stock-sdk/market-flows
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**响应**

返回最近一个月的记录（按日期升序）；无数据时返回空数组。

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "tradeDate": "2026-09-14",
      "shClose": 3210.5,
      "shChangePercent": 0.68,
      "szClose": 10520.3,
      "szChangePercent": 0.92,
      "mainNetInflow": -5200000000,
      "mainNetInflowPercent": -1.24,
      "superLargeNetInflow": -3100000000,
      "superLargeNetInflowPercent": -0.74,
      "largeNetInflow": -2100000000,
      "largeNetInflowPercent": -0.5,
      "mediumNetInflow": 1100000000,
      "mediumNetInflowPercent": 0.26,
      "smallNetInflow": 4100000000,
      "smallNetInflowPercent": 0.98
    }
  ]
}
```

**响应字段说明**

| 字段                         | 说明                           |
| ---------------------------- | ------------------------------ |
| tradeDate                    | 数据日期（取自上游，非运行时） |
| shClose / shChangePercent    | 上证指数收盘价 / 涨跌幅(%)     |
| szClose / szChangePercent    | 深证指数收盘价 / 涨跌幅(%)     |
| mainNetInflow(Percent)       | 主力净流入净额(元) / 净占比(%) |
| superLargeNetInflow(Percent) | 超大单净额 / 净占比            |
| largeNetInflow(Percent)      | 大单净额 / 净占比              |
| mediumNetInflow(Percent)     | 中单净额 / 净占比              |
| smallNetInflow(Percent)      | 小单净额 / 净占比              |

> 数值字段可能为 `null`。数据**保留最近一个月**（每天一条，大盘为沪深合计口径）。
> 查询接口不需要分页——一个月约 20 个交易日。

**示例**

```bash
curl "http://localhost:3001/api/stock-sdk/market-flows" \
  -H "Authorization: Bearer <access_token>"
```
