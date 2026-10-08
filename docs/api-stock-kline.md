# 股票 K 线

[← 返回目录](../API.md)

> 接口需 `Authorization: Bearer <access_token>`。
>
> 限流走全局默认（每 60 秒 60 次）。本模块**刻意不提供手动触发同步接口**：
> 一轮全市场同步以十分钟计，HTTP 同步等待必然超时——数据由定时任务维护
> （日 K 每交易日 17:45、分钟 K 每交易日 19:00，均为 Asia/Shanghai）。

## 查询 K 线

按标的 + 周期 + 日期区间分页查询 K 线，按 `datetime` 升序返回。

**请求**

```
GET /api/stock-kline
```

**限流**: 全局默认（每 60 秒 60 次）

**查询参数**

| 参数     | 类型    | 必填 | 说明                                                               |
| -------- | ------- | ---- | ------------------------------------------------------------------ |
| thscode  | string  | 是   | 标的代码（如 `600519.SH`）                                         |
| category | string  | 否   | K 线周期：`day`（日 K，默认）/ `1m` / `5m` / `15m` / `30m` / `60m` |
| start    | string  | 否   | 起始日期，`yyyyMMdd`（含端点）；省略则不过滤该侧                   |
| end      | string  | 否   | 结束日期，`yyyyMMdd`（含端点）；省略则不过滤该侧                   |
| page     | integer | 否   | 页码，从 1 开始，默认 `1`                                          |
| pageSize | integer | 否   | 每页条数，默认 `500`，上限 `2000`（单只单日分钟线可 240+ 根）      |

**请求示例**

```
GET /api/stock-kline?thscode=600519.SH&category=day
Authorization: Bearer <access_token>
```

```
GET /api/stock-kline?thscode=600519.SH&category=5m&start=20261008&end=20261008
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 250,
    "page": 1,
    "pageSize": 500,
    "items": [
      {
        "thscode": "600519.SH",
        "category": "day",
        "datetime": "20261008",
        "openPrice": 1252.9,
        "highPrice": 1258,
        "lowPrice": 1242,
        "closePrice": 1255.79,
        "volume": 2516700,
        "amount": 3145413120,
        "syncAt": "2026-10-08T16:38:31.892Z"
      }
    ]
  }
}
```

| 字段                                                  | 类型   | 说明                                                                         |
| ----------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `datetime`                                            | string | 日 K 为 `yyyyMMdd`（8 位）；分钟 K 为 `yyyyMMddHHmm`（12 位，Asia/Shanghai） |
| `openPrice` / `highPrice` / `lowPrice` / `closePrice` | number | 开/高/低/收（元）                                                            |
| `volume`                                              | number | 成交量（股）——上游为「手」，落库前已 ×100 统一                               |
| `amount`                                              | number | 成交额（元）                                                                 |
| `syncAt`                                              | string | 该行的写入时间（值未变化的重复同步不会更新它）                               |

> **数据口径**
>
> - 日 K 与分钟 K **均来自通达信**（逐只 TCP，**不复权**，即原始价格）。
>   价格单位为元、成交量统一为股，可直接比较（实测同日日 K 成交量与 5m 汇总一致）。
> - **分钟 K 只保留最近 5 个交易日**（超出即清理）；日 K 只增不删、随交易日累积
>   （首次部署回补约 250 根，近 1 年）。
> - 日 K 与分钟 K 都是「重取整窗」维护的：日 K 每夜回取「距在库最新日期所需根数 + 余量」，
>   分钟 K 每夜重取最近 5 个交易日的窗口，均为幂等 upsert，上游更正会自动反映。
> - 新上市标的由下一次同步自动纳入回补，无需人工干预。

**错误响应**

- `400` - 请求参数校验失败（如 `category` 不在支持范围、`start` 非 `yyyyMMdd`、`pageSize` 超过 2000）
- `401` - 未携带令牌或令牌无效
