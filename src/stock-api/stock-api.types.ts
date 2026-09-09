/** 股票市场类型 */
export enum Market {
  /** 上海交易所 */
  SH = 'SH',
  /** 深圳交易所 */
  SZ = 'SZ',
  /** 香港市场 */
  HK = 'HK',
  /** 美国市场 */
  US = 'US',
}

/** K线周期 */
export enum KlinePeriod {
  /** 日K */
  DAY = 'day',
  /** 周K */
  WEEK = 'week',
  /** 月K */
  MONTH = 'month',
}

/** 数据源 */
export type StockSource = 'base' | 'eastmoney' | 'sina' | 'tencent'

/** 股票行情（与 stock-api 库 Stock 类型一致） */
export interface Stock {
  /** 股票名称 */
  name: string
  /** 标准化股票代码（如 SH510500, SZ000651） */
  code: string
  /** 当前价格 */
  now: number
  /** 最低价 */
  low: number
  /** 最高价 */
  high: number
  /** 涨跌幅（0.01 = 1%） */
  percent: number
  /** 昨收价 */
  yesterday: number
  /** 数据源 */
  source?: StockSource
}

/** K线数据（与 stock-api 库 Kline 类型一致） */
export interface Kline {
  /** 日期（如 2026-05-22） */
  date: string
  /** 开盘价 */
  open: number
  /** 收盘价 */
  close: number
  /** 最高价 */
  high: number
  /** 最低价 */
  low: number
  /** 成交量（上游提供时） */
  volume?: number
  /** 数据源 */
  source?: Exclude<StockSource, 'base'>
}
