import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { FundFlowRankItem } from 'stock-sdk'
import { LessThan, Repository } from 'typeorm'
import { normalizeDate, shanghaiDate, shiftDate } from '../../common/utils/date.util'
import { StockSdkService } from '../stock-sdk.service'
import { StockFundFlow } from './entities/stock-fund-flow.entity'
import { DEFAULT_INDICATOR, INSERT_BATCH_SIZE, RETENTION_DAYS } from './stock-fund-flow.constants'

/** 排名周期 */
export type RankIndicator = 'today' | '3day' | '5day' | '10day'

/** 采集选项（定时任务与手动触发共用） */
export interface SyncStockFundFlowOptions {
  /** 指定数据所属交易日（补跑），不传则取当天或之前最近的交易日 */
  tradeDate?: string
  /** 排名周期，默认 today */
  indicator?: RankIndicator
  /** 只取数不落库 */
  dryRun?: boolean
}

/** 分页查询选项 */
export interface QueryStockFundFlowOptions {
  tradeDate?: string
  indicator?: RankIndicator
  skip: number
  take: number
}

/** 分页查询结果 */
export interface StockFundFlowPage {
  tradeDate: string | null
  indicator: RankIndicator | null
  /** 该批次的记录总数（不受分页影响） */
  total: number
  rows: StockFundFlow[]
}

/** 一次采集的汇总 */
export interface StockFundFlowSyncSummary {
  tradeDate: string
  indicator: RankIndicator
  /** 上游返回的个股数 */
  total: number
  /** 是否已落库（dryRun 为 false） */
  persisted: boolean
  /** 清理掉的过期记录数 */
  purged: number
  durationMs: number
}

/**
 * 个股资金流排名采集服务
 *
 * 每日取全市场个股资金流排名落库，每个交易日一批，保留最近一个月。
 *
 * 与板块同类任务的区别在于**数据量**：单日数千条，故落库用分批 insert
 * 而非逐条 save（后者会生成数千次 SQL）。
 */
@Injectable()
export class StockFundFlowService {
  private readonly logger = new Logger(StockFundFlowService.name)

  constructor(
    private readonly stockSdkService: StockSdkService,
    @InjectRepository(StockFundFlow)
    private readonly repo: Repository<StockFundFlow>
  ) {}

  /** 采集并落库 */
  async sync(options: SyncStockFundFlowOptions = {}): Promise<StockFundFlowSyncSummary> {
    const startedAt = Date.now()
    const tradeDate = options.tradeDate
      ? normalizeDate(options.tradeDate)
      : await this.resolveLatestTradeDate()
    const indicator = options.indicator ?? DEFAULT_INDICATOR

    const items = await this.stockSdkService.getFundFlowRank(indicator)
    this.logger.log(`[${tradeDate}] 个股资金流排名 ${indicator} 上游返回 ${items.length} 条`)

    const base = {
      tradeDate,
      indicator,
      total: items.length,
      purged: 0,
      durationMs: Date.now() - startedAt,
    }

    // 空数据视为上游异常：跳过落库，避免把已有记录清成空
    if (items.length === 0) {
      this.logger.warn('上游返回空数据，跳过落库以免误删已有记录')
      return { ...base, persisted: false }
    }

    if (options.dryRun) {
      this.logger.log(`[完成] ${tradeDate} 采集 ${items.length} 条 (dryRun, 未落库)`)
      return { ...base, persisted: false }
    }

    const rows = items.map((item, index) => this.toEntity(item, index + 1, tradeDate, indicator))
    await this.persist(rows, tradeDate, indicator)
    const purged = await this.purgeExpired(tradeDate)

    this.logger.log(
      `[完成] ${tradeDate} ${indicator} 入库 ${items.length} 条, 耗时 ${Date.now() - startedAt}ms`
    )
    return { ...base, persisted: true, purged, durationMs: Date.now() - startedAt }
  }

  /**
   * 分页查询
   *
   * 单日数据为全市场个股（数千条），必须分页——不像板块接口可以整批返回。
   * 未指定交易日时自动定位最近一批。
   */
  async query(options: QueryStockFundFlowOptions): Promise<StockFundFlowPage> {
    let tradeDate = options.tradeDate ? normalizeDate(options.tradeDate) : undefined
    let indicator = options.indicator

    if (!tradeDate) {
      const latest = await this.repo.findOne({ where: {}, order: { tradeDate: 'DESC' } })
      if (!latest) return { tradeDate: null, indicator: null, total: 0, rows: [] }
      tradeDate = latest.tradeDate
      indicator = indicator ?? (latest.indicator as RankIndicator)
    }

    const [rows, total] = await this.repo.findAndCount({
      where: { tradeDate, ...(indicator ? { indicator } : {}) },
      order: { rank: 'ASC' },
      skip: options.skip,
      take: options.take,
    })
    return { tradeDate, indicator: indicator ?? null, total, rows }
  }

  /**
   * 取数据归属的交易日
   *
   * 任务在 A 股收盘后的下午 4 点执行，当天数据已产生，故：
   * - 今天是交易日 → 归属当天
   * - 否则（周末 / 节假日）→ 归属之前最近的交易日
   */
  private async resolveLatestTradeDate(): Promise<string> {
    const calendar = await this.stockSdkService.getTradingCalendar()
    const today = shanghaiDate()
    const latest = calendar.filter((d) => d <= today).pop()
    if (!latest) {
      throw new Error(`交易日历中找不到 ${today} 及之前的交易日，需更新日历`)
    }
    return latest
  }

  /** 覆盖式落库：先清同批旧记录，再分批插入 */
  private async persist(
    rows: Partial<StockFundFlow>[],
    tradeDate: string,
    indicator: RankIndicator
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.delete(StockFundFlow, { tradeDate, indicator })
      for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        await manager.insert(StockFundFlow, rows.slice(i, i + INSERT_BATCH_SIZE))
      }
    })
    this.logger.log(`[落库] ${tradeDate} ${indicator} 写入 ${rows.length} 条`)
  }

  /**
   * 清理超过保留期的记录
   *
   * 独立于写库事务：清理失败不能回滚当天的采集结果（两者重要性不对等）。
   * 以 tradeDate 而非 createAt 为界——"保存一个月"的业务含义是最近一个月的交易日数据。
   */
  private async purgeExpired(currentTradeDate: string): Promise<number> {
    try {
      const cutoff = shiftDate(currentTradeDate, -RETENTION_DAYS)
      const result = await this.repo.delete({ tradeDate: LessThan(cutoff) })
      const removed = result.affected ?? 0
      if (removed > 0) {
        this.logger.log(`[清理] 删除 ${cutoff} 之前的记录 ${removed} 条`)
      }
      return removed
    } catch (err) {
      this.logger.warn(`清理过期记录失败: ${err instanceof Error ? err.message : err}`)
      return 0
    }
  }

  /** 上游数据 → 实体（rank 取上游返回顺序；字段显式映射，避免错位） */
  private toEntity(
    item: FundFlowRankItem,
    rank: number,
    tradeDate: string,
    indicator: RankIndicator
  ): Partial<StockFundFlow> {
    return {
      tradeDate,
      indicator,
      rank,
      code: item.code,
      name: item.name,
      price: item.price,
      changePercent: item.changePercent,
      mainNetInflow: item.mainNetInflow,
      mainNetInflowPercent: item.mainNetInflowPercent,
      superLargeNetInflow: item.superLargeNetInflow,
      superLargeNetInflowPercent: item.superLargeNetInflowPercent,
      largeNetInflow: item.largeNetInflow,
      largeNetInflowPercent: item.largeNetInflowPercent,
      mediumNetInflow: item.mediumNetInflow,
      mediumNetInflowPercent: item.mediumNetInflowPercent,
      smallNetInflow: item.smallNetInflow,
      smallNetInflowPercent: item.smallNetInflowPercent,
    }
  }
}
