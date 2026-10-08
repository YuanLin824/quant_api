import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  STOCK_KLINE_DAILY_SYNC_CRON,
  STOCK_KLINE_MINUTE_SYNC_CRON,
  STOCK_KLINE_SYNC_TIMEZONE,
} from './stock-kline.constants'
import { StockKlineService } from './stock-kline.service'

/**
 * K 线同步定时任务
 *
 * 触发时机与业务实现分离：本类只负责「什么时候跑」与异常收口，
 * 同步逻辑在 `StockKlineService.syncDailyKlines()` / `syncMinuteKlines()`，便于单独测试。
 */
@Injectable()
export class StockKlineSchedule {
  private readonly logger = new Logger(StockKlineSchedule.name)

  constructor(private readonly klineService: StockKlineService) {}

  /**
   * 定时入口：每周一至周五 17:45 同步日 K
   *
   * 排在 17:30 的标的代码表同步之后——当夜新上市的标的会被立即纳入回补。
   * 框架本身已为 `@Cron` 方法包了 try/catch（以 `Scheduler` 为名的 logger 记录），
   * 异常并不会影响后续触发；此处仍显式收口，是为了记结构化日志并带上任务上下文。
   */
  @Cron(STOCK_KLINE_DAILY_SYNC_CRON, { timeZone: STOCK_KLINE_SYNC_TIMEZONE })
  async handleDailySync(): Promise<void> {
    try {
      await this.klineService.syncDailyKlines()
    } catch (err) {
      this.logger.error({ message: '日 K 定时同步失败', error: err })
    }
  }

  /** 定时入口：每周一至周五 19:00 同步分钟 K（与日 K 错峰，避免两个长任务重叠） */
  @Cron(STOCK_KLINE_MINUTE_SYNC_CRON, { timeZone: STOCK_KLINE_SYNC_TIMEZONE })
  async handleMinuteSync(): Promise<void> {
    try {
      await this.klineService.syncMinuteKlines()
    } catch (err) {
      this.logger.error({ message: '分钟 K 定时同步失败', error: err })
    }
  }
}
