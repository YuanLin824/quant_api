import { resolve } from 'path'

/**
 * 腾讯 Go CLI（`westock`）的契约常量
 *
 * 这个 CLI 提供 **K 线**——另一个 CLI（`westock-data-clawhub`，见 `WestockDataService`）
 * 的 kline 不支持分钟周期：传 `m1`/`5m` 等会**静默回退到日线**，调用方会拿到错误粒度的数据。
 *
 * 集中存放「参数取值」与「输出格式」两类知识——CLI 升级时只需改本文件。
 * 以下形态均经实测确认（详见 WESTOCK_CLI.md）。
 */

/**
 * K 线周期（11 种）
 *
 * **命名易错**：是 `m1`/`m5`（前缀 m），不是 `1m`/`5m`——
 * 传错会返回 `不支持的 K 线周期`。
 */
export const KLINE_PERIODS = [
  'm1',
  'm5',
  'm15',
  'm30',
  'm60',
  'm120',
  'day',
  'week',
  'month',
  'season',
  'year',
] as const
export type KlinePeriod = (typeof KLINE_PERIODS)[number]
export const KLINE_DEFAULT_PERIOD: KlinePeriod = 'day'

/**
 * 复权方式
 *
 * `bfq` 实测**仅部分市场支持**：A 股（沪深）返回上游错误，港股正常。
 * 为与 CLI 的合法取值保持一致仍予暴露。
 */
export const KLINE_FQ_VALUES = ['qfq', 'hfq', 'bfq', 'nofq'] as const
export type KlineFq = (typeof KLINE_FQ_VALUES)[number]

/**
 * 返回条数：默认 240（约一个交易日的分钟数）
 *
 * 条数上限**不在本层设**——CLI 未声明上限，实际由调用方的 DTO 把关
 * （如 `stock-kline` 的 1–1000）。这里只定「不传时给多少」。
 *
 * 无论取多少都**拉不满全量历史**：上游数据源起点约 2006 年（连 1991 年上市的
 * sz000001 最早也只到 2006-03-08），全量约 4900 个交易日。
 * 1000 根折合约：日线 4.1 年、m5 3.5 个交易日、m1 1.7 个交易日；
 * 需要更长历史时改用 `--start`/`--end` 分段取。
 */
export const KLINE_DEFAULT_LIMIT = 240

/** 日期参数格式（`--start` / `--end`） */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * kline 表格列名 → 消费方字段名的映射（实测，顺序固定）
 *
 * 实测列序：`date | open | last | high | low | volume | amount | exchange | change_pct`。
 * 两点易错：
 * - **收盘价的列名是 `last` 而非 `close`**——按 `close` 取值只会静默拿到 `undefined`
 * - `date` 列在**分钟周期**下带时分秒（`2026-09-18 15:00:00`），日线及以上只有日期
 *
 * `exchange`（换手率）与 `change_pct`（涨跌幅）不在本映射内，由调用方按需取用。
 */
export const KLINE_COLUMN_MAP = {
  time: 'date',
  open: 'open',
  high: 'high',
  low: 'low',
  close: 'last',
  volume: 'volume',
  amount: 'amount',
} as const

/**
 * 分钟周期的日期跨度上限（天）
 *
 * 实测：跨度超过 5 天时 CLI 报「分钟K线（m1）查询日期跨度不能超过 5 天」。
 * 注意 help 写的是「近 1 个月内」，与实际不符——实际按**跨度**判定。
 */
export const KLINE_MINUTE_MAX_SPAN_DAYS = 5

/**
 * `search` 的类型（CLI 的 `--type`，**可逗号分隔多值**）
 *
 * 不传时 CLI **默认仅搜股票**（排除 ETF/可转债）。多类型时输出会**按类型分段**，
 * 故解析要用 `section-parser` 而非扁平解析器。
 */
export const SEARCH_TYPES = ['stock', 'etf', 'bond', 'sector', 'index', 'futures', 'forex'] as const
export type SearchType = (typeof SEARCH_TYPES)[number]

/**
 * `search` 的市场（CLI 的 `--market`）
 *
 * ⚠️ `jp`/`kr` 是**日韩股专用接口**，与 `--type` **互斥**（CLI 限制），
 * 组合使用会报错——这一条由 DTO 与 service 各自把关。
 */
export const SEARCH_MARKETS = ['hs', 'bj', 'hk', 'us', 'jp', 'kr'] as const
export type SearchMarket = (typeof SEARCH_MARKETS)[number]

/** 搜索返回条数：CLI 不传时默认 10（实测） */
export const SEARCH_DEFAULT_LIMIT = 10

/**
 * 单次搜索的条数上限
 *
 * CLI 自身**未声明**上限（实测 `--limit 1000` 可全量返回），此值是本模块为控制
 * 响应体量、降低触发上游限流的概率而自设的。
 */
export const SEARCH_MAX_LIMIT = 100

/**
 * Go CLI 二进制路径
 *
 * Windows 为 `westock.exe`，Unix 无扩展名。两者都由 `src/scripts/setup.*` 下载，
 * 且都被 .gitignore 排除（不入库），缺失时执行 `npm run setup:westock` 获取。
 */
export const GO_CLI_BIN_PATH = resolve(
  __dirname,
  '../scripts',
  process.platform === 'win32' ? 'westock.exe' : 'westock'
)
