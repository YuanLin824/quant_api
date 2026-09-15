import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../../common/base.entity'

/**
 * 个股资金流排名（每个交易日一批，保留最近一个月）
 *
 * 数据来源 `sdk.fundFlow.rank`，覆盖全市场数千只股票，是本项目体量最大的表。
 * 上游对部分字段可能返回 null，故数值列均允许为空。
 *
 * 唯一键包含 `indicator`：同一交易日可按不同排名周期（当日/3日/5日/10日）
 * 分别采集，互不覆盖。
 */
@Entity({ name: 'stock_fund_flows' })
@Index(['tradeDate', 'indicator', 'code'], { unique: true })
@Index(['tradeDate'])
export class StockFundFlow extends BaseEntity {
  @Column({
    name: 'trade_date',
    type: 'varchar',
    length: 10,
    comment: '数据所属交易日 YYYY-MM-DD',
  })
  tradeDate!: string

  @Column({
    name: 'indicator',
    type: 'varchar',
    length: 8,
    comment: '排名周期: today/3day/5day/10day',
  })
  indicator!: string

  @Column({ name: 'rank', type: 'smallint', comment: '排名（与上游返回顺序一致）' })
  rank!: number

  @Column({ name: 'code', type: 'varchar', length: 10, comment: '股票代码' })
  code!: string

  @Column({ name: 'name', type: 'varchar', length: 32, comment: '股票名称' })
  name!: string

  @Column({ name: 'price', type: 'float8', nullable: true, comment: '最新价' })
  price!: number | null

  @Column({
    name: 'change_percent',
    type: 'float8',
    nullable: true,
    comment: '涨跌幅(%)，对应排名周期',
  })
  changePercent!: number | null

  @Column({
    name: 'main_net_inflow',
    type: 'float8',
    nullable: true,
    comment: '主力净流入净额(元)',
  })
  mainNetInflow!: number | null

  @Column({
    name: 'main_net_inflow_percent',
    type: 'float8',
    nullable: true,
    comment: '主力净流入净占比(%)',
  })
  mainNetInflowPercent!: number | null

  @Column({
    name: 'super_large_net_inflow',
    type: 'float8',
    nullable: true,
    comment: '超大单净额(元)',
  })
  superLargeNetInflow!: number | null

  @Column({
    name: 'super_large_net_inflow_percent',
    type: 'float8',
    nullable: true,
    comment: '超大单净占比(%)',
  })
  superLargeNetInflowPercent!: number | null

  @Column({ name: 'large_net_inflow', type: 'float8', nullable: true, comment: '大单净额(元)' })
  largeNetInflow!: number | null

  @Column({
    name: 'large_net_inflow_percent',
    type: 'float8',
    nullable: true,
    comment: '大单净占比(%)',
  })
  largeNetInflowPercent!: number | null

  @Column({ name: 'medium_net_inflow', type: 'float8', nullable: true, comment: '中单净额(元)' })
  mediumNetInflow!: number | null

  @Column({
    name: 'medium_net_inflow_percent',
    type: 'float8',
    nullable: true,
    comment: '中单净占比(%)',
  })
  mediumNetInflowPercent!: number | null

  @Column({ name: 'small_net_inflow', type: 'float8', nullable: true, comment: '小单净额(元)' })
  smallNetInflow!: number | null

  @Column({
    name: 'small_net_inflow_percent',
    type: 'float8',
    nullable: true,
    comment: '小单净占比(%)',
  })
  smallNetInflowPercent!: number | null
}
