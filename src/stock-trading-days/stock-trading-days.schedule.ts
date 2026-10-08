import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  STOCK_TRADING_DAYS_SYNC_CRON,
  STOCK_TRADING_DAYS_SYNC_TIMEZONE,
} from './stock-trading-days.constants'
import { StockTradingDaysService } from './stock-trading-days.service'

/**
 * 交易日历同步定时任务
 *
 * 触发时机与业务实现分离：本类只负责「什么时候跑」与异常收口，
 * 同步逻辑在 `StockTradingDaysService.syncStockTradingDays()`，便于单独测试与手动调用。
 */
@Injectable()
export class StockTradingDaysSchedule {
  private readonly logger = new Logger(StockTradingDaysSchedule.name)

  constructor(private readonly tradingDaysService: StockTradingDaysService) {}

  /**
   * 定时入口：每天凌晨 3 点同步交易日历
   *
   * 框架本身已为 `@Cron` 方法包了 try/catch（以 `Scheduler` 为名的 logger 记录），
   * 异常并不会影响后续触发；此处仍显式收口，是为了记结构化日志并带上任务上下文。
   */
  @Cron(STOCK_TRADING_DAYS_SYNC_CRON, { timeZone: STOCK_TRADING_DAYS_SYNC_TIMEZONE })
  async handleSync(): Promise<void> {
    try {
      await this.tradingDaysService.syncStockTradingDays()
    } catch (err) {
      this.logger.error({ message: '交易日历定时同步失败', error: err })
    }
  }
}
