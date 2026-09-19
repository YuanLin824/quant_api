# node-tdx-market

**Node.js / TypeScript 实现的通达信（TDX）股票行情 TCP 协议客户端**

直连通达信公开行情服务器，免费、零鉴权，提供 A 股（端口 `7709`）与港股/美股/期货等扩展行情（端口 `7727`）的 K 线、五档盘口、分时、分笔成交、证券列表等数据。

---

## 📑 目录

- [特性](#-特性)
- [安装](#安装)
- [快速开始](#快速开始)
- [API](#api)

## ✨ 特性

- **行情数据**：K 线（多周期 + 历史）、五档盘口（批量）、当日/历史分时、当日/历史分笔成交
- **扩展行情**：港股/美股/期货/外汇等（TdxExHq 协议，端口 7727），支持市场列表、品种列表、五档、K 线、分时、分笔
- **证券列表**：沪深京全量证券列表与名称解析（自动分页）
- **连接管理**：自动测速选择最快服务器、心跳保活、断线自动重连（可关闭）
- **类型安全**：纯 TypeScript，二进制协议结构化解析，无第三方行情依赖

## 安装

```bash
npm install node-tdx-market
# 或
pnpm add node-tdx-market
```

> 包以编译后的 `dist` 发布（`main: ./dist/index.js`，自带类型声明），开箱即用，无需额外构建。

## 快速开始

```ts
import { TdxClient, KlineCategory } from 'node-tdx-market'

const client = new TdxClient({ autoReconnect: false })

// 没有 'error' 监听者时，socket 异常会让进程崩溃，务必监听
client.on('error', (err) => console.error(err))

await client.connect() // 自动选最快服务器

// K 线（日线，最近 10 根）
const kline = await client.getKline({
  code: 'sh600036',
  category: KlineCategory.Day,
  start: 0,
  count: 10,
})

// 五档盘口（支持批量）
const quotes = await client.getQuote(['sz000001', 'sh600036'])

// 分时 / 分笔
const minute = await client.getMinute('sh600036')
const trade = await client.getTrade('sh600036', 0, 100)

// 全量证券列表
import { Exchange } from 'node-tdx-market'
const list = await client.getStockList(Exchange.SH)

client.disconnect()
```

## API

所有数据方法都是 `TdxClient` 实例上的异步方法，调用前先 `await client.connect()`。

### 通用约定

- **股票代码**：字符串，带交易所前缀（`sh` / `sz` / `bj`）+ 6 位数字，如 `'sh600036'`；也可只传 6 位 `'600036'` 由库自动推断交易所（查指数请务必带前缀，如 `'sh000001'`）。
- **价格单位**：所有价格 / 成交额字段为 **`Price` = 厘（元 × 1000）的整数**，需要元时除以 1000 或用 `priceToYuan(v)`；成交量 `volume` 为原始值（手 / 股）。
- **交易所** `Exchange`：`SZ=0`、`SH=1`、`BJ=2`。
- **K 线周期** `KlineCategory`：`Minute5=0` `Minute15=1` `Minute30=2` `Minute60=3` `Day2=4` `Week=5` `Month=6` `Minute1=7` `Day=9` `Quarter=10` `Year=11`。

### 连接与生命周期

```ts
import { TdxClient } from 'node-tdx-market'

const client = new TdxClient() // 不传 host 则自动测速选最快服务器
client.on('error', (e) => console.error(e)) // 必须监听，否则 socket 异常会让进程崩溃

await client.connect() // 连接，resolve 返回实际服务器地址
// ...调用下面的数据方法...
client.disconnect() // 断开（之后可再次 connect）
client.destroy() // 销毁（不可复用）
```

事件：`connected` / `disconnected` / `reconnecting` / `message` / `error`。

### `getKline(req)` — K 线

```ts
import { KlineCategory } from 'node-tdx-market'

const { count, bars } = await client.getKline({
  code: 'sh600036',
  category: KlineCategory.Day, // 周期
  start: 0, // 偏移，0 = 最新
  count: 10, // 数量，最大 800
})
// bars: { time: Date; open; high; low; close; volume; amount }[]
```

### `getQuote(codes)` — 五档盘口（支持批量）

```ts
const quotes = await client.getQuote(['sh600036', 'sz000001']) // string | string[]
// quotes: {
//   exchange; code; price; open; high; low; lastClose; volume; amount;
//   bid: { price; volume }[]; ask: { price; volume }[];
// }[]
```

### `getMinute(code)` — 当日分时

```ts
const { count, items } = await client.getMinute('sh600036')
// items: { time: '0931'; price; avgPrice; volume }[]
```

### `getHistoryMinute(code, date)` — 历史分时

```ts
const { items } = await client.getHistoryMinute('sh600036', 20240105) // date: YYYYMMDD
```

### `getTrade(code, start?, count?)` — 当日分笔成交

```ts
const { count, items } = await client.getTrade('sh600036', 0, 100)
// items: { time: '0931'; price; volume; direction }[]  direction: 0 买 / 1 卖 / 2 中性
```

### `getHistoryTrade(code, date, start?, count?)` — 历史分笔成交

```ts
const { items } = await client.getHistoryTrade('sh600036', 20240105, 0, 100)
```

### `getStockCount(exchange)` — 证券数量

```ts
import { Exchange } from 'node-tdx-market'

const n = await client.getStockCount(Exchange.SH) // number
```

### `getStockList(exchange)` — 全量证券列表（自动分页）

```ts
import { Exchange } from 'node-tdx-market'

const list = await client.getStockList(Exchange.SH)
// list: { exchange; code; fullCode: 'sh600036'; name; volUnit; decimalPoint }[]
```

## 扩展行情（ExHq）— 港股 / 美股 / 期货

扩展行情走独立协议（TdxExHq），连接端口 `7727` 的服务器，使用 `TdxExHqClient` 类。与 A 股 `TdxClient` 并列但**不可混用**（帧前缀、握手、心跳均不同）。

### 连接与生命周期

```ts
import { TdxExHqClient, ExhqMarket } from 'node-tdx-market'

const exClient = new TdxExHqClient({ autoReconnect: false })
exClient.on('error', (e) => console.error(e)) // 必须监听

await exClient.connect() // 自动测速选最快的 ExHq 服务器
```

事件：`connected` / `disconnected` / `reconnecting` / `message` / `error`。

### 通用约定

- **市场编号**：由 `getMarkets()` 返回动态列表，已知值如 `ExhqMarket.HK=31`（港股主）、`ExhqMarket.HKAlt=48`（港股备）。
- **代码**：字符串，不带前缀，如 `'00700'`（腾讯控股），直接传 `market + code`。
- **价格单位**：扩展行情价格为 **float（元）**，非 A 股的厘整数。
- **K 线周期**：与标准行情 `KlineCategory` 相同（`0`=5分钟, `9`=日线 等）。

### `getMarkets()` — 市场代码表

```ts
const markets = await exClient.getMarkets()
// markets: { market; category; name; shortName }[]
```

### `getCount()` — 品种数量

```ts
const n = await exClient.getCount() // number
```

### `getInstruments(start, count)` — 品种列表（分页）

```ts
const instruments = await exClient.getInstruments(0, 100)
// instruments: { category; market; code; name; desc }[]
```

### `getAllInstruments()` — 全量品种列表（自动分页）

```ts
const all = await exClient.getAllInstruments()
```

### `getQuote(market, code)` — 单品种五档行情

```ts
const quote = await exClient.getQuote(31, '00700') // 港股腾讯
// quote: { market; code; preClose; open; high; low; price;
//   bid[5]; bidVol[5]; ask[5]; askVol[5]; ... }
```

### `getBars(req)` — K 线

```ts
import { KlineCategory } from 'node-tdx-market'

const bars = await exClient.getBars({
  market: 31,
  code: '00700',
  category: KlineCategory.Day,
  start: 0,
  count: 10,
})
// bars: { datetime; open; high; low; close; position; trade; price; amount }[]
```

### `getMinute(market, code)` — 当日分时

```ts
const ticks = await exClient.getMinute(31, '00700')
// ticks: { hour; minute; price; avgPrice; volume; openInterest }[]
```

### `getHistoryMinute(market, code, date)` — 历史分时

```ts
const ticks = await exClient.getHistoryMinute(31, '00700', 20240105)
```

### `getTrade(market, code, start, count)` — 当日分笔成交

```ts
const trades = await exClient.getTrade(31, '00700', 0, 100)
// trades: { hour; minute; second; price; volume; zengCang; nature; natureName; direction }[]
```

### `getHistoryTrade(market, code, date, start, count)` — 历史分笔成交

```ts
const trades = await exClient.getHistoryTrade(31, '00700', 20240105, 0, 100)
```

### `getBarsRange(market, code, date, date2)` — 历史 K 线区间

```ts
const bars = await exClient.getBarsRange(31, '00700', 20240101, 20240110)
```

### `getQuoteList(market, category, start, count)` — 批量行情列表

```ts
// category: 2=港股, 3=期货
const list = await exClient.getQuoteList(31, 2, 0, 100)
```
