import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../../../common/base.entity'

/**
 * 板块资金流排名（每个交易日一批，保留最近一个月）
 *
 * 数据来源 `sdk.fundFlow.sectorRank`。上游对部分字段可能返回 null
 * （如无成交的板块），故数值列均允许为空。
 *
 * 唯一键包含 `sectorType` 与 `indicator`：同一交易日可按不同板块类型
 * （行业/概念/地域）与排名周期分别采集，互不冲突。
 */
@Entity({ name: 'sector_fund_flows' })
@Index(['tradeDate', 'sectorType', 'indicator', 'code'], { unique: true })
@Index(['tradeDate'])
export class SectorFundFlow extends BaseEntity {
  @Column({
    name: 'trade_date',
    type: 'varchar',
    length: 10,
    comment: '数据所属交易日 YYYY-MM-DD',
  })
  tradeDate!: string

  @Column({
    name: 'sector_type',
    type: 'varchar',
    length: 16,
    comment: '板块类型: industry/concept/region',
  })
  sectorType!: string

  @Column({
    name: 'indicator',
    type: 'varchar',
    length: 8,
    comment: '排名周期: today/3day/5day/10day',
  })
  indicator!: string

  @Column({ name: 'rank', type: 'smallint', comment: '排名（与上游返回顺序一致）' })
  rank!: number

  @Column({ name: 'code', type: 'varchar', length: 16, comment: '板块代码（东财 BK 编号）' })
  code!: string

  @Column({ name: 'name', type: 'varchar', length: 32, comment: '板块名称' })
  name!: string

  @Column({ name: 'change_percent', type: 'float8', nullable: true, comment: '涨跌幅(%)' })
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

  @Column({ name: 'large_net_inflow', type: 'float8', nullable: true, comment: '大单净额(元)' })
  largeNetInflow!: number | null

  @Column({ name: 'medium_net_inflow', type: 'float8', nullable: true, comment: '中单净额(元)' })
  mediumNetInflow!: number | null

  @Column({ name: 'small_net_inflow', type: 'float8', nullable: true, comment: '小单净额(元)' })
  smallNetInflow!: number | null

  @Column({
    name: 'top_stock_name',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '主力净流入最大股名称',
  })
  topStockName!: string | null

  @Column({
    name: 'top_stock_code',
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: '主力净流入最大股代码',
  })
  topStockCode!: string | null
}
