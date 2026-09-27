import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * 标的（个股 / 指数板块）代码表
 *
 * 数据来源为同花顺「标的列表获取」接口，由 StockSymbolsService 定时同步，
 * 表结构直接映射上游 `ThsTickerItem` 的全部字段。
 *
 * **不继承 BaseEntity**：本表是上游代码表的直接映射，`thscode` 天然唯一且稳定，直接作为主键——
 * 省去代理主键 uuid，也让 upsert 的冲突键与主键合一。代码表也没有「人工停用」的需求，
 * 故不需要 status / 软删除那一套。
 *
 * **delistedAt 语义**：非 NULL 表示该标的已从上游代码表消失（退市 / 被剔除），
 * 值为其消失的那次同步时间；重新出现时由同步置回 NULL。
 * 同步只增不删——上游不再返回的行保留在表中，使下游能按 thscode 稳定引用。
 */
@Entity({ name: 'stock_symbols' })
export class StockSymbol {
  @PrimaryColumn({
    name: 'thscode',
    type: 'varchar',
    length: 32,
    comment: '同花顺完整代码（如 600519.SH），主键',
  })
  thscode!: string

  @Column({ name: 'ticker', type: 'varchar', length: 16, comment: '纯代码（如 600519）' })
  ticker!: string

  @Column({ name: 'name', type: 'varchar', length: 128, comment: '展示名称' })
  name!: string

  @Column({
    name: 'exchange',
    type: 'varchar',
    length: 8,
    nullable: true,
    comment: '交易所后缀（SH / SZ / BJ），指数等无交易所的标的为 null',
  })
  exchange!: string | null

  @Column({
    name: 'asset_type',
    type: 'varchar',
    length: 32,
    comment: '资产类型（当前仅 a-share 与 a-share-index）',
  })
  assetType!: string

  @Column({ name: 'currency', type: 'varchar', length: 8, comment: '币种代码' })
  currency!: string

  @Column({ name: 'list_date', type: 'date', nullable: true, comment: '上市日期' })
  listDate!: string | null

  @Column({ name: 'end_date', type: 'date', nullable: true, comment: '合约到期日' })
  endDate!: string | null

  @Column({ name: 'last_trade_date', type: 'date', nullable: true, comment: '最后交易日' })
  lastTradeDate!: string | null

  @Column({ name: 'last_delivery_date', type: 'date', nullable: true, comment: '最后交割日' })
  lastDeliveryDate!: string | null

  @Column({
    name: 'sync_at',
    type: 'timestamptz',
    comment: '最近一次从上游同步到该行的时间',
  })
  syncAt!: Date

  @Column({
    name: 'delisted_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
    comment: '从上游代码表消失的时间；非 NULL 表示已退市/被剔除，重新出现时置回 NULL',
  })
  delistedAt!: Date | null
}
