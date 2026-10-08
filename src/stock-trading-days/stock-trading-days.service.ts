import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm'
import { ApiThsService } from '../api-ths/api-ths.service'
import { StockTradingDay } from './entities/stock-trading-day.entity'

/** 单次同步的结果统计 */
export interface StockTradingDaysSyncResult {
  /** 上游返回的交易日数 */
  fetched: number
  /** 是否因上一轮同步尚未结束而整体跳过 */
  skipped: boolean
  /** 耗时（毫秒） */
  costMs: number
}

/**
 * 交易日历服务
 *
 * 从同花顺拉取近一年的 A 股交易日并落库，供其他模块查询。
 * 与 `StockSymbolsService` 同一范式（定时 + 启动补齐 + 防重入），差异在于本表是**追加型**数据：
 * 同步只 upsert、不做「标记消失」——上游窗口滑动不应删除更早的交易日。
 */
@Injectable()
export class StockTradingDaysService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StockTradingDaysService.name)

  /** 防重入标志：定时触发、启动补齐、手动调用三者共用 */
  private syncing = false

  constructor(
    @InjectRepository(StockTradingDay) private readonly tradingDayRepo: Repository<StockTradingDay>,
    private readonly thsApi: ApiThsService
  ) {}

  /** 表为空时补齐首次数据（仅首次部署命中；不 await，避免启动被外部 API 拖住） */
  onApplicationBootstrap(): void {
    void this.fillIfEmpty()
  }

  /**
   * 从同花顺同步交易日历并落库
   *
   * 上游固定返回「今日 - 1 年 ~ 今日」的窗口，按 `date` upsert：已有日期更新、
   * 新日期插入。更早的历史保留在表中，不随窗口滑动而消失。
   */
  async syncStockTradingDays(): Promise<StockTradingDaysSyncResult> {
    if (this.syncing) {
      this.logger.warn({ message: '交易日历同步已在进行中, 本轮跳过' })
      return { fetched: 0, skipped: true, costMs: 0 }
    }
    this.syncing = true
    const startedAt = Date.now()

    try {
      const days = await this.thsApi.getTradingDays()

      if (days.length === 0) {
        // 空结果极可能是上游异常，直接写库虽不会删数据，但会把本轮同步变成一次空操作，故显式跳过
        this.logger.warn({ message: '交易日历返回空列表, 已跳过本轮写入' })
        return { fetched: 0, skipped: false, costMs: Date.now() - startedAt }
      }

      const syncAt = new Date()
      const rows = days.map((day) => ({
        date: day.date,
        dateMs: new Date(day.date_ms),
        syncAt,
      }))

      // 约 250 行 × 3 列，远低于 PostgreSQL 绑定参数上限，无需分片
      await this.tradingDayRepo.upsert(rows, ['date'])

      const costMs = Date.now() - startedAt
      this.logger.log({ message: '交易日历同步完成', fetched: days.length, costMs })

      return { fetched: days.length, skipped: false, costMs }
    } finally {
      this.syncing = false
    }
  }

  /**
   * 查询交易日，按日期升序返回
   *
   * `start` / `end` 为 `yyyyMMdd` 格式（含端点）；省略则不过滤该侧。
   * 取「前一交易日」之类的计算直接基于结果做区间判断即可，无需再打上游。
   */
  async listStockTradingDays(start?: string, end?: string): Promise<StockTradingDay[]> {
    const where: FindOptionsWhere<StockTradingDay> = {}
    if (start && end) {
      where.date = Between(start, end)
    } else if (start) {
      where.date = MoreThanOrEqual(start)
    } else if (end) {
      where.date = LessThanOrEqual(end)
    }

    return this.tradingDayRepo.find({ where, order: { date: 'ASC' } })
  }

  /** 表为空时补齐（仅在首次部署时命中） */
  private async fillIfEmpty(): Promise<void> {
    try {
      if ((await this.tradingDayRepo.count()) > 0) return

      this.logger.log({ message: '交易日历表为空, 触发首次同步' })
      await this.syncStockTradingDays()
    } catch (err) {
      this.logger.error({ message: '交易日历首次同步失败', error: err })
    }
  }
}
