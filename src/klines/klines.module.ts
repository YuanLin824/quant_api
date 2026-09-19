import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StockSymbol } from '../symbols/entities/stock-symbol.entity'
import { TdxModule } from '../tdx/tdx.module'
import { WestockCliModule } from '../westock-cli/westock-cli.module'
import { DailyKline } from './entities/daily-kline.entity'
import { KlinesController } from './klines.controller'
import { KlinesScheduler } from './klines.scheduler'
import { KlinesService } from './klines.service'

/**
 * K 线模块
 *
 * 定时同步 A 股全市场日线，并提供多周期实时查询接口。
 * 待同步的股票代码**直接从 `stock_symbols` 表读**（故注册了 `StockSymbol` 的仓储）。
 *
 * **两条路径用两个数据源**：落库（`sync`）走 `TdxModule`（通达信 TCP 长连接），
 * 实时查询走 `WestockCliModule`（腾讯 Go CLI 子进程）——后者的周期覆盖更全
 * （含 `m120`/`season`/`year`），代价是每次查询起一个子进程。
 */
@Module({
  imports: [TypeOrmModule.forFeature([DailyKline, StockSymbol]), TdxModule, WestockCliModule],
  controllers: [KlinesController],
  providers: [KlinesService, KlinesScheduler],
})
export class KlinesModule {}
