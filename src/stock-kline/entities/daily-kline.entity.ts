import { Column, Entity, Index, PrimaryColumn } from 'typeorm'

/**
 * 日 K 线
 *
 * 由定时任务每日 16:00 同步 A 股全市场：首次全量回补近两年、之后增量补最新几根。
 *
 * **有意不继承 `BaseEntity`**：
 * - 业务主键就是 `(code, trade_date)`——天然唯一，无需 uuid 代理键
 * - 纯时序数据没有软删除语义（退市股票的历史行情应当保留），
 *   `delete_at` 反而会占住唯一索引位
 * - 数百万行的规模下，每行多出的 `id`/`status`/三个时间戳（约 42 字节）是不必要的开销
 *
 * **单位**（上游 `node-tdx-market` 的价格与成交额是「厘」= 元 × 1000，成交量是「手」，
 * 详见 README 与 `docs/api-tdx.md`）：
 * - `open` / `high` / `low` / `close` / `amount` 入库前已换算为**元**（÷ 1000，无损）
 * - `volume` 存**手**（1 手 = 100 股），保持上游原值
 *
 * `numeric` / `bigint` 在 TypeORM 中映射为 `string`：避免经过 JS number 时丢精度。
 */
@Entity({ name: 'daily_klines' })
@Index('idx_daily_klines_date', ['tradeDate'])
export class DailyKline {
  @PrimaryColumn({
    name: 'code',
    type: 'varchar',
    length: 20,
    comment: '带市场前缀的代码，如 sh600036',
  })
  code!: string

  @PrimaryColumn({ name: 'trade_date', type: 'date', comment: '交易日' })
  tradeDate!: string

  @Column({ name: 'open', type: 'numeric', precision: 20, scale: 3, comment: '开盘价（元）' })
  open!: string

  @Column({ name: 'high', type: 'numeric', precision: 20, scale: 3, comment: '最高价（元）' })
  high!: string

  @Column({ name: 'low', type: 'numeric', precision: 20, scale: 3, comment: '最低价（元）' })
  low!: string

  @Column({ name: 'close', type: 'numeric', precision: 20, scale: 3, comment: '收盘价（元）' })
  close!: string

  @Column({ name: 'volume', type: 'bigint', comment: '成交量（手）' })
  volume!: string

  @Column({ name: 'amount', type: 'numeric', precision: 20, scale: 3, comment: '成交额（元）' })
  amount!: string
}
