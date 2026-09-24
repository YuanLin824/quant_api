import { Module } from '@nestjs/common'
import { StockSymbolsService } from './stock-symbols.service'

/**
 * 股票标的模块
 *
 * 纯服务层，不对外暴露 HTTP 接口（无 controller），供其他模块注入 StockSymbolsService 使用。
 */
@Module({
  providers: [StockSymbolsService],
  exports: [StockSymbolsService],
})
export class StockSymbolsModule {}
