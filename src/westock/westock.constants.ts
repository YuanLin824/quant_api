import { resolve } from 'path'

/**
 * WeStock 契约常量
 *
 * 本模块用到**两个**第三方 CLI，能力互补，无法只留其一：
 * - `westock-data-clawhub`（单文件 bundle）→ search、minute
 * - 腾讯 Go CLI（westock.exe）→ kline（clawhub 的 kline 不支持分钟周期，
 *   传 `m1`/`5m` 等会**静默回退到日线**，调用方会拿到错误粒度的数据）
 *
 * 集中存放「参数取值」与「输出格式」两类知识——CLI 升级时只需改本文件。
 * 以下形态均经实测确认（详见 docs/api/westock.md）。
 */

// ---------- 两个 CLI 共用 ----------

/** 入参长度上限 */
export const SEARCH_KEYWORD_MAX_LENGTH = 50
export const CODE_MAX_LENGTH = 20

/**
 * 关键词 / 代码的通用校验：不以 `-` 开头（否则会被 CLI 当作参数开关），且不含控制字符
 *
 * 用 `*` 而非 `+`——空串交给 DTO 的 `@IsNotEmpty` 负责，避免同一个空串
 * 同时触发两条校验、在 message 里并列报出（顺序还取决于装饰器注册顺序）。
 *
 * 控制字符用 Unicode 类别 `Cc` 表达而非 `0x00-0x1f` 范围——
 * 后者在部分编辑/写入链路中会被还原成真实的控制字节，把源文件变成二进制。
 */
export const TEXT_INPUT_PATTERN = /^(?!-)[^\p{Cc}]*$/u

/** 子进程超时：实测单次 400~600ms，取约 30 倍余量 */
export const CLI_TIMEOUT_MS = 15_000
/** stdout 缓冲上限：五日分时约 1300 行，留足余量 */
export const CLI_MAX_BUFFER = 8 * 1024 * 1024

/**
 * 无结果的提示文案（两个 CLI 的退出码均为 0，故只能按内容判定）
 *
 * 前两者实测来自 clawhub，`数据为空` 两个 CLI 通用。
 */
export const EMPTY_MESSAGES = ['数据为空', '无分时数据'] as const

/** clawhub 的失败提示前缀（Go CLI 用 `查询xxxK线失败：…` 等，靠「非表格」兜底判定） */
export const ERROR_PREFIX = '执行失败'

// ---------- westock-data-clawhub ----------

/**
 * 搜索范围
 *
 * CLI 另支持 `--sector`，但实测对所有关键词均**无任何输出**（退出码 0），
 * 功能实际不可用，故不对外暴露。
 */
export const SEARCH_SCOPES = ['stock', 'fund'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

/** 分时天数：1 = 当日，2~5 = 五日；实测传入大于 5 也只返回 5 天 */
export const MINUTE_DEFAULT_DAYS = 1
export const MINUTE_MAX_DAYS = 5

/**
 * clawhub 入口
 *
 * 这是 `westock-data-clawhub` 的**单文件 bundle**（包本身无依赖），已直接从
 * npm 包取出放入 `src/scripts/`，不再经 npm 安装——故用 `node <入口>` 调用，
 * 跨平台可靠（Windows 下 `.bin` 是 shell 脚本，execFile 无法直接执行）。
 *
 * 扩展名为 `.mjs` 是必需的：源文件是 ESM，而本项目 `package.json` 无 `type: module`，
 * 用 `.js` 会让 Node 先按 CommonJS 解析失败再回退重解析，既慢又喷 warning。
 */
export const CLAWHUB_ENTRY_PATH = resolve(__dirname, '../scripts/westock-data-clawhub.mjs')

// ---------- 腾讯 Go CLI（kline） ----------

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
 * 为与 CLI 的合法取值保持一致仍予暴露，文档已注明该限制。
 */
export const KLINE_FQ_VALUES = ['qfq', 'hfq', 'bfq', 'nofq'] as const
export type KlineFq = (typeof KLINE_FQ_VALUES)[number]

/**
 * 返回条数：默认 240（约一个交易日的分钟数），上限 1000
 *
 * 上限取值依据：控制单次响应体量、降低触发上游限流的概率。
 * 代价是**拉不满全量历史**——上游数据源起点约 2006 年（连 1991 年上市的
 * sz000001 最早也只到 2006-03-08），全量约 4900 个交易日
 * （sh600519 4926 行、sz000001 4851 行）。
 *
 * 1000 根折合：日线约 4.1 年，m5 约 3.5 个交易日，m1 约 1.7 个交易日。
 * 需要更长历史时改用 `--start`/`--end` 分段取，按日期切分多次请求。
 */
export const KLINE_DEFAULT_LIMIT = 240
export const KLINE_MAX_LIMIT = 1_000

/** 日期参数格式（`--start` / `--end`） */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 分钟周期的日期跨度上限（天）
 *
 * 实测：跨度超过 5 天时 CLI 报「分钟K线（m1）查询日期跨度不能超过 5 天」。
 * 注意 help 写的是「近 1 个月内」，与实际不符——实际按**跨度**判定。
 */
export const KLINE_MINUTE_MAX_SPAN_DAYS = 5

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
