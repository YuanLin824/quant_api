import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  SECTOR_FLOW_SYNC_CRON,
  SECTOR_FLOW_SYNC_JOB_NAME,
  SECTOR_FLOW_TIMEZONE,
} from './sector-flow.constants'
import { SectorFlowService } from './sector-flow.service'

/**
 * 板块资金流采集调度器
 *
 * 每天 17:00（Asia/Shanghai）采集行业板块资金流排名并落库。
 * 选在下午 5 点：A 股 15:00 已收盘，当日资金流数据完整，无需等到次日凌晨。
 *
 * 两条约束：
 * 1. **必须显式指定 timeZone**——容器多为 UTC，不指定会与北京时间相差 8 小时
 * 2. **绝不向调度器抛异常**——全局 AllExceptionsFilter 依赖 HTTP 上下文
 *   （`host.switchToHttp()` / `httpAdapter.reply()`），捕获 cron 异常会在过滤器内二次报错
 */
@Injectable()
export class SectorFlowScheduler {
  private readonly logger = new Logger(SectorFlowScheduler.name)

  constructor(private readonly sectorFlowService: SectorFlowService) {}

  @Cron(SECTOR_FLOW_SYNC_CRON, {
    name: SECTOR_FLOW_SYNC_JOB_NAME,
    timeZone: SECTOR_FLOW_TIMEZONE,
    // 上次未跑完则跳过本次，避免同进程内重入
    waitForCompletion: true,
  })
  async handleDaily(): Promise<void> {
    try {
      await this.sectorFlowService.sync()
    } catch (err) {
      this.logger.error(
        `板块资金流采集任务异常: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined
      )
    }
  }
}
