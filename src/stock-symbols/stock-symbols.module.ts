import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApiThsModule } from '../api-ths/api-ths.module'
import { AuthModule } from '../auth/auth.module'
import { StockSymbol } from './entities/stock-symbol.entity'
import { StockSymbolsController } from './stock-symbols.controller'
import { StockSymbolsSchedule } from './stock-symbols.schedule'
import { StockSymbolsService } from './stock-symbols.service'

/**
 * 股票标的模块
 *
 * 定时从同花顺同步标的代码表（个股 + 指数/板块）并落库，同时对外提供
 * 分页查询与手动触发同步两个接口（均需登录）。
 *
 * `imports: [AuthModule]` 是为了解析 `JwtAuthGuard`——守卫需在使用方模块作用域内可见，
 * `@Global()` 的 AppModule 只导出自己的 exports，不覆盖 AuthModule 的守卫。
 *
 * `StockSymbolsSchedule` 仅承载触发时机，不对外导出。
 */
@Module({
  imports: [TypeOrmModule.forFeature([StockSymbol]), ApiThsModule, AuthModule],
  controllers: [StockSymbolsController],
  providers: [StockSymbolsService, StockSymbolsSchedule],
  exports: [StockSymbolsService],
})
export class StockSymbolsModule {}
