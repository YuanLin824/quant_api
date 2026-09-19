import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { SymbolsService } from './symbols.service'

/**
 * 标的代码控制器
 *
 * 定时任务每天 08:00 自动同步，这两个接口用于手动触发与查看结果。
 *
 * **不提供查询具体代码的接口**——那属于内部能力（`SymbolsService.getByMarket`），
 * 由其他模块按需注入使用；对外只暴露各市场的**数量统计**。
 *
 * 不豁免限流：手动同步会实打实地拉取数据源的全量数据并批量写库，不是轻量的读接口。
 */
@Controller('symbols')
@UseGuards(JwtAuthGuard)
export class SymbolsController {
  constructor(private readonly symbolsService: SymbolsService) {}

  /**
   * 手动触发一次同步（首次初始化 / 失败补跑）
   * POST /api/symbols/sync
   */
  @Post('sync')
  async sync() {
    const data = await this.symbolsService.syncAll()
    return { code: 200, message: '同步完成', data }
  }

  /**
   * 各市场的代码数量统计
   * GET /api/symbols
   */
  @Get()
  async getStats() {
    const data = await this.symbolsService.getStats()
    return { code: 200, message: '获取成功', data }
  }
}
