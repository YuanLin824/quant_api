import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { StockKlineQueryDto } from './dto/stock-kline-query.dto'
import { StockKlineService } from './stock-kline.service'

/**
 * K 线查询控制器
 *
 * 单端点设计：日 K 与分钟 K 同表同构，用 `category` 区分周期，无需拆两个接口。
 *
 * **刻意不提供手动触发同步接口**（区别于 stock-symbols / stock-trading-days）：
 * 一轮同步以十分钟计，HTTP 同步等待必然超时，异步化又要引入进度/状态机制；
 * 定时任务与启动补齐已覆盖需求。查询走全局限流（每 60 秒 60 次），不额外收紧。
 */
@Controller('stock-kline')
export class StockKlineController {
  constructor(private readonly stockKlineService: StockKlineService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Query() dto: StockKlineQueryDto) {
    const data = await this.stockKlineService.findKlines(dto)
    return { code: 200, message: '获取成功', data }
  }
}
