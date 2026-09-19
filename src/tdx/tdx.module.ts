import { Module } from '@nestjs/common'
import { TdxService } from './tdx.service'

/**
 * 通达信行情模块
 *
 * 基于 `node-tdx-market`（通达信 TCP 协议）提供 K线、五档盘口、分时、分笔成交、
 * 证券数量与全量证券列表的数据能力。
 *
 * **不对外暴露 HTTP 接口**——本模块只作为内部数据源，供其他模块（如 `KlinesModule`）
 * 注入使用。
 */
@Module({
  providers: [TdxService],
  exports: [TdxService],
})
export class TdxModule {}
