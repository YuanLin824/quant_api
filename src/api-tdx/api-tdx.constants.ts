/**
 * 通达信客户端注入令牌
 *
 * 与 Redis 的 `REDIS_CLIENT` 同范式：用 Symbol 作 token，避免字符串命名冲突。
 */
export const TDX_CLIENT = Symbol('TDX_CLIENT')

/** 支持的交易所后缀（thscode 中 `.` 之后的部分） */
export const TDX_EXCHANGE_SUFFIXES = ['SH', 'SZ', 'BJ'] as const

/**
 * 对外暴露的 K 线周期
 *
 * 刻意**不透传库的 `KlineCategory` 枚举**：那是底层实现的细节（其中有 `Day2`、`Minute1Alt`
 * 这类语义重复的成员），模块的价值之一就是隔离它——调用方只认这一套字符串枚举。
 */
export const TDX_KLINE_CATEGORIES = [
  '1m',
  '5m',
  '15m',
  '30m',
  '60m',
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const

/** K 线周期类型 */
export type TdxKlineCategory = (typeof TDX_KLINE_CATEGORIES)[number]

/** 单次请求的 K 线根数上限（上游限制，超出会被拒或截断） */
export const TDX_KLINE_MAX_COUNT = 800

/** 单次请求的 K 线根数默认值 */
export const TDX_KLINE_DEFAULT_COUNT = 100
