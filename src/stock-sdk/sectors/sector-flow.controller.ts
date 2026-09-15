import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { GetSectorFlowDto } from './dto/get-sector-flow.dto'
import { RunSectorSyncDto } from './dto/run-sector-sync.dto'
import { SectorFlowService } from './sector-flow.service'

/**
 * 板块资金流控制器
 *
 * 定时任务每天 17:00（A 股收盘后）自动采集，这两个接口用于手动触发与查询结果。
 */
@Controller('stock-sdk/sectors')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class SectorFlowController {
  constructor(private readonly sectorFlowService: SectorFlowService) {}

  /**
   * 手动触发一次采集（首次初始化 / 补跑 / 采集其他板块类型）
   * POST /api/stock-sdk/sectors/sync
   */
  @Post('sync')
  async sync(@Body() dto: RunSectorSyncDto) {
    const data = await this.sectorFlowService.sync({
      tradeDate: dto.tradeDate,
      sectorType: dto.sectorType,
      indicator: dto.indicator,
      dryRun: dto.dryRun,
    })
    return { code: 200, message: '执行完成', data }
  }

  /**
   * 查询板块资金流：传 date 查该日，不传返回最近一批
   * GET /api/stock-sdk/sectors?date=2026-09-11
   */
  @Get()
  async getFlow(@Query() dto: GetSectorFlowDto) {
    const data = dto.date
      ? await this.sectorFlowService.getByDate(dto.date, dto.sectorType)
      : await this.sectorFlowService.getLatest()
    return { code: 200, message: '获取成功', data }
  }
}
