import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { Exchange } from 'node-tdx-market'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  GetExchangeParamsDto,
  GetHistoryMinuteQueryDto,
  GetHistoryTradeQueryDto,
  GetKlineParamsDto,
  GetKlineQueryDto,
  GetMinuteParamsDto,
  GetQuotesBodyDto,
  GetTradeParamsDto,
  GetTradeQueryDto,
} from './dto'
import { DEFAULT_KLINE_PERIOD, EXCHANGE_MAP } from './tdx.constants'
import { TdxService } from './tdx.service'

/**
 * 通达信行情控制器
 *
 * 基于 node-tdx-market（通达信 TCP 协议），提供 K线、五档盘口、分时、
 * 分笔成交与证券列表查询。所有接口需要 JWT 认证，不限流
 * （数据为公开行情，且底层连接已串行化请求）。
 *
 * 与 stock-api / stock-sdk 的区别：数据源是通达信行情服务器，
 * 字段口径与单位不同——**价格单位为厘（元 × 1000）**。
 */
@Controller('tdx')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class TdxController {
  constructor(private readonly tdxService: TdxService) {}

  /**
   * 获取 K 线数据
   * GET /api/tdx/kline/:code?period=day&start=0&count=100
   */
  @Get('kline/:code')
  async getKline(@Param() params: GetKlineParamsDto, @Query() query: GetKlineQueryDto) {
    const data = await this.tdxService.getKline(
      params.code,
      query.period ?? DEFAULT_KLINE_PERIOD,
      query.start,
      query.count
    )
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 批量获取五档盘口
   * POST /api/tdx/quotes
   */
  @Post('quotes')
  async getQuotes(@Body() dto: GetQuotesBodyDto) {
    const data = await this.tdxService.getQuotes(dto.codes)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取当日分时数据
   * GET /api/tdx/minute/:code
   */
  @Get('minute/:code')
  async getMinute(@Param() params: GetMinuteParamsDto) {
    const data = await this.tdxService.getMinute(params.code)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取历史分时数据
   * GET /api/tdx/minute/:code/history?date=20260914
   */
  @Get('minute/:code/history')
  async getHistoryMinute(
    @Param() params: GetMinuteParamsDto,
    @Query() query: GetHistoryMinuteQueryDto
  ) {
    const data = await this.tdxService.getHistoryMinute(params.code, Number(query.date))
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取当日分笔成交
   * GET /api/tdx/trade/:code?start=0&count=100
   */
  @Get('trade/:code')
  async getTrade(@Param() params: GetTradeParamsDto, @Query() query: GetTradeQueryDto) {
    const data = await this.tdxService.getTrade(params.code, query.start, query.count)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取历史分笔成交
   * GET /api/tdx/trade/:code/history?date=20260914&start=0&count=100
   */
  @Get('trade/:code/history')
  async getHistoryTrade(
    @Param() params: GetTradeParamsDto,
    @Query() query: GetHistoryTradeQueryDto
  ) {
    const data = await this.tdxService.getHistoryTrade(
      params.code,
      Number(query.date),
      query.start,
      query.count
    )
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取指定交易所的证券数量
   * GET /api/tdx/stocks/:exchange/count
   */
  @Get('stocks/:exchange/count')
  async getStockCount(@Param() params: GetExchangeParamsDto) {
    const data = await this.tdxService.getStockCount(EXCHANGE_MAP[params.exchange] as Exchange)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 获取指定交易所的全部证券列表（底层自动分页拉取）
   * GET /api/tdx/stocks/:exchange
   */
  @Get('stocks/:exchange')
  async getStockList(@Param() params: GetExchangeParamsDto) {
    const data = await this.tdxService.getStockList(EXCHANGE_MAP[params.exchange] as Exchange)
    return { code: 200, message: '获取成功', data }
  }
}
