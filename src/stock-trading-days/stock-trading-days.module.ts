import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApiThsModule } from '../api-ths/api-ths.module'
import { AuthModule } from '../auth/auth.module'
import { StockTradingDay } from './entities/stock-trading-day.entity'
import { StockTradingDaysController } from './stock-trading-days.controller'
import { StockTradingDaysSchedule } from './stock-trading-days.schedule'
import { StockTradingDaysService } from './stock-trading-days.service'

/**
 * 交易日历模块
 *
 * 每天凌晨 3 点从同花顺同步近一年的 A 股交易日并落库，
 * 同时对外提供手动触发同步的接口（需登录）。
 *
 * `imports: [AuthModule]` 是为了解析 `JwtAuthGuard`——守卫需在使用方模块作用域内可见，
 * `@Global()` 的 AppModule 只导出自己的 exports，不覆盖 AuthModule 的守卫。
 *
 * `StockTradingDaysSchedule` 仅承载触发时机，不对外导出。
 */
@Module({
  imports: [TypeOrmModule.forFeature([StockTradingDay]), ApiThsModule, AuthModule],
  controllers: [StockTradingDaysController],
  providers: [StockTradingDaysService, StockTradingDaysSchedule],
  exports: [StockTradingDaysService],
})
export class StockTradingDaysModule {}
