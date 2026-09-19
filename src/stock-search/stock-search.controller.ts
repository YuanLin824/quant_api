import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { SearchStockQueryDto } from './dto'
import { StockSearchService } from './stock-search.service'

/**
 * 证券搜索控制器
 *
 * 数据源是 Go CLI 子进程，**每次请求起一个进程**，故不豁免限流。
 */
@Controller('stock-search')
@UseGuards(JwtAuthGuard)
export class StockSearchController {
  constructor(private readonly stockSearchService: StockSearchService) {}

  /**
   * 按关键词搜索证券（多类型时按类型分段返回）
   * GET /api/stock-search?keyword=腾讯&type=stock&market=hk&limit=10
   */
  @Get()
  async search(@Query() query: SearchStockQueryDto) {
    const data = await this.stockSearchService.search(query)
    return { code: 200, message: '获取成功', data }
  }
}
