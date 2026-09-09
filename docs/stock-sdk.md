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

| 字段     | 说明                                               |
| -------- | -------------------------------------------------- |
| code     | 代码（带市场前缀，如 `sh600519`）                  |
| name     | 名称                                               |
| market   | 市场标识（如 `sh`/`sz`/`hk`/`us`）                 |
| type     | 上游原始资产类型（如 `GP-A`/`ZS`/`JJ`）            |
| category | 标准化资产分类（`stock`/`index`/`fund`），可选字段 |

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

## 获取历史K线数据

获取指定股票的历史K线数据。

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

| 参数      | 类型   | 必填 | 说明                                                                   |
| --------- | ------ | ---- | ---------------------------------------------------------------------- |
| period    | string | 否   | K线周期: `daily`(日K) / `weekly`(周K) / `monthly`(月K)，默认 `daily`   |
| adjust    | string | 否   | 复权类型: `qfq`(前复权) / `hfq`(后复权) / 空字符串(不复权)，默认 `qfq` |
| startDate | string | 否   | 开始日期 (YYYYMMDD)                                                    |
| endDate   | string | 否   | 结束日期 (YYYYMMDD)                                                    |

**响应**

返回 stock-sdk 原始格式的 K 线数组。

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

# 获取指定日期范围的K线
curl http://localhost:3001/api/stock-sdk/kline/cn/600519?startDate=20240101&endDate=20240131 \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取分钟K线数据

获取指定股票的分钟K线数据。

**请求**

```
GET /api/stock-sdk/kline/:market/:code/minute
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

| 参数      | 类型   | 必填 | 说明                                                                   |
| --------- | ------ | ---- | ---------------------------------------------------------------------- |
| period    | string | 否   | 分钟K线周期: `1` / `5` / `15` / `30` / `60`，默认 `1`                  |
| adjust    | string | 否   | 复权类型: `qfq`(前复权) / `hfq`(后复权) / 空字符串(不复权)，默认 `qfq` |
| startDate | string | 否   | 开始日期                                                               |
| endDate   | string | 否   | 结束日期                                                               |

**响应**

返回 stock-sdk 原始格式的分钟 K 线数组。

**示例**

```bash
# 获取A股5分钟K线
curl http://localhost:3001/api/stock-sdk/kline/cn/600519/minute?period=5 \
  -H "Authorization: Bearer <access_token>"

# 获取港股15分钟K线
curl http://localhost:3001/api/stock-sdk/kline/hk/00700/minute?period=15 \
  -H "Authorization: Bearer <access_token>"

# 获取美股60分钟K线
curl http://localhost:3001/api/stock-sdk/kline/us/AAPL/minute?period=60 \
  -H "Authorization: Bearer <access_token>"
```

---

## 获取带技术指标的K线数据

获取指定股票的K线数据，并附加技术指标计算结果。

**请求**

```
GET /api/stock-sdk/kline/:market/:code/indicators
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

| 参数       | 类型   | 必填 | 说明                                                                   |
| ---------- | ------ | ---- | ---------------------------------------------------------------------- |
| period     | string | 否   | K线周期: `daily`(日K) / `weekly`(周K) / `monthly`(月K)，默认 `daily`   |
| adjust     | string | 否   | 复权类型: `qfq`(前复权) / `hfq`(后复权) / 空字符串(不复权)，默认 `qfq` |
| startDate  | string | 否   | 开始日期 (YYYYMMDD 或 YYYY-MM-DD)                                      |
| endDate    | string | 否   | 结束日期 (YYYYMMDD 或 YYYY-MM-DD)                                      |
| indicators | object | 否   | 指标配置 JSON 对象                                                     |

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

返回 stock-sdk 原始格式的带指标 K 线数组。

**示例**

```bash
# 获取带 MA 均线的K线
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519/indicators?period=daily&indicators=%7B%22ma%22%3A%5B5%2C10%2C20%5D%7D" \
  -H "Authorization: Bearer <access_token>"

# 获取带 MACD 和 KDJ 的K线
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519/indicators?indicators=%7B%22macd%22%3Atrue%2C%22kdj%22%3Atrue%7D" \
  -H "Authorization: Bearer <access_token>"

# 获取带多个指标的K线
curl "http://localhost:3001/api/stock-sdk/kline/cn/600519/indicators?indicators=%7B%22ma%22%3A%5B5%2C10%2C20%5D%2C%22macd%22%3Atrue%2C%22boll%22%3Atrue%2C%22rsi%22%3Atrue%7D" \
  -H "Authorization: Bearer <access_token>"
```

**indicators JSON 示例**

```json
{
  "ma": [5, 10, 20],
  "macd": true,
  "boll": true,
  "kdj": true,
  "rsi": true
}
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

返回 stock-sdk 原始格式的大单数据数组。

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

返回代码字符串数组。

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

返回 K 线信号数组，每个信号包含：

- `type` - 信号类型（MA/MACD/KDJ 金叉死叉、超买超卖等）
- `date` - 信号日期
- `timestamp` - 时间戳
- `close` - 收盘价
- `detail` - 附加信息

**示例**

```bash
# 获取K线信号
curl http://localhost:3001/api/stock-sdk/kline/cn/600519/signals?period=daily&maFast=5&maSlow=20 \
  -H "Authorization: Bearer <access_token>"
```
