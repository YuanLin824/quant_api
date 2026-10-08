import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { StockTradingDaysService } from './stock-trading-days.service'

/**
 * 交易日历控制器
 *
 * 响应统一 `{ code, message, data }` 包络（与 AuthController 一致），需 access token。
 *
 * **限流**：手动同步是重操作（真实调用上游），按注册/改密与标的同步的先例收紧到每小时 5 次。
 */
@Controller('stock-trading-days')
export class StockTradingDaysController {
  constructor(private readonly tradingDaysService: StockTradingDaysService) {}

  @Post('sync')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 每小时最多 5 次手动同步
  async sync() {
    const data = await this.tradingDaysService.syncStockTradingDays()
    return {
      code: 200,
      message: data.skipped ? '已有同步正在进行中' : '同步完成',
      data,
    }
  }
}
