import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { GetKlinesQueryDto, SyncKlinesBodyDto } from './dto'
import { KlinesService } from './klines.service'

/**
 * 日 K 线控制器
 *
 * 定时任务每天 16:00 自动同步，这些接口用于手动触发与查询。
 * 不豁免限流：手动同步会遍历全市场数千只股票并批量写库。
 */
@Controller('klines')
@UseGuards(JwtAuthGuard)
export class KlinesController {
  constructor(private readonly klinesService: KlinesService) {}

  /**
   * 手动触发同步（首次回补 / 失败补跑）
   * POST /api/klines/sync
   */
  @Post('sync')
  async sync(@Body() body: SyncKlinesBodyDto) {
    const data = await this.klinesService.sync(body.mode)
    return { code: 200, message: '同步完成', data }
  }

  /**
   * 概览统计：覆盖股票数、总行数、日期范围
   * GET /api/klines/stats
   */
  @Get('stats')
  async stats() {
    const data = await this.klinesService.getStats()
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 实时查询某只股票的 K 线（按时间降序）
   *
   * 走 westock CLI 即时拉取，**不读数据库**。`start` 不传则补 `1990-07-31`，
   * `end` 不传由上游取当日，`fq` 不传由上游取默认（前复权）；
   * `limit` 取区间**尾部**的 N 根，最多 1000。
   * GET /api/klines?code=sh600036&period=m60&fq=nofq&start=2026-09-01&end=2026-09-18&limit=100
   */
  @Get()
  async getKlines(@Query() query: GetKlinesQueryDto) {
    const data = await this.klinesService.getRealtime(query.code, {
      period: query.period,
      fq: query.fq,
      start: query.start,
      end: query.end,
      limit: query.limit,
    })
    return { code: 200, message: '获取成功', data }
  }
}
