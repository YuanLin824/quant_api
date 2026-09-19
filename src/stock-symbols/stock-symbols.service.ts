import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StockSdkService } from '../stock-sdk/stock-sdk.service'
import { StockSymbol } from './entities/stock-symbol.entity'
import {
  STOCK_SYMBOLS_UPSERT_CHUNK,
  SYMBOL_MARKETS,
  type StockSymbolMarket,
} from './stock-symbols.constants'

/** 单个市场的同步结果 */
export interface MarketSyncResult {
  market: StockSymbolMarket
  /** 上游返回条数（去重前） */
  fetched: number
  /** 去重后待入库条数 */
  stored: number
  /** 本次新增（已存在的不计入） */
  inserted: number
  /** 失败原因，成功时不带此字段 */
  error?: string
}

/** 一次同步的汇总 */
export interface SymbolSyncSummary {
  results: MarketSyncResult[]
  durationMs: number
}

/**
 * 标的代码同步服务
 *
 * 每日从 `stock-sdk` 拉取 A股/港股/美股的全部代码并落库。
 * 采用**增量更新**：只 upsert、从不删除，已退市的历史记录保留。
 *
 * 上游返回的是**纯代码数组**（不含名称等属性），故本表只有 `market` 与 `code` 两列。
 */
@Injectable()
export class StockSymbolsService {
  private readonly logger = new Logger(StockSymbolsService.name)

  /** 同步中标志：挡住「手动接口连点」与「cron 与手动撞车」 */
  private running = false

  constructor(
    private readonly stockSdkService: StockSdkService,
    @InjectRepository(StockSymbol)
    private readonly symbolRepo: Repository<StockSymbol>
  ) {}

  /**
   * 同步全部市场的标的代码
   *
   * 各市场相互独立：单个失败只记录并继续，其余照常同步，下次任务会补上。
   * 这对本功能是安全的——同步只 upsert、从不删除，上游返回不完整也不会损坏已有数据。
   */
  async syncAll(): Promise<SymbolSyncSummary> {
    if (this.running) {
      throw new ConflictException('同步任务正在执行中，请稍后再试')
    }
    this.running = true

    const startedAt = Date.now()
    const results: MarketSyncResult[] = []

    try {
      for (const market of SYMBOL_MARKETS) {
        results.push(await this.syncMarket(market))
      }
    } finally {
      this.running = false
    }

    // 全失败通常意味着下游数据源不可达，是运维信号
    if (results.every((result) => result.error)) {
      this.logger.error('全部市场同步失败，请检查 stock-sdk 数据源连通性')
    }

    return { results, durationMs: Date.now() - startedAt }
  }

  /** 同步单个市场 */
  private async syncMarket(market: StockSymbolMarket): Promise<MarketSyncResult> {
    try {
      // 不传 simple → 上游返回带市场前缀的代码（sh600036 / hk00700 / usAAPL）
      const codes = await this.stockSdkService.getCodeList({ market })
      return await this.persist(market, codes)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`[${market}] 同步失败: ${message}`)
      return { market, fetched: 0, stored: 0, inserted: 0, error: message }
    }
  }

  /** 去重 → 分批 upsert → 汇总统计 */
  private async persist(market: StockSymbolMarket, codes: string[]): Promise<MarketSyncResult> {
    // 代码格式（hk/us 前缀）已由 StockSdkService 规范化，这里只做入库前的兜底去重
    const { unique, duplicates } = this.dedupe(codes)
    if (duplicates.length > 0) {
      this.logger.warn(
        `[${market}] ${duplicates.length} 条代码重复已丢弃: ${duplicates.slice(0, 5).join(', ')}`
      )
    }

    const inserted = await this.upsert(market, unique)
    this.logger.log(
      `[${market}] 上游 ${codes.length} 条 → 去重后 ${unique.length} 条, 新增 ${inserted} 条`
    )

    return { market, fetched: codes.length, stored: unique.length, inserted }
  }

  /**
   * 按 `code` 去重
   *
   * 去重不可省：upsert 会把整批拼成**单条** INSERT，同一批内出现重复的冲突键时，
   * PostgreSQL 会报 `ON CONFLICT DO UPDATE command cannot affect row a second time`，
   * 导致整批写入失败并中断该市场当次同步。
   */
  private dedupe(codes: string[]): { unique: string[]; duplicates: string[] } {
    const seen = new Set<string>()
    const unique: string[] = []
    const duplicates: string[] = []

    for (const code of codes) {
      if (seen.has(code)) {
        duplicates.push(code)
        continue
      }
      seen.add(code)
      unique.push(code)
    }

    return { unique, duplicates }
  }

  /**
   * 写入代码：以 `code` 为唯一键的 upsert
   *
   * - 不存在 → 新增
   * - 已存在且 `market` 有变化 → 更新
   * - 已存在且无变化 → 不写入（`skipUpdateIfNoValuesChanged` 让 PG 生成
   *   `WHERE ... IS DISTINCT FROM ...`，避免无意义的写放大）
   *
   * 用 ON CONFLICT 而非「先查后插」：一次往返、无竞态，也避免为数千条代码逐条查询。
   *
   * **入参须已去重**（调用方经 `dedupe` 保证）。
   *
   * 返回值取写入前后的 count 差值，即**新增数**——更新不改变总数，
   * 故无法由此得出更新条数。
   */
  private async upsert(market: StockSymbolMarket, codes: string[]): Promise<number> {
    if (codes.length === 0) return 0

    const before = await this.symbolRepo.count({ where: { market } })

    for (let i = 0; i < codes.length; i += STOCK_SYMBOLS_UPSERT_CHUNK) {
      const rows = codes.slice(i, i + STOCK_SYMBOLS_UPSERT_CHUNK).map((code) => ({ market, code }))
      await this.symbolRepo
        .createQueryBuilder()
        .insert()
        .into(StockSymbol)
        .values(rows)
        // 冲突键为 code（数据库列名）；冲突时只更新 market，且值未变化时不产生写入
        // （不能把 update_at 写进 overwrite 列表，它会让 skipUpdate 优化失效）
        .orUpdate(['market'], ['code'], { skipUpdateIfNoValuesChanged: true })
        .execute()
    }

    const after = await this.symbolRepo.count({ where: { market } })
    return after - before
  }

  /** 各市场的代码数量统计 */
  async getStats(): Promise<Record<string, number>> {
    const rows = await this.symbolRepo
      .createQueryBuilder('s')
      .select('s.market', 'market')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.market')
      .getRawMany<{ market: string; count: string }>()

    return Object.fromEntries(rows.map((row) => [row.market, Number(row.count)]))
  }
}
