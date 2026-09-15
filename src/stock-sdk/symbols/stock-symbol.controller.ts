import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { GetSymbolsDto } from './dto/get-symbols.dto'
import { StockSymbolService } from './stock-symbol.service'

/**
 * 标的代码控制器
 *
 * 定时任务每天 09:00（开盘前）自动同步，这两个接口用于手动触发与查询结果。
 */
@Controller('stock-sdk/symbols')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class StockSymbolController {
  constructor(private readonly symbolService: StockSymbolService) {}

  /**
   * 手动触发一次同步（首次初始化 / 失败补跑）
   * POST /api/stock-sdk/symbols/sync
   */
  @Post('sync')
  async sync() {
    const data = await this.symbolService.syncAll()
    return { code: 200, message: '同步完成', data }
  }

  /**
   * 查询代码：传 market 返回该市场代码列表，不传返回各市场数量统计
   * GET /api/stock-sdk/symbols?market=cn
   */
  @Get()
  async getSymbols(@Query() dto: GetSymbolsDto) {
    const data = dto.market
      ? await this.symbolService.getByMarket(dto.market)
      : await this.symbolService.getStats()
    return { code: 200, message: '获取成功', data }
  }
}
