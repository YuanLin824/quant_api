import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StockSdkController } from './stock-sdk.controller'
import { StockSdkService } from './stock-sdk.service'
import { StockSymbol } from './symbols/entities/stock-symbol.entity'
import { StockSymbolController } from './symbols/stock-symbol.controller'
import { StockSymbolScheduler } from './symbols/stock-symbol.scheduler'
import { StockSymbolService } from './symbols/stock-symbol.service'

/**
 * Stock SDK 模块
 *
 * 提供A股、港股、美股的实时行情查询功能（使用 stock-sdk 库），
 * 以及每日同步各市场标的代码的定时任务。
 */
@Module({
  imports: [TypeOrmModule.forFeature([StockSymbol])],
  controllers: [StockSdkController, StockSymbolController],
  providers: [StockSdkService, StockSymbolService, StockSymbolScheduler],
  exports: [StockSdkService, StockSymbolService],
})
export class StockSdkModule {}
