import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RunMarketSyncDto } from './dto/run-market-sync.dto'
import { MarketFundFlowService } from './market-fund-flow.service'

/**
 * 大盘资金流控制器
 *
 * 定时任务每天 16:30（A 股收盘后）自动采集，这两个接口用于手动触发与查询。
 */
@Controller('stock-sdk/market-flows')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class MarketFundFlowController {
  constructor(private readonly marketFundFlowService: MarketFundFlowService) {}

  /**
   * 手动触发一次采集（首次初始化 / 补跑）
   * POST /api/stock-sdk/market-flows/sync
   */
  @Post('sync')
  async sync(@Body() dto: RunMarketSyncDto) {
    const data = await this.marketFundFlowService.sync({ dryRun: dto.dryRun })
    return { code: 200, message: '执行完成', data }
  }

  /**
   * 查询最近一个月的大盘资金流（按日期升序）
   * GET /api/stock-sdk/market-flows
   */
  @Get()
  async findAll() {
    const data = await this.marketFundFlowService.findAll()
    return { code: 200, message: '获取成功', data }
  }
}
