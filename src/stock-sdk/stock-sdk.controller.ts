import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { GetFundQuotesDto, GetQuotesBodyDto, GetQuotesParamsDto, SearchDto } from './dto'
import {
  BatchByCodesDto,
  GetAllQuotesParamsDto,
  GetAllQuotesQueryDto,
} from './dto/batch-quotes.dto'
import { StockSdkService } from './stock-sdk.service'

/**
 * Stock SDK 控制器
 *
 * 提供股票行情、基金净值和搜索功能。
 * 所有接口需要 JWT 认证，不限流。
 */
@Controller('stock-sdk')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class StockSdkController {
  constructor(private readonly stockSdkService: StockSdkService) {}

  /**
   * 批量获取股票行情
   * POST /api/stock-sdk/quotes/:market
   */
  @Post('quotes/:market')
  async getQuotes(@Param() params: GetQuotesParamsDto, @Body() body: GetQuotesBodyDto) {
    const data = await this.stockSdkService.getQuotes(params.market, body.codes)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 批量获取基金行情
   * POST /api/stock-sdk/funds
   */
  @Post('funds')
  async getFundQuotes(@Body() dto: GetFundQuotesDto) {
    const data = await this.stockSdkService.getFundQuotes(dto.codes)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 搜索股票/指数/基金
   * GET /api/stock-sdk/search?keyword=茅台
   */
  @Get('search')
  async search(@Query() dto: SearchDto) {
    const data = await this.stockSdkService.search(dto.keyword)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取全部市场行情
   * GET /api/stock-sdk/batch/:market?batchSize=500&concurrency=7
   */
  @Get('batch/:market')
  async getAllQuotes(@Param() params: GetAllQuotesParamsDto, @Query() query: GetAllQuotesQueryDto) {
    const data = await this.stockSdkService.getAllQuotes(
      params.market,
      query.batchSize,
      query.concurrency
    )
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 按代码批量获取行情
   * POST /api/stock-sdk/batch
   */
  @Post('batch')
  async batchByCodes(@Body() dto: BatchByCodesDto) {
    const data = await this.stockSdkService.batchByCodes(dto.codes, dto.batchSize, dto.concurrency)
    return { code: 200, message: '获取成功', data }
  }
}
