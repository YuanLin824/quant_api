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
