import { Injectable } from '@nestjs/common'
import { WestockCliService } from '../westock-cli/westock-cli.service'
import type { WestockCliSearchResult } from '../westock-cli/westock-cli.types'
import type { SearchStockQueryDto } from './dto'

/**
 * 证券搜索服务
 *
 * 纯编排：把查询参数转成 `WestockCliService.search` 的入参。
 * 关键词为空的兜底校验在 `WestockCliService` 里（CLI 对空关键词只报错、
 * 输出解析不出表格，会被误判成上游异常）。
 *
 * **不落库、不缓存**——每次请求起一个子进程，数据实时取。
 */
@Injectable()
export class StockSearchService {
  constructor(private readonly westockCliService: WestockCliService) {}

  /** 按关键词搜索，多类型时结果是分段的 */
  async search(query: SearchStockQueryDto): Promise<WestockCliSearchResult> {
    return this.westockCliService.search(query.keyword, {
      types: query.type,
      market: query.market,
      limit: query.limit,
      offset: query.offset,
    })
  }
}
