import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  STOCK_SYMBOL_SYNC_CRON,
  STOCK_SYMBOL_SYNC_JOB_NAME,
  STOCK_SYMBOL_TIMEZONE,
} from './stock-symbol.constants'
import { StockSymbolService } from './stock-symbol.service'

/**
 * 标的代码同步调度器
 *
 * 每天 01:00（Asia/Shanghai）拉取 A股/美股/港股/基金代码并增量入库。
 * 选在凌晨 1 点：此时无交易、上游压力小。
 *
 * 两条约束：
 * 1. **必须显式指定 timeZone**——容器多为 UTC，不指定会让凌晨 1 点变成北京时间上午 9 点（开盘时分）
 * 2. **绝不向调度器抛异常**——全局 AllExceptionsFilter 依赖 HTTP 上下文
 *    （`host.switchToHttp()` / `httpAdapter.reply()`），捕获 cron 异常会在过滤器内二次报错
 */
@Injectable()
export class StockSymbolScheduler {
  private readonly logger = new Logger(StockSymbolScheduler.name)

  constructor(private readonly symbolService: StockSymbolService) {}

  @Cron(STOCK_SYMBOL_SYNC_CRON, {
    name: STOCK_SYMBOL_SYNC_JOB_NAME,
    timeZone: STOCK_SYMBOL_TIMEZONE,
    // 上次未跑完则跳过本次，避免同进程内重入
    waitForCompletion: true,
  })
  async handleDaily(): Promise<void> {
    try {
      const summary = await this.symbolService.syncAll()
      this.logger.log(`标的代码同步完成, 耗时 ${summary.durationMs}ms`)
    } catch (err) {
      this.logger.error(
        `标的代码同步任务异常: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined
      )
    }
  }
}
