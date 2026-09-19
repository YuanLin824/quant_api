import { Module } from '@nestjs/common'
import { StockSdkService } from './stock-sdk.service'

/**
 * stock-sdk 模块
 *
 * 封装 `stock-sdk`（npm 包，HTTP 公开数据源）的代码列表能力。
 *
 * **不对外暴露 HTTP 接口**——本模块只作为内部数据源，供其他模块
 * （如 `StockSymbolsModule` 的定时同步）注入使用。
 */
@Module({
  providers: [StockSdkService],
  exports: [StockSdkService],
})
export class StockSdkModule {}
