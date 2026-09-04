import { Module } from '@nestjs/common'
import { StockSdkController } from './stock-sdk.controller'
import { StockSdkService } from './stock-sdk.service'

/**
 * Stock SDK 模块
 *
 * 提供A股、港股、美股的实时行情查询功能
 * 使用 stock-sdk 库
 */
@Module({
  controllers: [StockSdkController],
  providers: [StockSdkService],
  exports: [StockSdkService],
})
export class StockSdkModule {}
