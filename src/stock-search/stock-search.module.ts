import { Module } from '@nestjs/common'
import { WestockCliModule } from '../westock-cli/westock-cli.module'
import { StockSearchController } from './stock-search.controller'
import { StockSearchService } from './stock-search.service'

/**
 * 证券搜索模块
 *
 * 经 `WestockCliModule`（腾讯 Go CLI 子进程）提供按关键词搜索证券的能力，
 * 支持类型、市场、分页；**不落库**，每次请求实时取。
 */
@Module({
  imports: [WestockCliModule],
  controllers: [StockSearchController],
  providers: [StockSearchService],
})
export class StockSearchModule {}
