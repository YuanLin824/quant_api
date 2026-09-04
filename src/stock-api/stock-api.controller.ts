import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  GetKlinesParamsDto,
  GetKlinesQueryDto,
  GetStockDto,
  GetStocksDto,
  SearchStocksDto,
} from './dto'
import { StockApiService } from './stock-api.service'

/**
 * 股票行情控制器
 *
 * 提供股票行情查询、K线数据获取和股票搜索功能。
 * 所有接口需要 JWT 认证，不限流（行情数据为公开信息，且 stock-api 已有兜底机制）。
 */
@Controller('stock-api')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class StockApiController {
  constructor(private readonly stockApiService: StockApiService) {}

  /**
   * 获取单只股票行情
   * GET /api/stock-api/quote/:market/:code
   */
  @Get('quote/:market/:code')
  async getStock(@Param() params: GetStockDto) {
    const data = await this.stockApiService.getStock(params.market, params.code)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 批量获取股票行情
   * POST /api/stock-api/quotes
   */
  @Post('quotes')
  async getStocks(@Body() dto: GetStocksDto) {
    const data = await this.stockApiService.getStocks(dto.codes)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取K线数据
   * GET /api/stock-api/kline/:market/:code?period=day&count=120
   */
  @Get('kline/:market/:code')
  async getKlines(@Param() params: GetKlinesParamsDto, @Query() query: GetKlinesQueryDto) {
    const data = await this.stockApiService.getKlines(
      params.market,
      params.code,
      query.period,
      query.count
    )
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 搜索股票
   * GET /api/stock-api/search?keyword=茅台
   */
  @Get('search')
  async searchStocks(@Query() dto: SearchStocksDto) {
    const data = await this.stockApiService.searchStocks(dto.keyword)
    return { code: 200, message: '获取成功', data }
  }
}
