/** 股票市场类型 */
export enum Market {
  /** A股 */
  CN = 'cn',
  /** 港股 */
  HK = 'hk',
  /** 美股 */
  US = 'us',
}

/** 代码列表市场类型 */
export enum CodesMarket {
  /** A股 */
  CN = 'cn',
  /** 港股 */
  HK = 'hk',
  /** 美股 */
  US = 'us',
  /** 基金 */
  FUND = 'fund',
}

/** K线请求选项 */
export interface KlineRequestOptions {
  /** K线周期 (daily/weekly/monthly 或 1/5/15/30/60) */
  period?: string
  /** 复权类型 (qfq/hfq/空字符串) */
  adjust?: string
  /** 开始日期 */
  startDate?: string
  /** 结束日期 */
  endDate?: string
  /** 指标配置 */
  indicators?: Record<string, any>
  /** 市场类型 ('A' / 'HK' / 'US') */
  market?: 'A' | 'HK' | 'US'
}

/** K线信号请求选项 */
export interface KlineSignalsRequestOptions extends KlineRequestOptions {
  /** MA 快线周期 */
  maFast?: number
  /** MA 慢线周期 */
  maSlow?: number
}
