import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { StockService } from './stock.service'
import { GetStockDto, GetStocksDto, KlinePeriod, SearchStocksDto } from './stock.types'

/**
 * 股票行情控制器
 *
 * 提供股票行情查询、K线数据获取和股票搜索功能。
 * 所有接口需要 JWT 认证，不限流（行情数据为公开信息，且 stock-api 已有兜底机制）。
 */
@Controller('stock')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  /**
   * 获取单只股票行情
   * GET /api/stock/quote/:market/:code
   */
  @Get('quote/:market/:code')
  async getStock(@Param() params: GetStockDto) {
    const data = await this.stockService.getStock(params.market, params.code)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 批量获取股票行情
   * POST /api/stock/quotes
   */
  @Post('quotes')
  async getStocks(@Body() dto: GetStocksDto) {
    const data = await this.stockService.getStocks(dto.codes)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取K线数据
   * GET /api/stock/kline/:market/:code?period=day&count=120
   */
  @Get('kline/:market/:code')
  async getKlines(
    @Param() params: GetStockDto,
    @Query('period') period: KlinePeriod = KlinePeriod.DAY,
    @Query('count') count: number = 120
  ) {
    const data = await this.stockService.getKlines(params.market, params.code, period, count)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 搜索股票
   * GET /api/stock/search?keyword=茅台
   */
  @Get('search')
  async searchStocks(@Query() dto: SearchStocksDto) {
    const data = await this.stockService.searchStocks(dto.keyword)
    return { code: 200, message: '获取成功', data }
  }
}
