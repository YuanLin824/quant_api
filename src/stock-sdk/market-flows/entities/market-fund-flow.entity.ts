import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../../common/base.entity'

/**
 * 大盘资金流（每个交易日一条，保留最近一个月）
 *
 * 数据来源 `sdk.fundFlow.market`，返回的是**按日的历史序列**，
 * 因此日期直接取自数据本身，无需按运行时推导。
 *
 * 与其它资金流表的区别：唯一键只有 `trade_date`——大盘是沪深两市合计口径，
 * 每个交易日仅一条记录。数值列允许为空（上游对部分日期可能不返回）。
 */
@Entity({ name: 'market_fund_flows' })
@Index(['tradeDate'], { unique: true })
export class MarketFundFlow extends BaseEntity {
  @Column({ name: 'trade_date', type: 'varchar', length: 10, comment: '数据日期 YYYY-MM-DD' })
  tradeDate!: string

  @Column({ name: 'sh_close', type: 'float8', nullable: true, comment: '上证指数收盘价' })
  shClose!: number | null

  @Column({
    name: 'sh_change_percent',
    type: 'float8',
    nullable: true,
    comment: '上证指数涨跌幅(%)',
  })
  shChangePercent!: number | null

  @Column({ name: 'sz_close', type: 'float8', nullable: true, comment: '深证指数收盘价' })
  szClose!: number | null

  @Column({
    name: 'sz_change_percent',
    type: 'float8',
    nullable: true,
    comment: '深证指数涨跌幅(%)',
  })
  szChangePercent!: number | null

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
