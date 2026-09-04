import { Module } from '@nestjs/common'
import { StockApiController } from './stock-api.controller'
import { StockApiService } from './stock-api.service'

/**
 * 股票行情模块
 *
 * 提供A股、港股、美股的实时行情、K线数据和搜索功能
 * 使用 stock-api 库，自动从腾讯/新浪/东方财富获取数据
 */
@Module({
  controllers: [StockApiController],
  providers: [StockApiService],
  exports: [StockApiService],
})
export class StockApiModule {}
