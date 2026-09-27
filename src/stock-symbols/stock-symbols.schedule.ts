import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { STOCK_SYMBOLS_SYNC_CRON, STOCK_SYMBOLS_SYNC_TIMEZONE } from './stock-symbols.constants'
import { StockSymbolsService } from './stock-symbols.service'

/**
 * 标的同步定时任务
 *
 * 触发时机与业务实现分离：本类只负责「什么时候跑」与异常收口，
 * 同步逻辑在 `StockSymbolsService.syncSymbols()`，便于单独测试与手动调用。
 */
@Injectable()
export class StockSymbolsSchedule {
  private readonly logger = new Logger(StockSymbolsSchedule.name)

  constructor(private readonly stockSymbolsService: StockSymbolsService) {}

  /**
   * 定时入口：每交易日收盘后同步标的代码表
   *
   * 框架本身已为 `@Cron` 方法包了 try/catch（以 `Scheduler` 为名的 logger 记录），
   * 异常并不会影响后续触发；此处仍显式收口，是为了记结构化日志并带上任务上下文。
   */
  @Cron(STOCK_SYMBOLS_SYNC_CRON, { timeZone: STOCK_SYMBOLS_SYNC_TIMEZONE })
  async handleSync(): Promise<void> {
    try {
      await this.stockSymbolsService.syncSymbols()
    } catch (err) {
      this.logger.error({ message: '标的定时同步失败', error: err })
    }
  }
}
