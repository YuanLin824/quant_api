import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../../common/base.entity'
import { CodesMarket } from '../../stock-sdk.types'

/**
 * 市场标的代码
 *
 * 由定时任务每日同步，采用 **upsert**：以 `code` 为唯一键，
 * 不存在则新增、已存在且 `market` 有变化时更新，无变化则不写入。
 * 不会删除已退市的历史记录。
 *
 * 代码格式统一为「市场前缀 + 代码」，因此 `code` 本身全局唯一：
 * - A 股：`sh600000`（上游自带）
 * - 美股：入库时把东财 secid 前缀换成 `us`（`105.AAPL` → `usAAPL`）
 * - 港股：入库时补 `hk` 前缀（上游返回纯数字，`00700` → `hk00700`）
 * - 基金：纯代码（`005827`）
 */
@Entity({ name: 'stock_symbols' })
@Index(['code'], { unique: true })
@Index(['market'])
export class StockSymbol extends BaseEntity {
  @Column({ name: 'market', type: 'varchar', length: 10, comment: '市场: cn/us/hk/fund' })
  market!: CodesMarket

  @Column({ name: 'code', type: 'varchar', length: 20, comment: '标的代码' })
  code!: string
}
