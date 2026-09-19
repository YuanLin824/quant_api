import { Column, Entity, Index, PrimaryColumn } from 'typeorm'
import type { StockSymbolMarket } from '../stock-symbols.constants'

/**
 * 市场标的代码
 *
 * 由定时任务每日同步（数据源为 `stock-sdk`），采用 **upsert**：以 `code` 为主键，
 * 不存在则新增、`market` 有变化时更新、无变化则不写入。**不删除已退市的历史记录**。
 *
 * 代码统一为「市场前缀 + 代码」，故 `code` 本身全局唯一，直接作主键——无需 uuid 代理键：
 * - A 股：`sh600036` / `sz000001` / `bj430047`（上游自带前缀）
 * - 港股：`hk00700`
 * - 美股：`usAAPL`
 * - 基金：`005827`（**无前缀**，与 A 股场外基金代码同形）
 *
 * **只有市场与代码两列**：上游 `stock-sdk` 的 `codes.*` 返回的是纯字符串数组，
 * 不提供名称、每手股数、小数位等属性。需要名称等信息的场景请用
 * [`/api/westock/search`](./docs/api-westock.md) 或 [`/api/tdx/stocks/:exchange`](./docs/api-tdx.md)。
 *
 * **有意不继承 `BaseEntity`**：本表是纯代码字典，没有软删除语义——
 * 若带 `delete_at`，软删的行会一直占住 `code` 的唯一索引位，
 * 使后续同步的 `ON CONFLICT` 命中死行且永远查不出来（同步日志却显示成功）。
 * 要删标的直接硬删：`DELETE FROM stock_symbols WHERE code = '...'`。
 */
@Entity({ name: 'stock_symbols' })
@Index('idx_stock_symbols_market', ['market'])
export class StockSymbol {
  @PrimaryColumn({
    name: 'code',
    type: 'varchar',
    length: 20,
    comment: '带市场前缀的代码，如 sh600036（主键）',
  })
  code!: string

  @Column({ name: 'market', type: 'varchar', length: 4, comment: '市场: cn/hk/us/fund' })
  market!: StockSymbolMarket
}
