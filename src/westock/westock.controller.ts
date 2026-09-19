import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { GetKlineQueryDto, GetMinuteQueryDto, GetSearchQueryDto } from './dto'
import { WestockService } from './westock.service'

/**
 * WeStock 数据控制器
 *
 * 通过子进程调用第三方 CLI 获取证券数据——search/minute 走 `westock-data-clawhub`，
 * kline 走腾讯 Go CLI（前者不支持分钟周期）。所有接口需要 JWT 认证。
 *
 * 与 TdxController 不同，这里**不豁免限流**：每次请求会 fork 一个子进程
 * 并请求第三方上游，而非复用长连接。
 */
@Controller('westock')
@UseGuards(JwtAuthGuard)
export class WestockController {
  constructor(private readonly westockService: WestockService) {}

  /**
   * 证券搜索
   * GET /api/westock/search?keyword=腾讯&scope=stock
   */
  @Get('search')
  async search(@Query() query: GetSearchQueryDto) {
    const data = await this.westockService.search(query.keyword, query.scope)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 分时数据（days=1 当日，2~5 五日）
   * GET /api/westock/minute?code=sh600519&days=5
   */
  @Get('minute')
  async minute(@Query() query: GetMinuteQueryDto) {
    const data = await this.westockService.minute(query.code, { days: query.days })
    return { code: 200, message: '获取成功', data }
  }

  /**
   * K 线数据（支持 11 种周期，含分钟；多代码以逗号分隔）
   * GET /api/westock/kline?code=sh600519&period=day&limit=240&fq=qfq&start=2026-01-01
   */
  @Get('kline')
  async kline(@Query() query: GetKlineQueryDto) {
    const data = await this.westockService.kline(query.code, {
      period: query.period,
      limit: query.limit,
      fq: query.fq,
      start: query.start,
      end: query.end,
    })
    return { code: 200, message: '获取成功', data }
  }
}
