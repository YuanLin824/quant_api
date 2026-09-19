/**
 * K 线周期 → node-tdx-market 的 KlineCategory
 *
 * 不直接引用库的 `KlineCategory`：它是 `declare const enum`，
 * 在 tsconfig 的 `isolatedModules: true` 下无法在值位置使用。
 *
 * 本模块**只用到日线**（`StockKlineService` 的落库同步），其余键是数值映射表的
 * 完整形态，保留以便需要时取用——毕竟这张表的价值就是「库的枚举常量用不了」的替身。
 */
export const KLINE_CATEGORY_MAP = {
  '1m': 7, // Minute1
  '5m': 0, // Minute5
  '15m': 1,
  '30m': 2,
  '60m': 3,
  day: 9, // Day
  week: 5,
  month: 6,
} as const

/** K 线周期取值 */
export type KlinePeriodKey = keyof typeof KLINE_CATEGORY_MAP
