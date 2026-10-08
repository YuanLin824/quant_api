/**
 * 通达信客户端注入令牌
 *
 * 与 Redis 的 `REDIS_CLIENT` 同范式：用 Symbol 作 token，避免字符串命名冲突。
 */
export const TDX_CLIENT = Symbol('TDX_CLIENT')

/** 支持的交易所后缀（thscode 中 `.` 之后的部分） */
export const TDX_EXCHANGE_SUFFIXES = ['SH', 'SZ', 'BJ'] as const
