import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  STOCK_FUND_FLOW_SYNC_CRON,
  STOCK_FUND_FLOW_SYNC_JOB_NAME,
  STOCK_FUND_FLOW_TIMEZONE,
} from './stock-fund-flow.constants'
import { StockFundFlowService } from './stock-fund-flow.service'

/**
 * 个股资金流排名采集调度器
 *
 * 每天 16:00（Asia/Shanghai）采集全市场个股资金流排名并落库。
 * 选在下午 4 点：A 股 15:00 已收盘，当日资金流数据完整。
 *
 * 两条约束：
 * 1. **必须显式指定 timeZone**——容器多为 UTC，不指定会与北京时间相差 8 小时
 * 2. **绝不向调度器抛异常**——全局 AllExceptionsFilter 依赖 HTTP 上下文
 *   （`host.switchToHttp()` / `httpAdapter.reply()`），捕获 cron 异常会在过滤器内二次报错
 */
@Injectable()
export class StockFundFlowScheduler {
  private readonly logger = new Logger(StockFundFlowScheduler.name)

  constructor(private readonly stockFundFlowService: StockFundFlowService) {}

  @Cron(STOCK_FUND_FLOW_SYNC_CRON, {
    name: STOCK_FUND_FLOW_SYNC_JOB_NAME,
    timeZone: STOCK_FUND_FLOW_TIMEZONE,
    // 上次未跑完则跳过本次，避免同进程内重入
    waitForCompletion: true,
  })
  async handleDaily(): Promise<void> {
    try {
      await this.stockFundFlowService.sync()
    } catch (err) {
      this.logger.error(
        `个股资金流采集任务异常: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined
      )
    }
  }
}
