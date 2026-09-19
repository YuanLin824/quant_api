/**
 * K 线周期：接口层取值 → node-tdx-market 的 KlineCategory
 *
 * 不直接引用库的 `KlineCategory`：它是 `declare const enum`，
 * 在 tsconfig 的 `isolatedModules: true` 下无法在值位置使用。
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

/** 接口层的 K 线周期取值 */
export type KlinePeriodKey = keyof typeof KLINE_CATEGORY_MAP

/** 可选的 K 线周期列表（供 DTO 校验） */
export const KLINE_PERIODS = Object.keys(KLINE_CATEGORY_MAP)

/** K 线默认周期 */
export const DEFAULT_KLINE_PERIOD: KlinePeriodKey = 'day'

/**
 * 分钟级周期
 *
 * 与日线级有两点不同（都在库内按 `MINUTE_KLINE_CATEGORIES` 分支处理）：
 * - **时间含时分**（`decodeMinuteTime`），日线级则固定为当日 15:00（`decodeDayTime`）
 * - **成交量口径不同**：库对分钟级做了 `÷100`，日线级不做
 */
export const MINUTE_PERIODS: readonly KlinePeriodKey[] = ['1m', '5m', '15m', '30m', '60m']

/** 是否分钟级周期 */
export function isMinutePeriod(period: KlinePeriodKey): boolean {
  return MINUTE_PERIODS.includes(period)
}

/** K 线数量上限（库限制） */
export const KLINE_MAX_COUNT = 800

/**
 * 交易所：接口层取值 → node-tdx-market 的 Exchange 枚举
 *
 * 用字符串而非数字：`Exchange` 的取值是 0/1/2，直接暴露给调用方不直观。
 */
export const EXCHANGE_MAP = {
  sz: 0, // Exchange.SZ
  sh: 1, // Exchange.SH
  bj: 2, // Exchange.BJ
} as const

/** 接口层的交易所取值 */
export type ExchangeKey = keyof typeof EXCHANGE_MAP

/** 可选的交易所列表（供 DTO 校验） */
export const EXCHANGES = Object.keys(EXCHANGE_MAP)
