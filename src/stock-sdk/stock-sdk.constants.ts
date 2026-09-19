/**
 * stock-sdk 契约常量
 *
 * 本模块通过 `stock-sdk`（npm 包，零依赖）请求东方财富/腾讯等公开数据源，
 * 与 TdxModule（通达信 TCP 协议）是**完全不同的数据源**，可用于交叉对照。
 */

/** 支持的市场（对应 stock-sdk 的 `sdk.codes.*`） */
export const SDK_MARKETS = ['cn', 'hk', 'us', 'fund'] as const
export type SdkMarket = (typeof SDK_MARKETS)[number]

/**
 * A 股市场的细分过滤（对应 stock-sdk 的 `AShareMarket`）
 *
 * 仅 `market=cn` 时有效：
 * - `sh` 上交所（6 开头，含科创板）、`sz` 深交所（0/3 开头，含创业板）
 * - `bj` 北交所（4/8 开头，含 920 新代码段）
 * - `kc` 科创板（688 开头）、`cy` 创业板（30 开头）
 */
export const SDK_A_SHARE_MARKETS = ['sh', 'sz', 'bj', 'kc', 'cy'] as const
export type SdkAShareMarket = (typeof SDK_A_SHARE_MARKETS)[number]

/**
 * 请求超时（毫秒）
 *
 * stock-sdk 走 HTTP 请求公开接口（非长连接），超时后由其内部重试策略处理；
 * 本模块只在最外层兜底，超时转 504。
 */
export const SDK_TIMEOUT_MS = 15_000
