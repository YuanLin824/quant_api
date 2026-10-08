import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * A 股交易日历
 *
 * 数据来源为同花顺「交易日历」接口（经 `ApiThsService.getTradingDays()`），由 StockTradingDaysService 定时同步。
 *
 * **主键用 `date` 而非代理主键**：`yyyyMMdd` 天然唯一且稳定，省去 uuid 的同时让 upsert 的冲突键
 * 与主键合一（与 `StockSymbol` 用 thscode 作主键同一思路）。
 *
 * **数据只增不删**：上游每次只返回近一年窗口，但本表保留全部历史——同步只做 upsert，
 * 不会因窗口滑动而删除更早的交易日。这正是不继承 BaseEntity、也不设 `delistedAt` 之类标记的原因：
 * 交易日历是追加型参考数据，不存在「失效」语义。
 */
@Entity({ name: 'stock_trading_days' })
export class StockTradingDay {
  @PrimaryColumn({
    name: 'date',
    type: 'varchar',
    length: 8,
    comment: '交易日，yyyyMMdd 格式（Asia/Shanghai），主键',
  })
  date!: string

  @Column({
    name: 'date_ms',
    type: 'timestamptz',
    comment: '该交易日 Asia/Shanghai 00:00:00 的时刻（上游 date_ms 的等价表示）',
  })
  dateMs!: Date

  @Column({
    name: 'sync_at',
    type: 'timestamptz',
    comment: '最近一次从上游同步到该行的时间',
  })
  syncAt!: Date
}
