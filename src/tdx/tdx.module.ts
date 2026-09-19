import { Module } from '@nestjs/common'
import { TdxService } from './tdx.service'

/**
 * 通达信行情模块
 *
 * 基于 `node-tdx-market`（通达信 TCP 协议）提供 **K 线**能力。
 *
 * 库本身还支持五档盘口/分时/分笔成交/证券列表，但本项目用不上——分时与搜索走
 * westock 的两个 CLI（见 `WestockCliModule` / `WestockDataModule`），
 * 证券列表走 `stock-sdk`（见 `StockSdkModule`），故这些方法已从 `TdxService` 删除。
 *
 * **不对外暴露 HTTP 接口**——本模块只作为内部数据源，供其他模块（如 `StockKlineModule`）
 * 注入使用。
 */
@Module({
  providers: [TdxService],
  exports: [TdxService],
})
export class TdxModule {}
