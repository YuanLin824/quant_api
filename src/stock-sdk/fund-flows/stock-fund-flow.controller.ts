import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { GetStockFundFlowDto } from './dto/get-stock-fund-flow.dto'
import { RunStockFundFlowDto } from './dto/run-stock-fund-flow.dto'
import { StockFundFlowService } from './stock-fund-flow.service'

/**
 * 个股资金流排名控制器
 *
 * 定时任务每天 16:00（A 股收盘后）自动采集，这两个接口用于手动触发与查询结果。
 *
 * 与板块接口不同，单日数据为全市场个股（数千条），查询接口强制分页。
 */
@Controller('stock-sdk/fund-flows')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class StockFundFlowController {
  constructor(private readonly stockFundFlowService: StockFundFlowService) {}

  /**
   * 手动触发一次采集（首次初始化 / 补跑 / 采集其他排名周期）
   * POST /api/stock-sdk/fund-flows/sync
   */
  @Post('sync')
  async sync(@Body() dto: RunStockFundFlowDto) {
    const data = await this.stockFundFlowService.sync({
      tradeDate: dto.tradeDate,
      indicator: dto.indicator,
      dryRun: dto.dryRun,
    })
    return { code: 200, message: '执行完成', data }
  }

  /**
   * 分页查询；不传 date 则返回最近一批
   * GET /api/stock-sdk/fund-flows?date=2026-09-14&page=1&pageSize=50
   */
  @Get()
  async query(@Query() dto: GetStockFundFlowDto) {
    const page = dto.page ?? 1
    const pageSize = dto.pageSize ?? 50
    const data = await this.stockFundFlowService.query({
      tradeDate: dto.date,
      indicator: dto.indicator,
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return { code: 200, message: '获取成功', data }
  }
}
