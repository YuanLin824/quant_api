import { Module } from '@nestjs/common'
import { TdxController } from './tdx.controller'
import { TdxService } from './tdx.service'

/**
 * 通达信行情模块
 *
 * 基于 `node-tdx-market`（通达信 TCP 协议），提供 K线、五档盘口（批量）、
 * 当日/历史分时、当日/历史分笔成交、证券数量与全量证券列表。
 */
@Module({
  controllers: [TdxController],
  providers: [TdxService],
  exports: [TdxService],
})
export class TdxModule {}
