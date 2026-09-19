/**
 * symbols 契约常量
 *
 * 数据源为 `stock-sdk`（HTTP 公开数据源，见 `StockSdkService`），
 * 与 TdxModule 的通达信 TCP 协议无关。
 */

/** 每日全量同步的 cron 表达式（6 字段含秒）：每天 08:00:00（开盘前） */
export const STOCK_SYMBOLS_SYNC_CRON = '0 0 8 * * *'

/** 定时任务名称 */
export const STOCK_SYMBOLS_SYNC_JOB_NAME = 'stock-symbols-sync'

/**
 * 定时任务时区——不可省：容器多为 UTC，
 * 不指定会与北京时间的「早上 8 点」相差 8 小时
 */
export const STOCK_SYMBOLS_TIMEZONE = 'Asia/Shanghai'

/**
 * 单次批量写入的行数
 *
 * 本表每行 3 个参数（market / code / id 由数据库生成），1000 行远低于
 * PostgreSQL 单语句 65535 个参数的上限。
 */
export const STOCK_SYMBOLS_UPSERT_CHUNK = 1000

/**
 * 存储用的市场键
 *
 * 与 `stock-sdk` 的市场标识一致：
 * - A 股是**一个整体**（交易所前缀已编码在代码里，如 `sh600036` / `sz000001` / `bj430047`）
 * - 基金是纯数字代码（`005827`），**不带前缀**——与 A 股的场外基金代码同形
 */
export const SYMBOL_MARKETS = ['cn', 'hk', 'us', 'fund'] as const
export type StockSymbolMarket = (typeof SYMBOL_MARKETS)[number]
