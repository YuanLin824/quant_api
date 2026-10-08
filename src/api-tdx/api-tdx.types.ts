/**
 * 单根 K 线
 *
 * 上游 `node-tdx-market` 的 `KlineBar` 中价格是「厘」（元 × 1000 的整数），
 * 本类型**价格字段已换算为元**——调用方拿到的就是可直接使用的价格。
 */
export interface TdxKlineBar {
  /** K 线时间（分钟线为该根起始时刻，日线为当日） */
  time: Date
  /** 开盘价（元） */
  open: number
  /** 最高价（元） */
  high: number
  /** 最低价（元） */
  low: number
  /** 收盘价（元） */
  close: number
  /** 成交量（单位「手」，上游已是可读量级，不做换算） */
  volume: number
  /** 成交额（元，与价格同为「厘」的上游值已换算） */
  amount: number
}
