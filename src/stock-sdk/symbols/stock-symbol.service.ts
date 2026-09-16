import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StockSdkService } from '../stock-sdk.service'
import { CodesMarket } from '../stock-sdk.types'
import { StockSymbol } from './entities/stock-symbol.entity'
import { INSERT_BATCH_SIZE } from './stock-symbol.constants'

/** 同步的市场与顺序 */
const SYNC_MARKETS: CodesMarket[] = [
  CodesMarket.CN,
  CodesMarket.US,
  CodesMarket.HK,
  CodesMarket.FUND,
]

/** 单个市场的同步结果 */
export interface MarketSyncResult {
  market: CodesMarket
  /** 上游返回的代码总数 */
  total: number
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
 * 每日从 stock-sdk 拉取 A股/美股/港股/基金的代码列表并落库，
 * 采用**增量更新**：已存在的跳过，不删除已退市的历史记录。
 */
@Injectable()
export class StockSymbolService {
  private readonly logger = new Logger(StockSymbolService.name)

  constructor(
    private readonly stockSdkService: StockSdkService,
    @InjectRepository(StockSymbol)
    private readonly symbolRepo: Repository<StockSymbol>
  ) {}

  /**
   * 同步全部市场的标的代码
   *
   * 各市场相互独立：单个失败只记录并继续，其余照常同步，下次任务会补上。
   */
  async syncAll(): Promise<SymbolSyncSummary> {
    const startedAt = Date.now()
    const results: MarketSyncResult[] = []

    for (const market of SYNC_MARKETS) {
      try {
        const codes = await this.stockSdkService.getCodes(market)
        // 统一各市场的代码格式（详见 toStoredCode）
        const stored = codes.map((code) => this.toStoredCode(market, code))
        const inserted = await this.upsert(market, stored)
        results.push({ market, total: stored.length, inserted })
        this.logger.log(
          `[${market}] 上游 ${stored.length} 条, 新增 ${inserted} 条, 其余已存在(有变化则更新)`
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this.logger.error(`[${market}] 同步失败: ${message}`)
        results.push({ market, total: 0, inserted: 0, error: message })
      }
    }

    return { results, durationMs: Date.now() - startedAt }
  }

  /**
   * 入库前的代码规范化
   *
   * 统一四个市场的代码格式为「市场前缀 + 代码」：
   * - 港股：上游返回纯数字（`00700`），补 `hk` 前缀
   * - 美股：上游用东财 secid 前缀（`105`=NASDAQ / `106`=NYSE / `107`=AMEX），换成 `us`
   * - A 股 / 基金：上游已是目标格式，原样保留
   *
   * 均为幂等操作——已规范化的代码再次处理不会叠加前缀。
   */
  private toStoredCode(market: CodesMarket, code: string): string {
    switch (market) {
      case CodesMarket.HK:
        return /^hk/i.test(code) ? code : `hk${code}`
      case CodesMarket.US:
        // 只匹配开头的「数字 + 点」，不影响代码自身的点号（如 105.BRK.A → usBRK.A）
        return code.replace(/^\d+\./, 'us')
      default:
        return code
    }
  }

  /** 按市场查询代码列表（升序） */
  async getByMarket(market: CodesMarket): Promise<string[]> {
    const rows = await this.symbolRepo.find({ where: { market }, order: { code: 'ASC' } })
    return rows.map((row) => row.code)
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

  /**
   * 写入标的代码：以 `code` 为唯一键的 upsert
   *
   * - 不存在 → 新增
   * - 已存在且 `market` 有变化 → 更新
   * - 已存在且无变化 → 不写入（`skipUpdateIfNoValuesChanged` 让 PG 生成
   *   `WHERE ... IS DISTINCT FROM ...`，避免无意义的写放大）
   *
   * 用 ON CONFLICT 而非「先查后插」：一次往返、无竞态，
   * 也避免为数千条代码逐条查询。
   *
   * 返回值取插入前后的 count 差值，即**新增数**——更新不改变总数，
   * 故无法由此得出更新条数（日志中只报新增与上游总数）。
   */
  private async upsert(market: CodesMarket, codes: string[]): Promise<number> {
    if (codes.length === 0) return 0

    const before = await this.symbolRepo.count({ where: { market } })

    for (let i = 0; i < codes.length; i += INSERT_BATCH_SIZE) {
      const rows = codes.slice(i, i + INSERT_BATCH_SIZE).map((code) => ({ market, code }))
      await this.symbolRepo
        .createQueryBuilder()
        .insert()
        .into(StockSymbol)
        .values(rows)
        // 冲突键为 code；冲突时只更新 market，且值未变化时不产生写入
        .orUpdate(['market'], ['code'], { skipUpdateIfNoValuesChanged: true })
        .execute()
    }

    const after = await this.symbolRepo.count({ where: { market } })
    return after - before
  }
}
