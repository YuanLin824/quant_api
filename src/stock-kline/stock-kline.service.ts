import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { KlineBar } from 'node-tdx-market'
import { Repository } from 'typeorm'
import type { TableRow } from '../common/cli/cli.types'
import { StockSymbol } from '../stock-symbols/entities/stock-symbol.entity'
import type { StockSymbolMarket } from '../stock-symbols/stock-symbols.constants'
import { TdxService } from '../tdx/tdx.service'
import {
  KLINE_COLUMN_MAP,
  KLINE_DEFAULT_PERIOD,
  type KlineFq,
  type KlinePeriod,
} from '../westock-cli/westock-cli.constants'
import { WestockCliService } from '../westock-cli/westock-cli.service'
import { DailyKline } from './entities/daily-kline.entity'
import {
  PRICE_UNITS_PER_YUAN,
  STOCK_KLINE_FULL_YEARS,
  STOCK_KLINE_INCREMENTAL_BARS,
  STOCK_KLINE_MAX_BARS_PER_REQUEST,
  STOCK_KLINE_MAX_REPORTED_ERRORS,
  STOCK_KLINE_PERIOD,
  STOCK_KLINE_QUERY_DEFAULT_LIMIT,
  STOCK_KLINE_QUERY_DEFAULT_START,
  STOCK_KLINE_QUERY_MAX_LIMIT,
  STOCK_KLINE_REQUEST_INTERVAL_MS,
  STOCK_KLINE_UPSERT_CHUNK,
} from './stock-kline.constants'

/** 同步模式 */
export type StockKlineSyncMode = 'full' | 'incremental'

/**
 * A 股市场键（代码取自 `stock_symbols` 表）
 *
 * `stock-sdk` 把 A 股视作**一个整体**，交易所前缀已编码在代码里（`sh600036`），
 * 故这里只有 `cn` 一个值。
 */
const A_SHARE_MARKET: StockSymbolMarket = 'cn'

/** K 线的响应行（数值一律为字符串，避免经 JS number 丢精度） */
export interface StockKlineRow {
  code: string
  /** 日/周/月为 `YYYY-MM-DD`；分钟级为 `YYYY-MM-DD HH:mm` */
  time: string
  open: string
  high: string
  low: string
  close: string
  volume: string
  amount: string
}

/** 待入库的一行——列名与 `daily_klines` 实体对齐（只有日线落库，故时间只到日） */
interface StockKlineInsertRow extends Omit<StockKlineRow, 'time'> {
  tradeDate: string
}

/** 实时查询的可选参数 */
export interface RealtimeStockKlineQuery {
  /** K 线周期，默认日线 */
  period?: KlinePeriod
  /**
   * 复权方式，不传则由上游取默认（**实测为前复权 `qfq`**）
   *
   * 不复权用 `nofq`——注意落库路径存的是 TDX 的**不复权**价。
   */
  fq?: KlineFq
  /** 起始日期 `YYYY-MM-DD`，默认 `STOCK_KLINE_QUERY_DEFAULT_START` */
  start?: string
  /** 结束日期 `YYYY-MM-DD`，不传则由上游取当日 */
  end?: string
  /** 返回条数上限，默认 240 */
  limit?: number
}

/** 一次同步的汇总 */
export interface StockKlineSyncResult {
  mode: StockKlineSyncMode
  /** 待同步的股票数 */
  total: number
  succeeded: number
  failed: number
  /** 实际写入的行数 */
  rows: number
  /** 本次硬删除的超期行数（早于两年窗口的） */
  purged: number
  durationMs: number
  /** 失败明细（最多 `STOCK_KLINE_MAX_REPORTED_ERRORS` 条） */
  errors: string[]
}

/** 厘 → 元（厘是整数，除以 1000 后最多 3 位小数，故无损） */
function toYuan(priceUnits: number): string {
  return (priceUnits / PRICE_UNITS_PER_YUAN).toFixed(3)
}

/**
 * `Date` → `YYYY-MM-DD`
 *
 * 用**本地时区**的取值而非 `toISOString()`：库内 `decodeDayTime` 是按进程本地时区
 * 构造 `new Date(y, m-1, d, 15, 0)` 的，走 UTC 会把日期整体偏移到前一天。
 */
function toDateString(time: Date): string {
  const year = time.getFullYear()
  const month = String(time.getMonth() + 1).padStart(2, '0')
  const day = String(time.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * CLI 时间列的归一化
 *
 * **分钟周期**带时分秒（`2026-09-18 15:00:00`），日线及以上只有日期。
 * 秒位实测恒为 `00`，截到分即可——响应契约是 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`。
 */
function normalizeTime(date: string): string {
  const [day, clock] = date.split(' ')
  return clock ? `${day} ${clock.slice(0, 5)}` : day
}

/** CLI 表格行 → 响应行（列名映射见 `KLINE_COLUMN_MAP`，注意收盘价叫 `last`） */
function toStockKlineRow(code: string, row: TableRow): StockKlineRow {
  return {
    code,
    time: normalizeTime(row[KLINE_COLUMN_MAP.time]),
    open: row[KLINE_COLUMN_MAP.open],
    high: row[KLINE_COLUMN_MAP.high],
    low: row[KLINE_COLUMN_MAP.low],
    close: row[KLINE_COLUMN_MAP.close],
    volume: row[KLINE_COLUMN_MAP.volume],
    amount: row[KLINE_COLUMN_MAP.amount],
  }
}

/**
 * 断言 CLI 输出的列齐全
 *
 * 必须在取值**之前**炸掉：表行是 `Record<string, string>`，列名对不上时
 * 按 `row['close']` 取只会拿到 `undefined`，静默变成空值返回给调用方。
 */
function assertColumns(columns: string[]): void {
  const missing = Object.values(KLINE_COLUMN_MAP).filter((name) => !columns.includes(name))
  if (missing.length > 0) {
    throw new ServiceUnavailableException(
      `K 线输出的列缺失: ${missing.join('/')}（CLI 输出格式可能已变更）`
    )
  }
}

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 日 K 线服务
 *
 * 两条取数路径，互不依赖，且**用的是两个不同的数据源**：
 * - **落库（`sync`）**：遍历 A 股全部代码，逐只经 `TdxService`（通达信 TCP 长连接）
 *   拉**日线**并 upsert 入库。实测单次约 20ms，叠加 1 秒间隔后全市场约 5400 只 → **约 90 分钟**。
 * - **实时（`getRealtime`）**：单只经 `WestockCliService`（腾讯 Go CLI 子进程）即时拉取、
 *   不写库，周期任选，供 `GET /api/stock-kline` 使用。
 *
 * 两者返回的行情列同名同义（元 / 手），但**成交额精度不同**：CLI 侧会截断
 * （实测 1972730000 vs TDX 的 1972732160），故不要拿两条路径的数据做逐值比对。
 */
@Injectable()
export class StockKlineService {
  private readonly logger = new Logger(StockKlineService.name)

  /** 同步中标志：挡住「手动接口连点」与「cron 与手动撞车」 */
  private running = false

  constructor(
    private readonly tdxService: TdxService,
    private readonly westockCliService: WestockCliService,
    @InjectRepository(DailyKline)
    private readonly klineRepo: Repository<DailyKline>,
    @InjectRepository(StockSymbol)
    private readonly symbolRepo: Repository<StockSymbol>
  ) {}

  /**
   * 同步 A 股全市场日 K 线
   *
   * - `full`：回补近两年（约 490 根/只，一次请求即可，在 `limit` 上限 1000 内）
   * - `incremental`：每只只补最新几根，用于每日盘后
   * - **不传**：表为空则全量，否则增量
   *
   * 单只股票失败不中断整体（记录后继续），已有数据不受影响——重复执行幂等。
   */
  async sync(mode?: StockKlineSyncMode): Promise<StockKlineSyncResult> {
    if (this.running) {
      throw new ConflictException('同步任务正在执行中，请稍后再试')
    }
    this.running = true

    const startedAt = Date.now()
    try {
      const codes = await this.resolveCodes()
      const effectiveMode: StockKlineSyncMode =
        mode ?? ((await this.isTableEmpty()) ? 'full' : 'incremental')
      const count =
        effectiveMode === 'full' ? STOCK_KLINE_MAX_BARS_PER_REQUEST : STOCK_KLINE_INCREMENTAL_BARS
      const since = this.sinceDate()

      let succeeded = 0
      let failed = 0
      let rows = 0
      const errors: string[] = []
      let buffer: StockKlineInsertRow[] = []

      for (let i = 0; i < codes.length; i++) {
        const code = codes[i]

        try {
          // TDX 的 start 是「从最新往前倒推的偏移量」（0 = 最新），不是日期——
          // 无法限定区间，只能多取一些再按时间窗自行裁剪
          const { bars } = await this.tdxService.getKline(code, STOCK_KLINE_PERIOD, 0, count)
          buffer.push(...this.toRows(code, bars, since))
          succeeded++
        } catch (err) {
          failed++
          if (errors.length < STOCK_KLINE_MAX_REPORTED_ERRORS) {
            errors.push(`${code}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        if (buffer.length >= STOCK_KLINE_UPSERT_CHUNK) {
          rows += await this.flush(buffer)
          buffer = []
        }

        // 串行 + 固定间隔：等上一只结束后再歇 1 秒才发下一次（最后一只不必等）
        if (i < codes.length - 1) {
          await sleep(STOCK_KLINE_REQUEST_INTERVAL_MS)
        }
      }
      rows += await this.flush(buffer)

      // 清理滑出时间窗的历史数据——过滤只能挡住「本次拉到的」，库里已有的超期行要靠删除
      const purged = await this.purgeExpired(since)

      const durationMs = Date.now() - startedAt
      this.logger.log(
        `[${effectiveMode}] 日K线同步完成: ${succeeded}/${codes.length} 只成功, 写入 ${rows} 行, 清理超期 ${purged} 行, 失败 ${failed}, 耗时 ${durationMs}ms`
      )

      return {
        mode: effectiveMode,
        total: codes.length,
        succeeded,
        failed,
        rows,
        purged,
        durationMs,
        errors,
      }
    } finally {
      this.running = false
    }
  }

  /**
   * 实时获取某只股票的 K 线（**数据源是 westock CLI，不经数据库**）
   *
   * 与 `sync()` 落库的那份数据相互独立：走的是子进程调用，不写库，
   * 因此**不受**「每日 16:00 同步」的时效限制，且周期任选（落库只有日线，且用的
   * 是另一个数据源 TDX）。
   *
   * `[start, end]` 限定取值区间，而 `limit` 取的是该区间**尾部**的 N 根
   * （即区间内最新的一批），**不是**从 `start` 往后数。
   * CLI 本身就是按时间**降序**输出的，无需反转。
   */
  async getRealtime(code: string, query: RealtimeStockKlineQuery = {}): Promise<StockKlineRow[]> {
    // CLI 同样会**静默少返回**，这里再兜一次底（DTO 已挡，防内部调用越界）
    const limit = Math.min(
      query.limit ?? STOCK_KLINE_QUERY_DEFAULT_LIMIT,
      STOCK_KLINE_QUERY_MAX_LIMIT
    )
    const { columns, rows } = await this.westockCliService.kline(code, {
      period: query.period ?? KLINE_DEFAULT_PERIOD,
      // 不传 fq 时**不补**：保持与上游默认（前复权）解耦，上游改了这边不会静默跟着变
      fq: query.fq,
      limit,
      // 不传 start 时补默认值。补了也安全：CLI 只在 start 与 end **同时**给出时才校验跨度
      start: query.start ?? STOCK_KLINE_QUERY_DEFAULT_START,
      end: query.end,
    })

    // 空结果时 columns 也是空的，不能据此判缺失
    if (rows.length > 0) {
      assertColumns(columns)
    }

    return rows.map((row) => toStockKlineRow(code, row))
  }

  /** 各表的概览统计 */
  async getStats(): Promise<{
    symbols: number
    rows: number
    earliest: string | null
    latest: string | null
  }> {
    const symbols = await this.klineRepo
      .createQueryBuilder('k')
      .select('COUNT(DISTINCT k.code)', 'count')
      .getRawOne<{ count: string }>()

    const total = await this.klineRepo.count()

    const range = await this.klineRepo
      .createQueryBuilder('k')
      .select('MIN(k.tradeDate)', 'earliest')
      .addSelect('MAX(k.tradeDate)', 'latest')
      .getRawOne<{ earliest: string | null; latest: string | null }>()

    return {
      symbols: Number(symbols?.count ?? 0),
      rows: total,
      earliest: range?.earliest ?? null,
      latest: range?.latest ?? null,
    }
  }

  /**
   * 取需要同步的 A 股代码
   *
   * **直接从 `stock_symbols` 表读**（由 symbols 模块的定时任务每日维护），
   * 不依赖 symbols 模块的业务逻辑，也不发起任何外部请求。
   */
  private async resolveCodes(): Promise<string[]> {
    const rows = await this.symbolRepo.find({
      where: { market: A_SHARE_MARKET },
      order: { code: 'ASC' },
    })

    if (rows.length === 0) {
      throw new ServiceUnavailableException(
        '标的代码表为空，请先执行 POST /api/stock-symbols/sync 同步 A 股代码'
      )
    }

    return rows.map((row) => row.code)
  }

  /** 表是否为空——决定「不传 mode」时走全量还是增量（用 LIMIT 1 而非 count，避免全表扫描） */
  private async isTableEmpty(): Promise<boolean> {
    const any = await this.klineRepo.findOne({ select: { code: true }, where: {} })
    return any === null
  }

  /** 全量回补的起始日期（今天往前 N 年） */
  private sinceDate(): string {
    const date = new Date()
    date.setFullYear(date.getFullYear() - STOCK_KLINE_FULL_YEARS)
    return toDateString(date)
  }

  /** 把上游 bars 转成待入库行（换算单位、按时间窗过滤） */
  private toRows(code: string, bars: KlineBar[], since: string): StockKlineInsertRow[] {
    const rows: StockKlineInsertRow[] = []
    for (const bar of bars) {
      const row = this.toInsertRow(code, bar)
      // 早于时间窗的丢弃（全量模式会多拿到更早的数据）
      if (row.tradeDate < since) continue
      rows.push(row)
    }
    return rows
  }

  /** 单根 bar → 待入库行（换算单位：厘 → 元；成交量保持上游的「手」） */
  private toInsertRow(code: string, bar: KlineBar): StockKlineInsertRow {
    return {
      code,
      tradeDate: toDateString(bar.time),
      open: toYuan(bar.open),
      high: toYuan(bar.high),
      low: toYuan(bar.low),
      close: toYuan(bar.close),
      volume: String(bar.volume),
      amount: toYuan(bar.amount),
    }
  }

  /**
   * 去重后分批写入，返回写入行数
   *
   * 去重不可省：upsert 把整批拼成**单条** INSERT，同批内出现重复的冲突键时，
   * PostgreSQL 会报 `ON CONFLICT DO UPDATE command cannot affect row a second time`，
   * 导致整批失败。
   */
  private async flush(buffer: StockKlineInsertRow[]): Promise<number> {
    if (buffer.length === 0) return 0

    const rows = this.dedupe(buffer)
    for (let i = 0; i < rows.length; i += STOCK_KLINE_UPSERT_CHUNK) {
      await this.klineRepo
        .createQueryBuilder()
        .insert()
        .into(DailyKline)
        .values(rows.slice(i, i + STOCK_KLINE_UPSERT_CHUNK))
        // 冲突时只更新行情列；无变化则不写入（skipUpdateIfNoValuesChanged）
        .orUpdate(['open', 'high', 'low', 'close', 'volume', 'amount'], ['code', 'trade_date'], {
          skipUpdateIfNoValuesChanged: true,
        })
        .execute()
    }

    return rows.length
  }

  /**
   * 硬删除早于时间窗的数据，只保留近两年
   *
   * **必须用硬删**：本表不继承 `BaseEntity`，没有 `delete_at` 可软删；
   * 即便有，软删的行也会继续占着 `(code, trade_date)` 主键，
   * 使后续同步的 `ON CONFLICT` 命中死行。
   *
   * 每次同步（全量/增量都算）都跑一次：拉取侧的 `since` 过滤只能挡住
   * 「本次拉回来的」超期数据，把库里已有的滑出窗口的行清掉要靠这步。
   * 走 `(code, trade_date)` 主键前缀无法命中，但有 `idx_daily_klines_date` 支撑。
   */
  private async purgeExpired(since: string): Promise<number> {
    const result = await this.klineRepo
      .createQueryBuilder()
      .delete()
      .from(DailyKline)
      .where('trade_date < :since', { since })
      .execute()

    return result.affected ?? 0
  }

  /** 按 `(code, tradeDate)` 去重，保留先出现的一条 */
  private dedupe(rows: StockKlineInsertRow[]): StockKlineInsertRow[] {
    const seen = new Set<string>()
    const unique: StockKlineInsertRow[] = []

    for (const row of rows) {
      const key = `${row.code}|${row.tradeDate}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(row)
    }

    return unique
  }
}
