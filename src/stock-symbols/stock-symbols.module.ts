import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StockSdkModule } from '../stock-sdk/stock-sdk.module'
import { StockSymbol } from './entities/stock-symbol.entity'
import { StockSymbolsController } from './stock-symbols.controller'
import { StockSymbolsScheduler } from './stock-symbols.scheduler'
import { StockSymbolsService } from './stock-symbols.service'

/**
 * 标的代码模块
 *
 * 定时同步全量股票代码并提供查询接口。数据源为 `stock-sdk`（HTTP 公开数据源）。
 */
@Module({
  imports: [TypeOrmModule.forFeature([StockSymbol]), StockSdkModule],
  controllers: [StockSymbolsController],
  providers: [StockSymbolsService, StockSymbolsScheduler],
})
export class StockSymbolsModule {}
