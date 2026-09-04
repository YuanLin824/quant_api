# Stock API 接口

[← 返回目录](./index.md)

> 所有 Stock API 接口需要 JWT 认证，请在请求头中携带 `Authorization: Bearer <access_token>`
>
> 使用 stock-api 库，自动从腾讯/新浪/东方财富获取数据

## 获取单只股票行情

获取指定股票的实时行情数据。

**请求**

```
GET /api/stock-api/quote/:market/:code
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                                        |
| ------ | ------ | ---- | ----------------------------------------------------------- |
| market | string | 是   | 市场类型: `SH`(上海) / `SZ`(深圳) / `HK`(港股) / `US`(美股) |
| code   | string | 是   | 股票代码                                                    |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "code": "SH600519",
    "name": "贵州茅台",
    "now": 1800.0,
    "percent": 0.0115,
    "low": 1780.0,
    "high": 1810.0,
    "yesterday": 1779.5,
    "source": "tencent"
  }
}
```

**示例**

```bash
# 获取A股贵州茅台行情
curl http://localhost:3001/api/stock-api/quote/SH/600519 \
  -H "Authorization: Bearer <access_token>"

# 获取港股腾讯行情
curl http://localhost:3001/api/stock-api/quote/HK/00700 \
  -H "Authorization: Bearer <access_token>"

# 获取美股苹果行情
curl http://localhost:3001/api/stock-api/quote/US/AAPL \
  -H "Authorization: Bearer <access_token>"
```

---

## 批量获取股票行情

批量获取多只股票的实时行情数据。

**请求**

```
POST /api/stock-api/quotes
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数  | 类型     | 必填 | 说明             |
| ----- | -------- | ---- | ---------------- |
| codes | string[] | 是   | 完整股票代码数组 |

**请求示例**

```json
{
  "codes": ["SH600519", "SZ000651", "HK00700"]
}
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "code": "SH600519",
      "name": "贵州茅台",
      "now": 1800.0,
      "percent": 0.0115,
      "low": 1780.0,
      "high": 1810.0,
      "yesterday": 1779.5,
      "source": "tencent"
    }
  ]
}
```

---

## 获取K线数据

获取指定股票的K线数据。

**请求**

```
GET /api/stock-api/kline/:market/:code
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                |
| ------ | ------ | ---- | ----------------------------------- |
| market | string | 是   | 市场类型: `SH` / `SZ` / `HK` / `US` |
| code   | string | 是   | 股票代码                            |

**查询参数**

| 参数   | 类型   | 必填 | 说明                                                         |
| ------ | ------ | ---- | ------------------------------------------------------------ |
| period | string | 否   | K线周期: `day`(日K) / `week`(周K) / `month`(月K)，默认 `day` |
| count  | number | 否   | 返回数量，默认 120                                           |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "date": "2024-01-01",
      "open": 1785.0,
      "close": 1800.0,
      "high": 1810.0,
      "low": 1780.0,
      "volume": 12345678,
      "source": "tencent"
    }
  ]
}
```

**示例**

```bash
# 获取A股贵州茅台日K线
curl http://localhost:3001/api/stock-api/kline/SH/600519?period=day&count=30 \
  -H "Authorization: Bearer <access_token>"

# 获取港股腾讯周K线
curl http://localhost:3001/api/stock-api/kline/HK/00700?period=week \
  -H "Authorization: Bearer <access_token>"
```

---

## 搜索股票

根据关键词搜索股票。

**请求**

```
GET /api/stock-api/search
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

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "code": "SH600519",
      "name": "贵州茅台",
      "now": 1800.0,
      "percent": 0.0115,
      "low": 1780.0,
      "high": 1810.0,
      "yesterday": 1779.5,
      "source": "tencent"
    }
  ]
}
```

**示例**

```bash
# 搜索茅台
curl http://localhost:3001/api/stock-api/search?keyword=茅台 \
  -H "Authorization: Bearer <access_token>"

# 搜索格力
curl http://localhost:3001/api/stock-api/search?keyword=格力电器 \
  -H "Authorization: Bearer <access_token>"
```
