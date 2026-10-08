import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm'
import { TDX_KLINE_MAX_COUNT } from '../api-tdx/api-tdx.constants'
import { ApiTdxService } from '../api-tdx/api-tdx.service'
import type { TdxKlineBar } from '../api-tdx/api-tdx.types'
import { StockSymbol } from '../stock-symbols/entities/stock-symbol.entity'
import { StockKlineQueryDto } from './dto/stock-kline-query.dto'
import { StockKline } from './entities/stock-kline.entity'
import {
  STOCK_KLINE_ABORT_AFTER_FAILURES,
  STOCK_KLINE_DAILY_BACKFILL_COUNT,
  STOCK_KLINE_DAILY_REFRESH_MARGIN,
  STOCK_KLINE_MINUTE_CATEGORIES,
  STOCK_KLINE_MINUTE_RETENTION_DAYS,
  STOCK_KLINE_MINUTE_WINDOWS,
  STOCK_KLINE_QUERY_DEFAULT_PAGE_SIZE,
  STOCK_KLINE_SCOPE_ASSET_TYPE,
  STOCK_KLINE_SHARES_PER_LOT,
  STOCK_KLINE_TRADING_DAY_RATIO,
  STOCK_KLINE_UPSERT_CHUNK_SIZE,
  type StockKlineCategory,
} from './stock-kline.constants'

/** 分页查询结果 */
export interface StockKlinePage {
  /** 符合条件的总条数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 当前页数据（按 datetime 升序） */
  items: StockKline[]
}

/** 单次同步的结果统计 */
export interface StockKlineSyncResult {
  /** 同步范围内的标的数 */
  symbols: number
  /** 成功的标的数（分钟同步中，全部窗口成功才算成功） */
  succeeded: number
  /** 失败的标的数（单只/单窗口失败不中断整轮，仅计数） */
  failed: number
  /** 本轮实际写入（upsert）的行数 */
  rows: number
  /** 是否因上一轮同步尚未结束而整体跳过 */
  skipped: boolean
  /** 耗时（毫秒） */
  costMs: number
}

/** 一天的毫秒数（估算「与在库最新日期的自然日间隔」用） */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * upsert 配置：冲突键 = 复合主键（同 stock-symbols 的既有立场）
 *
 * `skipUpdateIfNoValuesChanged` 是写入策略的关键：日 K 与分钟 K 每夜都会重取最近一段
 * （bar 不可变），不加此开关时会把整张表（千万行级）全部重写一遍，
 * 造成索引膨胀与 WAL 尖峰。开启后 PostgreSQL 只在列值确有变化时才真正更新；
 * 配合「行对象不带 syncAt（该列有默认值 `now()`）」，未变化行不产生任何新版本。
 */
const UPSERT_OPTIONS = {
  conflictPaths: ['thscode', 'category', 'datetime'],
  skipUpdateIfNoValuesChanged: true,
}

/**
 * 股票 K 线服务
 *
 * 全市场 A 股的日 K 与分钟 K（**均来自通达信**，逐只 TCP）定时同步落库 + 查询：
 * - 每交易日 17:45 同步日 K：首次回补约 250 根（近 1 年），之后按每只在库最新日期自适应回取
 * - 每交易日 19:00 同步分钟 K：五个周期各取覆盖 5 个交易日的窗口（幂等重取），随后清理超窗行
 *
 * 规模是本模块的核心约束：全市场约 5578 只 × 逐只请求，一轮同步以十分钟计，
 * 每夜重取的行以百万计（未变化行经 `skipUpdateIfNoValuesChanged` 不产生实际写入）
 * ——故刻意**不提供手动触发接口**（HTTP 同步等待必然超时，异步化又要引入进度/状态机制），
 * 由定时任务与启动补齐承担。
 */
@Injectable()
export class StockKlineService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StockKlineService.name)

  /** 日 K / 分钟 K 两条流水线各自的防重入标志（两者互不阻塞，极端慢的夜里可能重叠） */
  private dailySyncing = false
  private minuteSyncing = false

  constructor(
    @InjectRepository(StockKline) private readonly klineRepo: Repository<StockKline>,
    @InjectRepository(StockSymbol) private readonly symbolRepo: Repository<StockSymbol>,
    private readonly tdxApi: ApiTdxService
  ) {}

  /** 表为空时补齐首次数据（仅首次部署命中；不 await——首轮回补以十分钟计，不能拖住启动） */
  onApplicationBootstrap(): void {
    void this.fillDailyIfEmpty()
    void this.fillMinuteIfEmpty()
  }

  /**
   * 同步日 K（通达信 day 周期）
   *
   * 首次回补约 1 年；已有记录的标的按「与在库最新日期的间隔」折算需回取的根数
   * （间隔大取多、间隔小取少，见 `dailyFetchCount`），整窗幂等 upsert——
   * bar 不可变，重取还能带回上游更正。由 `StockKlineSchedule` 定时触发（启动补齐亦调用）；
   * 网络请求刻意放在事务外，单只失败只计数不中断（退市/停牌股不应让整轮白跑），
   * 数据库异常则直接终止整轮。
   */
  async syncDailyKlines(): Promise<StockKlineSyncResult> {
    if (this.dailySyncing) {
      this.logger.warn({ message: '日 K 同步已在进行中, 本轮跳过' })
      return { symbols: 0, succeeded: 0, failed: 0, rows: 0, skipped: true, costMs: 0 }
    }
    this.dailySyncing = true
    const startedAt = Date.now()

    try {
      const thscodes = await this.listAShareThscodes()
      if (thscodes.length === 0) {
        this.logger.warn({ message: '标的列表为空（stock_symbols 尚未同步？）, 跳过本轮' })
        return {
          symbols: 0,
          succeeded: 0,
          failed: 0,
          rows: 0,
          skipped: false,
          costMs: Date.now() - startedAt,
        }
      }

      const lastDates = await this.findLastDailyDates(thscodes)
      const buffer: Partial<StockKline>[] = []
      let succeeded = 0
      let failed = 0
      let rows = 0

      for (const thscode of thscodes) {
        let bars: TdxKlineBar[] | null = null
        try {
          bars = await this.tdxApi.getKlines({
            thscode,
            category: 'day',
            count: this.dailyFetchCount(lastDates.get(thscode)),
          })
        } catch (err) {
          failed++
          this.logger.warn({ message: '日 K 同步单只失败', thscode, error: err })
        }

        // 熔断：开局连续失败且零成功，多为行情服务器不可达，继续只是空耗
        if (succeeded === 0 && failed >= STOCK_KLINE_ABORT_AFTER_FAILURES) {
          this.logger.error({
            message: '日 K 连续失败达到阈值（疑似上游不可用）, 中止本轮',
            failed,
          })
          break
        }

        if (bars) {
          succeeded++
          buffer.push(...bars.map((bar) => this.toKlineRow(thscode, 'day', bar)))
          rows += await this.flushFullChunks(buffer)
        }
      }

      rows += await this.flushRemaining(buffer)
      const costMs = Date.now() - startedAt
      this.logger.log({
        message: '日 K 同步完成',
        symbols: thscodes.length,
        succeeded,
        failed,
        rows,
        costMs,
      })

      return { symbols: thscodes.length, succeeded, failed, rows, skipped: false, costMs }
    } finally {
      this.dailySyncing = false
    }
  }

  /**
   * 同步分钟 K（1m/5m/15m/30m/60m）并清理超窗数据
   *
   * 每夜按 `STOCK_KLINE_MINUTE_WINDOWS` 的窗口重取并幂等 upsert——窗口 = 保留窗
   * （恰好 5 个交易日），每轮都会把保留窗完整铺满（自愈）。全部写完后再清理；
   * 本轮一根未取到（多为上游整体异常）则跳过清理，避免在数据陈旧时误删。
   */
  async syncMinuteKlines(): Promise<StockKlineSyncResult> {
    if (this.minuteSyncing) {
      this.logger.warn({ message: '分钟 K 同步已在进行中, 本轮跳过' })
      return { symbols: 0, succeeded: 0, failed: 0, rows: 0, skipped: true, costMs: 0 }
    }
    this.minuteSyncing = true
    const startedAt = Date.now()

    try {
      const thscodes = await this.listAShareThscodes()
      if (thscodes.length === 0) {
        this.logger.warn({ message: '标的列表为空（stock_symbols 尚未同步？）, 跳过本轮' })
        return {
          symbols: 0,
          succeeded: 0,
          failed: 0,
          rows: 0,
          skipped: false,
          costMs: Date.now() - startedAt,
        }
      }

      const buffer: Partial<StockKline>[] = []
      let succeeded = 0
      let failed = 0
      let rows = 0
      let produced = 0

      for (const thscode of thscodes) {
        let failedAny = false
        for (const category of STOCK_KLINE_MINUTE_CATEGORIES) {
          for (const window of STOCK_KLINE_MINUTE_WINDOWS[category]) {
            let bars: TdxKlineBar[] | null = null
            try {
              bars = await this.tdxApi.getKlines({
                thscode,
                category,
                start: window.start,
                count: window.count,
              })
            } catch (err) {
              failedAny = true
              this.logger.warn({
                message: '分钟 K 同步单窗口失败',
                thscode,
                category,
                start: window.start,
                error: err,
              })
            }

            if (bars) {
              produced += bars.length
              buffer.push(...bars.map((bar) => this.toKlineRow(thscode, category, bar)))
              rows += await this.flushFullChunks(buffer)
            }
          }
        }

        if (failedAny) failed++
        else succeeded++

        // 熔断：同 daily（空结果按成功计，个别标的无数据不会误触发）
        if (succeeded === 0 && failed >= STOCK_KLINE_ABORT_AFTER_FAILURES) {
          this.logger.error({
            message: '分钟 K 连续失败达到阈值（疑似上游不可用）, 中止本轮',
            failed,
          })
          break
        }
      }

      rows += await this.flushRemaining(buffer)
      const pruned = produced > 0 ? await this.pruneMinuteKlines() : 0
      const costMs = Date.now() - startedAt
      this.logger.log({
        message: '分钟 K 同步完成',
        symbols: thscodes.length,
        succeeded,
        failed,
        rows,
        pruned,
        costMs,
      })

      return { symbols: thscodes.length, succeeded, failed, rows, skipped: false, costMs }
    } finally {
      this.minuteSyncing = false
    }
  }

  /**
   * 分页查询 K 线
   *
   * `datetime` 是混合长度字符串（日 K 8 位、分钟 K 12 位），日期边界必须**按类别分别构造**：
   * 分钟行补 `0000`/`2359` 后比较；日 K 直接用 8 位边界。混用时
   * `'20261008' < '202610080000'` 会把当日行整体排到边界之外（详见实体注释）。
   */
  async findKlines(dto: StockKlineQueryDto): Promise<StockKlinePage> {
    const page = dto.page ?? 1
    const pageSize = dto.pageSize ?? STOCK_KLINE_QUERY_DEFAULT_PAGE_SIZE
    const category = dto.category ?? 'day'

    const lower = dto.start ? (category === 'day' ? dto.start : `${dto.start}0000`) : undefined
    const upper = dto.end ? (category === 'day' ? dto.end : `${dto.end}2359`) : undefined

    const where: FindOptionsWhere<StockKline> = { thscode: dto.thscode, category }
    if (lower && upper) where.datetime = Between(lower, upper)
    else if (lower) where.datetime = MoreThanOrEqual(lower)
    else if (upper) where.datetime = LessThanOrEqual(upper)

    const [items, total] = await this.klineRepo.findAndCount({
      where,
      order: { datetime: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return { total, page, pageSize, items }
  }

  /** 取同步范围内的全部标的（在市 A 股），按 thscode 升序 */
  private async listAShareThscodes(): Promise<string[]> {
    const rows = await this.symbolRepo.find({
      select: { thscode: true },
      where: { assetType: STOCK_KLINE_SCOPE_ASSET_TYPE, delistedAt: IsNull() },
      order: { thscode: 'ASC' },
    })
    return rows.map((row) => row.thscode)
  }

  /**
   * 取每只标的在库的日 K 最新日期（推算本轮回取根数的依据），返回 `thscode → yyyyMMdd`
   *
   * 用 `= ANY(数组)` 单参数匹配主键前缀，走主键索引，避免 5578 次单点查询。
   */
  private async findLastDailyDates(thscodes: string[]): Promise<Map<string, string>> {
    if (thscodes.length === 0) return new Map()

    const rows = await this.klineRepo
      .createQueryBuilder('k')
      .select('k.thscode', 'thscode')
      .addSelect('MAX(k.datetime)', 'lastDate')
      .where('k.category = :category', { category: 'day' })
      .andWhere('k.thscode = ANY(:thscodes)', { thscodes })
      .groupBy('k.thscode')
      .getRawMany<{ thscode: string; lastDate: string }>()

    return new Map(rows.map((row) => [row.thscode, row.lastDate]))
  }

  /** 缓冲满一批即落库（分片 upsert，防 PostgreSQL 绑定参数上限），返回写入行数 */
  private async flushFullChunks(buffer: Partial<StockKline>[]): Promise<number> {
    let rows = 0
    while (buffer.length >= STOCK_KLINE_UPSERT_CHUNK_SIZE) {
      const batch = this.dedupeRows(buffer.splice(0, STOCK_KLINE_UPSERT_CHUNK_SIZE))
      await this.klineRepo.upsert(batch, UPSERT_OPTIONS)
      rows += batch.length
    }
    return rows
  }

  /** 冲刷尾部不足一批的缓冲，返回写入行数 */
  private async flushRemaining(buffer: Partial<StockKline>[]): Promise<number> {
    if (buffer.length === 0) return 0

    const batch = this.dedupeRows(buffer.splice(0))
    await this.klineRepo.upsert(batch, UPSERT_OPTIONS)
    return batch.length
  }

  /**
   * 批内按主键去重（保留后出现的）
   *
   * PostgreSQL 的 `ON CONFLICT DO UPDATE` 不允许同一批内出现两次相同冲突键
   * （报 `cannot affect row a second time`），一行重复会让**整个分片**写入失败——
   * 两个取数窗口的边界、上游偶发的重复根都可能触发，故在写库前兜底去重。
   * 缓冲跨标的累积，一行重复会殃及同批的其他标的，代价不止一只。
   */
  private dedupeRows(batch: Partial<StockKline>[]): Partial<StockKline>[] {
    const byKey = new Map<string, Partial<StockKline>>()
    for (const row of batch) {
      byKey.set(`${row.thscode}|${row.category}|${row.datetime}`, row)
    }
    return [...byKey.values()]
  }

  /**
   * 清理超出保留窗口的分钟 K 行，返回删除行数
   *
   * 保留窗左边界取「最近 N 个不同交易日的最后一个」——语义由数据自身决定，
   * 遇节假日自动正确，也不需要引入交易日历模块。类别的显式 IN 列表让删除
   * 走 (category, datetime) 索引，且不与 8 位的日 K 行发生跨长度比较。
   */
  private async pruneMinuteKlines(): Promise<number> {
    const categories: StockKlineCategory[] = [...STOCK_KLINE_MINUTE_CATEGORIES]

    const kept = await this.klineRepo
      .createQueryBuilder('k')
      .select('DISTINCT LEFT(k.datetime, 8)', 'date')
      .where('k.category IN (:...categories)', { categories })
      .orderBy('date', 'DESC')
      .limit(STOCK_KLINE_MINUTE_RETENTION_DAYS)
      .getRawMany<{ date: string }>()

    // 数据不足一个保留窗说明尚未铺满（如首次回补中断），不做清理
    if (kept.length < STOCK_KLINE_MINUTE_RETENTION_DAYS) return 0

    const cutoff = `${kept[kept.length - 1].date}0000`
    const result = await this.klineRepo
      .createQueryBuilder()
      .delete()
      .from(StockKline)
      .where('category IN (:...categories)', { categories })
      .andWhere('datetime < :cutoff', { cutoff })
      .execute()

    return result.affected ?? 0
  }

  /**
   * 通达信单根 K 线 → 实体行（日 K 与分钟 K 同构，共用此转换）
   *
   * - `bar.time` 是库用**本地时区构造函数**拼出的 Date（`new Date(y, m-1, d, h, min)`，
   *   字段值即中国墙钟时间），故必须直接取本地 getter——**不能**按 Asia/Shanghai 格式化，
   *   那会在非中国时区的机器上整体偏移 8 小时
   * - 成交量为「手」，×100 换算为股
   * - 行对象**不含 syncAt**（由列默认值 `now()` 填充）——这是 `skipUpdateIfNoValuesChanged`
   *   生效的前提：syncAt 每轮都不同，带上它会让「未变化」永远不成立，等于没跳过
   */
  private toKlineRow(
    thscode: string,
    category: StockKlineCategory,
    bar: TdxKlineBar
  ): Partial<StockKline> {
    return {
      thscode,
      category,
      datetime: this.toLocalTimeKey(bar.time, category),
      openPrice: bar.open,
      highPrice: bar.high,
      lowPrice: bar.low,
      closePrice: bar.close,
      volume: bar.volume * STOCK_KLINE_SHARES_PER_LOT,
      amount: bar.amount,
    }
  }

  /** Date → 本地字段拼串：日 K 为 `yyyyMMdd`（8 位）、分钟 K 为 `yyyyMMddHHmm`（12 位） */
  private toLocalTimeKey(time: Date, category: StockKlineCategory): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    const ymd = `${time.getFullYear()}${pad(time.getMonth() + 1)}${pad(time.getDate())}`
    return category === 'day' ? ymd : `${ymd}${pad(time.getHours())}${pad(time.getMinutes())}`
  }

  /**
   * 本轮日 K 需回取的根数
   *
   * 无记录（新部署 / 新上市）→ 回补约 1 年；有记录 → 按与最新日期的自然日间隔折算
   * 交易日数（`STOCK_KLINE_TRADING_DAY_RATIO` 取偏保守的 5/7），再加余量吸收近似误差。
   * 刻意不用固定小窗口：日 K 从不清理，长停机后窗口盖不住的空档会成为**永久空洞**。
   */
  private dailyFetchCount(lastDate?: string): number {
    if (!lastDate) return STOCK_KLINE_DAILY_BACKFILL_COUNT

    const wanted =
      Math.ceil(this.daysSince(lastDate) * STOCK_KLINE_TRADING_DAY_RATIO) +
      STOCK_KLINE_DAILY_REFRESH_MARGIN
    return Math.min(wanted, TDX_KLINE_MAX_COUNT)
  }

  /**
   * `yyyyMMdd` 距今天的自然日数（向上取整）
   *
   * 用本地时区构造解析（与通达信 `bar.time` 的构造约定一致）；仅用于估算根数，
   * ±1 天的误差由 `STOCK_KLINE_DAILY_REFRESH_MARGIN` 吸收。
   */
  private daysSince(dateKey: string): number {
    const last = new Date(
      Number(dateKey.slice(0, 4)),
      Number(dateKey.slice(4, 6)) - 1,
      Number(dateKey.slice(6, 8))
    )
    return Math.max(0, Math.ceil((Date.now() - last.getTime()) / DAY_MS))
  }

  /**
   * 日 K 表为空时补齐（仅在首次部署命中）
   *
   * 判空用 `findOne` 而非 `count()`：本表稳态以百万行计，count 会全扫；
   * findOne 在 (category, datetime) 索引上取到一行即返回。
   */
  private async fillDailyIfEmpty(): Promise<void> {
    try {
      if (await this.klineRepo.findOne({ select: { thscode: true }, where: { category: 'day' } }))
        return

      this.logger.log({ message: '日 K 表为空, 触发首次同步' })
      await this.syncDailyKlines()
    } catch (err) {
      this.logger.error({ message: '日 K 首次同步失败', error: err })
    }
  }

  /** 分钟 K 表为空时补齐（仅在首次部署命中） */
  private async fillMinuteIfEmpty(): Promise<void> {
    try {
      const existing = await this.klineRepo.findOne({
        select: { thscode: true },
        where: { category: In([...STOCK_KLINE_MINUTE_CATEGORIES]) },
      })
      if (existing) return

      this.logger.log({ message: '分钟 K 表为空, 触发首次同步' })
      await this.syncMinuteKlines()
    } catch (err) {
      this.logger.error({ message: '分钟 K 首次同步失败', error: err })
    }
  }
}
