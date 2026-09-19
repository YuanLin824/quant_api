/** 每日同步的 cron 表达式（6 字段含秒）：每天 16:00:00（收盘后一小时） */
export const STOCK_KLINE_SYNC_CRON = '0 0 16 * * *'

/** 定时任务名称 */
export const STOCK_KLINE_SYNC_JOB_NAME = 'stock-kline-sync'

/**
 * 定时任务时区——不可省：容器多为 UTC，
 * 不指定会与北京时间的「16:00」相差 8 小时
 */
export const STOCK_KLINE_TIMEZONE = 'Asia/Shanghai'

/**
 * 单次批量写入的行数
 *
 * 本表每行 7 个参数，1000 行即 7000 个参数，远低于 PostgreSQL 的 65535 上限。
 */
export const STOCK_KLINE_UPSERT_CHUNK = 1000

/** K 线周期（对应 `KLINE_CATEGORY_MAP` 的键） */
export const STOCK_KLINE_PERIOD = 'day' as const

/** 全量回补的年数 */
export const STOCK_KLINE_FULL_YEARS = 2

/**
 * 增量模式每次回拉的根数
 *
 * 多拉几根而非只拉 1 根：可自愈「前一日同步失败或漏跑」的情况，
 * 重复的交易日由 upsert 覆盖，无副作用。
 */
export const STOCK_KLINE_INCREMENTAL_BARS = 5

/**
 * 单次请求的最大根数
 *
 * 库内是 `Math.min(request.count, 800)` 的**硬编码**上限，超限会被**静默截断**
 * （不报错、不警告，只是少返回数据），故取值必须 ≤ 800，且要盯住返回条数。
 *
 * 近两年约 490 个交易日 < 800，所以一次请求即可覆盖全量目标。
 */
export const STOCK_KLINE_MAX_BARS_PER_REQUEST = 800

/** 价格与成交额的换算基准：上游以「厘」（元 × 1000）表示 */
export const PRICE_UNITS_PER_YUAN = 1000

/**
 * 实时查询的条数：默认 240，上限 1000
 *
 * 上游是 `westock` CLI（`--limit`），上限即它自己声明的 `KLINE_MAX_LIMIT`。
 * **但它同样会静默少返回**——实测同一个 `--limit 5000` 的请求只回了 2494 行，
 * HTTP 侧无任何限流提示；故 DTO 必须自己挡住越界值。
 */
export const STOCK_KLINE_QUERY_DEFAULT_LIMIT = 240
export const STOCK_KLINE_QUERY_MAX_LIMIT = 1000

/**
 * 实时查询的默认起始日期
 *
 * 调用方不传 `start` 时按此值补齐，等价于「取全部可得历史」。
 * 用 `--start` 单独限定是安全的——CLI 只在 `--start` 与 `--end` **同时给**时才校验跨度。
 */
export const STOCK_KLINE_QUERY_DEFAULT_START = '1990-07-31'

/**
 * 相邻两次 K 线请求的间隔（毫秒）
 *
 * 上游是**公开的行情服务器**（非授权的商业接口），按 1 秒/只的节奏串行拉取，
 * 避免高频请求给服务器造成压力或被限流。
 *
 * ⚠️ 代价是耗时显著：全市场约 5400 只 → **约 90 分钟**（不加间隔时约 2 分钟）。
 * 每日盘后运行的增量任务同样要遍历全市场，故每次都会跑满这个时长。
 */
export const STOCK_KLINE_REQUEST_INTERVAL_MS = 1000

/** 失败明细在返回体中最多保留的条数（避免响应体过大） */
export const STOCK_KLINE_MAX_REPORTED_ERRORS = 20
