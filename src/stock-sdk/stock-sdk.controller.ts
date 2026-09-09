import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { GetFundQuotesDto, GetQuotesBodyDto, GetQuotesParamsDto, SearchDto } from './dto'
import {
  BatchByCodesDto,
  GetAllQuotesParamsDto,
  GetAllQuotesQueryDto,
} from './dto/batch-quotes.dto'
import { GetCodesDto } from './dto/get-codes.dto'
import { GetKlineSignalsParamsDto, GetKlineSignalsQueryDto } from './dto/get-kline-signals.dto'
import {
  GetKlineWithIndicatorsParamsDto,
  GetKlineWithIndicatorsQueryDto,
} from './dto/get-kline-with-indicators.dto'
import { GetKlineParamsDto, GetKlineQueryDto, GetMinuteKlineQueryDto } from './dto/get-kline.dto'
import { GetLargeOrderDto } from './dto/get-large-order.dto'
import { StockSdkService } from './stock-sdk.service'

/**
 * Stock SDK 控制器
 *
 * 提供股票行情、K线数据、基金净值和搜索功能。
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
   * 获取大单数据
   * POST /api/stock-sdk/large-order
   */
  @Post('large-order')
  async getLargeOrder(@Body() dto: GetLargeOrderDto) {
    const data = await this.stockSdkService.getLargeOrder(dto.codes)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取代码列表
   * GET /api/stock-sdk/codes/:market
   */
  @Get('codes/:market')
  async getCodes(@Param() params: GetCodesDto) {
    const data = await this.stockSdkService.getCodes(params.market)
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

  /**
   * 获取历史K线数据
   * GET /api/stock-sdk/kline/:market/:code?period=daily&adjust=qfq
   */
  @Get('kline/:market/:code')
  async getKline(@Param() params: GetKlineParamsDto, @Query() query: GetKlineQueryDto) {
    const data = await this.stockSdkService.getKline(
      params.market,
      params.code,
      query.period,
      query.adjust,
      query.startDate,
      query.endDate
    )
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取分钟K线数据
   * GET /api/stock-sdk/kline/:market/:code/minute?period=5&adjust=qfq
   */
  @Get('kline/:market/:code/minute')
  async getMinuteKline(@Param() params: GetKlineParamsDto, @Query() query: GetMinuteKlineQueryDto) {
    const data = await this.stockSdkService.getMinuteKline(
      params.market,
      params.code,
      query.period,
      query.adjust,
      query.startDate,
      query.endDate
    )
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取带技术指标的K线数据
   * GET /api/stock-sdk/kline/:market/:code/indicators?period=daily&indicators={"ma":[5,10,20]}
   */
  @Get('kline/:market/:code/indicators')
  async getKlineWithIndicators(
    @Param() params: GetKlineWithIndicatorsParamsDto,
    @Query() query: GetKlineWithIndicatorsQueryDto
  ) {
    const data = await this.stockSdkService.getKlineWithIndicators(
      params.market,
      params.code,
      query.period,
      query.adjust,
      query.startDate,
      query.endDate,
      query.indicators
    )
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取K线信号
   * GET /api/stock-sdk/kline/:market/:code/signals?period=daily&maFast=5&maSlow=20
   */
  @Get('kline/:market/:code/signals')
  async getKlineSignals(
    @Param() params: GetKlineSignalsParamsDto,
    @Query() query: GetKlineSignalsQueryDto
  ) {
    const data = await this.stockSdkService.getKlineSignals(
      params.market,
      params.code,
      query.period,
      query.adjust,
      query.startDate,
      query.endDate,
      query.maFast,
      query.maSlow
    )
    return { code: 200, message: '获取成功', data }
  }
}
