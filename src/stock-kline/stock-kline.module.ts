import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApiTdxModule } from '../api-tdx/api-tdx.module'
import { AuthModule } from '../auth/auth.module'
import { StockSymbol } from '../stock-symbols/entities/stock-symbol.entity'
import { StockKline } from './entities/stock-kline.entity'
import { StockKlineController } from './stock-kline.controller'
import { StockKlineSchedule } from './stock-kline.schedule'
import { StockKlineService } from './stock-kline.service'

/**
 * 股票 K 线模块
 *
 * 全市场 A 股的日 K 与分钟 K（均来自通达信）定时同步落库，并对外提供查询接口（需登录）。
 *
 * - `StockSymbol` 也在此 forFeature：同步范围（在市 A 股）直接查标的表，
 *   不改动 stock-symbols 模块的对外 API
 * - `imports: [AuthModule]` 是为了解析 `JwtAuthGuard`——守卫需在使用方模块作用域内可见
 * - `StockKlineSchedule` 仅承载触发时机，不对外导出
 */
@Module({
  imports: [TypeOrmModule.forFeature([StockKline, StockSymbol]), ApiTdxModule, AuthModule],
  controllers: [StockKlineController],
  providers: [StockKlineService, StockKlineSchedule],
  exports: [StockKlineService],
})
export class StockKlineModule {}
