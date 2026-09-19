import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  STOCK_KLINE_SYNC_CRON,
  STOCK_KLINE_SYNC_JOB_NAME,
  STOCK_KLINE_TIMEZONE,
} from './stock-kline.constants'
import { StockKlineService } from './stock-kline.service'

/**
 * 日 K 线同步调度器
 *
 * 每天 16:00（Asia/Shanghai）**盘后**同步 A 股全市场日线。
 * 选在盘后而非凌晨：当日行情已收盘，当天数据即可入库，不必等到次日。
 *
 * 两条约束（与 symbols 调度器相同）：
 * 1. **必须显式指定 timeZone**——容器多为 UTC，不指定会与北京时间相差 8 小时
 * 2. **绝不向调度器抛异常**——全局 AllExceptionsFilter 依赖 HTTP 上下文
 *    （`host.switchToHttp()` / `httpAdapter.reply()`），cron 抛出的异常进入该过滤器
 *    会在 `getResponse()` 处二次报错，把真实错误盖掉
 */
@Injectable()
export class StockKlineScheduler {
  private readonly logger = new Logger(StockKlineScheduler.name)

  constructor(private readonly klinesService: StockKlineService) {}

  @Cron(STOCK_KLINE_SYNC_CRON, {
    name: STOCK_KLINE_SYNC_JOB_NAME,
    timeZone: STOCK_KLINE_TIMEZONE,
    // 上次未跑完则跳过本次，避免同进程内重入
    waitForCompletion: true,
  })
  async handleDaily(): Promise<void> {
    try {
      const result = await this.klinesService.sync()
      this.logger.log(
        `日K线同步完成 [${result.mode}] ${result.succeeded}/${result.total} 只, 写入 ${result.rows} 行, 耗时 ${result.durationMs}ms`
      )
    } catch (err) {
      this.logger.error(
        `日K线同步任务异常: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined
      )
    }
  }
}
