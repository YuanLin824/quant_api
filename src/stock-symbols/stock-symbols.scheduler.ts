import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  STOCK_SYMBOLS_SYNC_CRON,
  STOCK_SYMBOLS_SYNC_JOB_NAME,
  STOCK_SYMBOLS_TIMEZONE,
} from './stock-symbols.constants'
import { StockSymbolsService } from './stock-symbols.service'

/**
 * 标的代码同步调度器
 *
 * 每天 08:00（Asia/Shanghai）拉取 A股/港股/美股/基金的全部代码并增量入库。
 * 选在开盘前：避开交易时段，当日代码库在盘中查询前已是最新，
 * 也早于 16:00 的 K 线同步（后者要读这张表取待同步的代码）。
 *
 * 两条约束：
 * 1. **必须显式指定 timeZone**——容器多为 UTC，不指定会与北京时间的「早上 8 点」相差 8 小时
 * 2. **绝不向调度器抛异常**——全局 AllExceptionsFilter 依赖 HTTP 上下文
 *    （`host.switchToHttp()` / `httpAdapter.reply()`），cron 抛出的异常进入该过滤器
 *    会在 `getResponse()` 处二次报错，把真实错误盖掉
 */
@Injectable()
export class StockSymbolsScheduler {
  private readonly logger = new Logger(StockSymbolsScheduler.name)

  constructor(private readonly symbolsService: StockSymbolsService) {}

  @Cron(STOCK_SYMBOLS_SYNC_CRON, {
    name: STOCK_SYMBOLS_SYNC_JOB_NAME,
    timeZone: STOCK_SYMBOLS_TIMEZONE,
    // 上次未跑完则跳过本次，避免同进程内重入
    waitForCompletion: true,
  })
  async handleDaily(): Promise<void> {
    try {
      const summary = await this.symbolsService.syncAll()
      const detail = summary.results
        .map((result) => `${result.market}:${result.error ? '失败' : result.stored}`)
        .join(' ')
      this.logger.log(`标的代码同步完成, 耗时 ${summary.durationMs}ms — ${detail}`)
    } catch (err) {
      this.logger.error(
        `标的代码同步任务异常: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined
      )
    }
  }
}
