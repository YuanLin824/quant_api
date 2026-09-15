import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StockFundFlow } from './fund-flows/entities/stock-fund-flow.entity'
import { StockFundFlowController } from './fund-flows/stock-fund-flow.controller'
import { StockFundFlowScheduler } from './fund-flows/stock-fund-flow.scheduler'
import { StockFundFlowService } from './fund-flows/stock-fund-flow.service'
import { MarketFundFlow } from './market-flows/entities/market-fund-flow.entity'
import { MarketFundFlowController } from './market-flows/market-fund-flow.controller'
import { MarketFundFlowScheduler } from './market-flows/market-fund-flow.scheduler'
import { MarketFundFlowService } from './market-flows/market-fund-flow.service'
import { SectorFundFlow } from './sectors/entities/sector-fund-flow.entity'
import { SectorFlowController } from './sectors/sector-flow.controller'
import { SectorFlowScheduler } from './sectors/sector-flow.scheduler'
import { SectorFlowService } from './sectors/sector-flow.service'
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
 * 以及四个每日定时任务：标的代码同步（`symbols/`）、个股资金流排名（`fund-flows/`）、
 * 大盘资金流（`market-flows/`）、板块资金流（`sectors/`）。
 */
@Module({
  imports: [TypeOrmModule.forFeature([StockSymbol, StockFundFlow, MarketFundFlow, SectorFundFlow])],
  controllers: [
    StockSdkController,
    StockSymbolController,
    StockFundFlowController,
    MarketFundFlowController,
    SectorFlowController,
  ],
  providers: [
    StockSdkService,
    StockSymbolService,
    StockSymbolScheduler,
    StockFundFlowService,
    StockFundFlowScheduler,
    MarketFundFlowService,
    MarketFundFlowScheduler,
    SectorFlowService,
    SectorFlowScheduler,
  ],
  exports: [
    StockSdkService,
    StockSymbolService,
    StockFundFlowService,
    MarketFundFlowService,
    SectorFlowService,
  ],
})
export class StockSdkModule {}
