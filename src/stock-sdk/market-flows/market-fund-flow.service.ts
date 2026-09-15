import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MarketFundFlow as MarketFundFlowItem } from 'stock-sdk'
import { LessThan, Repository } from 'typeorm'
import { normalizeDate, shanghaiDate, shiftDate } from '../../common/utils/date.util'
import { StockSdkService } from '../stock-sdk.service'
import { MarketFundFlow } from './entities/market-fund-flow.entity'
import { RETENTION_DAYS } from './market-fund-flow.constants'

/** 采集选项 */
export interface SyncMarketFundFlowOptions {
  /** 只取数不落库 */
  dryRun?: boolean
}

/** 一次采集的汇总 */
export interface MarketFundFlowSyncSummary {
  /** 上游返回的总条数（含保留期之外的历史） */
  upstreamTotal: number
  /** 保留期内的条数 */
  inRetention: number
  /** 本次新增（已存在的跳过） */
  inserted: number
  /** 清理掉的过期条数 */
  purged: number
  persisted: boolean
  durationMs: number
}

/**
 * 大盘资金流采集服务
 *
 * 每日取沪深大盘资金流落库，保留最近一个月。
 *
 * 与其它资金流任务的区别：上游 `fundFlow.market` 返回的是**按日历史序列**
 * （自带 `date`），而非某一日的快照。因此：
 * - 日期取自数据本身，无需按运行时推导
 * - 落库为增量插入而非覆盖式重写——已收盘交易日的历史值不会变动
 * - 只需写入保留期内的数据：更早的写入后也会被清理，没必要先写一遍
 */
@Injectable()
export class MarketFundFlowService {
  private readonly logger = new Logger(MarketFundFlowService.name)

  constructor(
    private readonly stockSdkService: StockSdkService,
    @InjectRepository(MarketFundFlow)
    private readonly repo: Repository<MarketFundFlow>
  ) {}

  /** 采集并落库 */
  async sync(options: SyncMarketFundFlowOptions = {}): Promise<MarketFundFlowSyncSummary> {
    const startedAt = Date.now()
    const items = await this.stockSdkService.getMarketFundFlow()
    this.logger.log(`大盘资金流上游返回 ${items.length} 条`)

    const cutoff = shiftDate(shanghaiDate(), -RETENTION_DAYS)
    const rows = items
      .filter((item) => normalizeDate(item.date) >= cutoff)
      .map((item) => this.toEntity(item))

    const base = {
      upstreamTotal: items.length,
      inRetention: rows.length,
      inserted: 0,
      purged: 0,
      durationMs: Date.now() - startedAt,
    }

    if (rows.length === 0) {
      this.logger.warn(`上游无 ${cutoff} 之后的数据，跳过落库`)
      return { ...base, persisted: false }
    }

    if (options.dryRun) {
      this.logger.log(`[完成] 保留期内 ${rows.length} 条 (dryRun, 未落库)`)
      return { ...base, persisted: false }
    }

    const inserted = await this.insertMissing(rows)
    const purged = await this.purgeExpired(cutoff)

    this.logger.log(
      `[完成] 新增 ${inserted} 条（保留期内共 ${rows.length} 条）, 耗时 ${Date.now() - startedAt}ms`
    )
    return { ...base, inserted, purged, persisted: true, durationMs: Date.now() - startedAt }
  }

  /** 查询全部（数据量小，一个月约 20 个交易日） */
  async findAll(): Promise<MarketFundFlow[]> {
    return this.repo.find({ order: { tradeDate: 'ASC' } })
  }

  /**
   * 增量插入，已存在的跳过
   *
   * 已收盘交易日的大盘资金流是历史值、不会变动，故用 ON CONFLICT DO NOTHING
   * 而非覆盖式重写。每天实际新增 1 条，其余约 30 条都会被忽略。
   */
  private async insertMissing(rows: Partial<MarketFundFlow>[]): Promise<number> {
    const before = await this.repo.count()
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(MarketFundFlow)
      .values(rows)
      .orIgnore()
      .execute()
    const after = await this.repo.count()
    return after - before
  }

  /**
   * 清理保留期之外的记录
   *
   * 独立于写库：清理失败不影响本次采集（两者重要性不对等），仅记 warn。
   */
  private async purgeExpired(cutoff: string): Promise<number> {
    try {
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

  /** 上游数据 → 实体（日期取自数据本身；字段显式映射，避免错位） */
  private toEntity(item: MarketFundFlowItem): Partial<MarketFundFlow> {
    return {
      tradeDate: normalizeDate(item.date),
      shClose: item.shClose,
      shChangePercent: item.shChangePercent,
      szClose: item.szClose,
      szChangePercent: item.szChangePercent,
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
