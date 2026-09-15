import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { SectorFundFlowItem } from 'stock-sdk'
import { LessThan, Repository } from 'typeorm'
import { normalizeDate, shanghaiDate, shiftDate } from '../../common/utils/date.util'
import { StockSdkService } from '../stock-sdk.service'
import { SectorFundFlow } from './entities/sector-fund-flow.entity'
import { DEFAULT_INDICATOR, DEFAULT_SECTOR_TYPE, RETENTION_DAYS } from './sector-flow.constants'

/** 板块类型 */
export type SectorType = 'industry' | 'concept' | 'region'

/** 排名周期 */
export type RankIndicator = 'today' | '3day' | '5day' | '10day'

/** 采集选项（定时任务与手动触发共用） */
export interface SyncSectorFlowOptions {
  /** 指定数据所属交易日（补跑），不传则取最近一个已完成交易日 */
  tradeDate?: string
  /** 板块类型，默认 industry */
  sectorType?: SectorType
  /** 排名周期，默认 today */
  indicator?: RankIndicator
  /** 只取数不落库 */
  dryRun?: boolean
}

/** 一次采集的汇总 */
export interface SectorFlowSyncSummary {
  tradeDate: string
  sectorType: SectorType
  indicator: RankIndicator
  /** 上游返回的板块数 */
  total: number
  /** 是否已落库（dryRun 为 false） */
  persisted: boolean
  /** 清理掉的过期记录数 */
  purged: number
  durationMs: number
}

/**
 * 板块资金流采集服务
 *
 * 每日取板块资金流排名落库，每个交易日一批，保留最近一个月。
 */
@Injectable()
export class SectorFlowService {
  private readonly logger = new Logger(SectorFlowService.name)

  constructor(
    private readonly stockSdkService: StockSdkService,
    @InjectRepository(SectorFundFlow)
    private readonly repo: Repository<SectorFundFlow>
  ) {}

  /** 采集并落库 */
  async sync(options: SyncSectorFlowOptions = {}): Promise<SectorFlowSyncSummary> {
    const startedAt = Date.now()
    const tradeDate = options.tradeDate
      ? normalizeDate(options.tradeDate)
      : await this.resolveLatestTradeDate()
    const sectorType = options.sectorType ?? DEFAULT_SECTOR_TYPE
    const indicator = options.indicator ?? DEFAULT_INDICATOR

    const items = await this.stockSdkService.getSectorFundFlowRank(indicator, sectorType)
    this.logger.log(`[${tradeDate}] ${sectorType}/${indicator} 上游返回 ${items.length} 条`)

    const base = {
      tradeDate,
      sectorType,
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

    const rows = items.map((item, index) =>
      this.toEntity(item, index + 1, tradeDate, sectorType, indicator)
    )
    await this.persist(rows, tradeDate, sectorType, indicator)
    const purged = await this.purgeExpired(tradeDate)

    this.logger.log(
      `[完成] ${tradeDate} ${sectorType}/${indicator} 入库 ${items.length} 条, 耗时 ${Date.now() - startedAt}ms`
    )
    return { ...base, persisted: true, purged, durationMs: Date.now() - startedAt }
  }

  /** 按交易日查询（可选按板块类型过滤） */
  async getByDate(tradeDate: string, sectorType?: SectorType): Promise<SectorFundFlow[]> {
    return this.repo.find({
      where: { tradeDate: normalizeDate(tradeDate), ...(sectorType ? { sectorType } : {}) },
      order: { rank: 'ASC' },
    })
  }

  /** 查询最近一批 */
  async getLatest(): Promise<{ tradeDate: string; rows: SectorFundFlow[] } | null> {
    const latest = await this.repo.findOne({ where: {}, order: { tradeDate: 'DESC' } })
    if (!latest) return null

    const rows = await this.repo.find({
      where: {
        tradeDate: latest.tradeDate,
        sectorType: latest.sectorType,
        indicator: latest.indicator,
      },
      order: { rank: 'ASC' },
    })
    return { tradeDate: latest.tradeDate, rows }
  }

  /**
   * 取数据归属的交易日
   *
   * 任务在 A 股收盘后的下午 5 点执行，当天数据已产生，故：
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

  /** 覆盖式落库：先清同批旧记录，保证重跑不残留 */
  private async persist(
    rows: Partial<SectorFundFlow>[],
    tradeDate: string,
    sectorType: SectorType,
    indicator: RankIndicator
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.delete(SectorFundFlow, { tradeDate, sectorType, indicator })
      await manager.save(rows.map((row) => manager.create(SectorFundFlow, row)))
    })
    this.logger.log(`[落库] ${tradeDate} ${sectorType}/${indicator} 写入 ${rows.length} 条`)
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
    item: SectorFundFlowItem,
    rank: number,
    tradeDate: string,
    sectorType: SectorType,
    indicator: RankIndicator
  ): Partial<SectorFundFlow> {
    return {
      tradeDate,
      sectorType,
      indicator,
      rank,
      code: item.code,
      name: item.name,
      changePercent: item.changePercent,
      mainNetInflow: item.mainNetInflow,
      mainNetInflowPercent: item.mainNetInflowPercent,
      superLargeNetInflow: item.superLargeNetInflow,
      largeNetInflow: item.largeNetInflow,
      mediumNetInflow: item.mediumNetInflow,
      smallNetInflow: item.smallNetInflow,
      topStockName: item.topStockName ?? null,
      topStockCode: item.topStockCode ?? null,
    }
  }
}
