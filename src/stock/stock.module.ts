import { Module } from '@nestjs/common'
import { StockController } from './stock.controller'
import { StockService } from './stock.service'

/**
 * 股票行情模块
 *
 * 提供A股、港股、美股的实时行情、K线数据和搜索功能
 * 使用 stock-api 库，自动从腾讯/新浪/东方财富获取数据
 */
@Module({
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
