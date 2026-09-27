import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { StockSymbolQueryDto } from './dto/stock-symbol-query.dto'
import { StockSymbolsService } from './stock-symbols.service'

/**
 * 标的代码表控制器
 *
 * 响应统一 `{ code, message, data }` 包络（与 AuthController 一致），两个接口均需 access token。
 *
 * **限流**：查询走全局默认（每 60 秒 60 次）；手动同步是重操作（真实调用上游、耗时 10～25 秒），
 * 按注册/改密的先例收紧到每小时 5 次。
 *
 * **方法顺序**：list → syncStatus → sync（`REST_CLIENT.http`、`docs/api-symbols.md` 遵循同一顺序）。
 */
@Controller('stock-symbols')
export class StockSymbolsController {
  constructor(private readonly stockSymbolsService: StockSymbolsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Query() dto: StockSymbolQueryDto) {
    const data = await this.stockSymbolsService.findSymbols(dto)
    return { code: 200, message: '获取成功', data }
  }

  @Get('sync-status')
  @UseGuards(JwtAuthGuard)
  async syncStatus() {
    const data = await this.stockSymbolsService.getSyncStatus()
    return { code: 200, message: '获取成功', data }
  }

  @Post('sync')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 每小时最多 5 次手动同步
  async sync() {
    const data = await this.stockSymbolsService.syncSymbols()
    return {
      code: 200,
      message: data.skipped ? '已有同步正在进行中' : '同步完成',
      data,
    }
  }
}
