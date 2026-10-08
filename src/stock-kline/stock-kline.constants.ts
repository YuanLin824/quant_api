/** 全部 K 线周期：日 K（同花顺）+ 五个分钟周期（通达信） */
export const STOCK_KLINE_CATEGORIES = ['day', '1m', '5m', '15m', '30m', '60m'] as const

/** K 线周期 */
export type StockKlineCategory = (typeof STOCK_KLINE_CATEGORIES)[number]

/** 分钟级周期集合（清理只作用于这些类别） */
export const STOCK_KLINE_MINUTE_CATEGORIES = ['1m', '5m', '15m', '30m', '60m'] as const

/** 分钟级周期 */
export type StockKlineMinuteCategory = (typeof STOCK_KLINE_MINUTE_CATEGORIES)[number]

/** 通达信取数窗口：start 为距最新一根的偏移，count 为根数 */
export interface StockKlineMinuteWindow {
  start: number
  count: number
}

/**
 * 每个分钟周期的取数窗口（每夜从最新倒推整窗重取，幂等 upsert）
 *
 * 窗口取「恰好 5 个交易日」＝保留窗口（见 `STOCK_KLINE_MINUTE_RETENTION_DAYS`）：
 * 每轮成功运行都会把保留窗**完整铺满**，因此无需额外余量即可自愈——漏跑一夜，
 * 下一轮取到的仍是完整 5 日；若有缺口也只可能落在保留窗之外，本就会被清理。
 * 刻意不加余量：多取的根数只会「当夜先写入、再被清理删掉」，是纯粹的无谓写入。
 *
 * 每日根数按 A 股交易时段推算（1m 240 = 09:31–11:30 + 13:01–15:00、5m 48、
 * 15m 16、30m 8、60m 4；其中 1m/5m/60m 已对上游实测确认）。
 *
 * - `1m`：单次请求上限 800 根 < 1200 根，故拆两个窗口：`[0, 800)` + `[800, 1200)`
 * - 其余周期单窗口即可覆盖：240 / 80 / 40 / 20 根
 */
export const STOCK_KLINE_MINUTE_WINDOWS: Record<
  StockKlineMinuteCategory,
  StockKlineMinuteWindow[]
> = {
  '1m': [
    { start: 0, count: 800 },
    { start: 800, count: 400 },
  ],
  '5m': [{ start: 0, count: 240 }],
  '15m': [{ start: 0, count: 80 }],
  '30m': [{ start: 0, count: 40 }],
  '60m': [{ start: 0, count: 20 }],
}

/**
 * 日 K 同步的 cron 表达式：每周一至周五 17:45
 *
 * 排在 17:30 的标的代码表同步之后——当夜新上市的标的会被立即纳入回补。
 * 周末上游不更新，故限定 1-5；法定节假日空跑一次，结果不变、无副作用。
 *
 * ⚠️ cron 表达式与时区必须是**模块常量**，不可改为读 `process.env`：
 * `@Cron` 在装饰器求值期（模块 import 时）取参，而 `.env` 要到 `ConfigModule.forRoot()`
 * 执行时才写入 `process.env`，用 `process.env.XXX` 会静默拿到 `undefined`。
 */
export const STOCK_KLINE_DAILY_SYNC_CRON = '45 17 * * 1-5'

/** 分钟 K 同步的 cron 表达式：每周一至周五 19:00（与日 K 错峰，避免两个长任务同时跑） */
export const STOCK_KLINE_MINUTE_SYNC_CRON = '0 19 * * 1-5'

/** K 线同步时区（cron 按此时区解释） */
export const STOCK_KLINE_SYNC_TIMEZONE = 'Asia/Shanghai'

/** 同步范围：只要在市 A 股（与标的代码表的 assetType 对齐，不含指数/板块） */
export const STOCK_KLINE_SCOPE_ASSET_TYPE = 'a-share'

/** 日 K 首次回补的根数：250 根 ≈ 近 1 年（A 股约 242 个交易日/年） */
export const STOCK_KLINE_DAILY_BACKFILL_COUNT = 250

/**
 * 日 K 增量回取的余量（根）
 *
 * 按「与在库最新日期的间隔」推算需回取的根数时额外加上的余量，
 * 吸收交易日换算的近似误差与长假期聚集。
 */
export const STOCK_KLINE_DAILY_REFRESH_MARGIN = 10

/**
 * 自然日 → 交易日的近似比例（5/7）
 *
 * A 股实际约 242/365 ≈ 0.66，5/7 ≈ 0.71 更保守（宁可多取几根），
 * 用于把「距上一根过去了多少自然日」折算成「需要回取多少根」。
 */
export const STOCK_KLINE_TRADING_DAY_RATIO = 5 / 7

/**
 * 批量 upsert 的分片大小
 *
 * TypeORM 的 `upsert` 内部**不自动分片**——它把整个数组拼成一条多行
 * `INSERT ... ON CONFLICT`，故分片是应用层责任（同 stock-symbols 的既有立场）。
 * 本模块单夜要写入数百万行，每行 9 列，按 1000 行一批提交（9000 个参数）留足余量。
 */
export const STOCK_KLINE_UPSERT_CHUNK_SIZE = 1000

/** 分钟 K 的保留窗口（交易日数）：超出即清理，语义由数据自身的日期决定（遇节假日自动正确） */
export const STOCK_KLINE_MINUTE_RETENTION_DAYS = 5

/**
 * 单轮同步的熔断阈值：连续 N 只标的失败且无一成功时中止本轮
 *
 * 该形态几乎只出现在「行情服务器整体不可达」时——继续按只重试只会空耗并刷满失败日志。
 * 个别标的失败（退市、停牌、上游无数据）是零星的，达不到「连续且零成功」，不会误触发。
 */
export const STOCK_KLINE_ABORT_AFTER_FAILURES = 20

/** 1 手 = 100 股：通达信各周期成交量的单位都是「手」，落库统一换算为股 */
export const STOCK_KLINE_SHARES_PER_LOT = 100

/** 查询接口默认每页条数（K 线单只单日可 240+ 根，页尺寸大于代码表的 20） */
export const STOCK_KLINE_QUERY_DEFAULT_PAGE_SIZE = 500

/** 查询接口每页条数上限 */
export const STOCK_KLINE_QUERY_MAX_PAGE_SIZE = 2000
