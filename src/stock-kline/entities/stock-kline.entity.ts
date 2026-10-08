import { Column, Entity, Index, PrimaryColumn } from 'typeorm'
import type { StockKlineCategory } from '../stock-kline.constants'

/**
 * 股票 K 线（日 K + 分钟 K 统一单表）
 *
 * 日 K 与分钟 K **均来自通达信**（逐只 TCP）：日 K 为 `day` 周期，分钟 K 为
 * 1m/5m/15m/30m/60m。两者同构（都有标准 OHLC 与量额），差异只在 `category`
 * 与保留策略——分钟级有保留窗口（`STOCK_KLINE_MINUTE_RETENTION_DAYS`，超窗即清理），
 * 日 K 只增不删，因此共用一张表。
 *
 * **不继承 BaseEntity**：与 stock_symbols / trading_days 同款——复合主键天然唯一，
 * 直接作为 upsert 的冲突键使用，不引入代理主键。
 *
 * **datetime 是混合长度字符串**：日 K 为 `yyyyMMdd`（8 位）、分钟 K 为 `yyyyMMddHHmm`（12 位）。
 * 同类别内比较长度一致、字典序即时间序；跨类别比较（如查询边界、清理条件）必须
 * **先按 category 分流再构造边界**，否则 8 位字符串与 12 位字符串比较会整体错位
 * （`'20261008' < '202610080000'`）。查询的边界补零逻辑收口在 StockKlineService.findKlines()。
 *
 * **写入策略**：同步用 upsert + `skipUpdateIfNoValuesChanged`（见 StockKlineService），
 * 行值未变化时不产生新行版本——分钟 K 每夜整窗重取（千万行级），
 * 若不跳过未变化行，每夜会把整张表重写一遍，造成索引膨胀与 WAL 尖峰。
 * 配合方式：service 构造的行对象**不含 syncAt**，该列由数据库默认值填充（列上有 `default now()`）。
 */
@Entity({ name: 'stock_kline' })
@Index(['category', 'datetime'])
export class StockKline {
  @PrimaryColumn({
    name: 'thscode',
    type: 'varchar',
    length: 32,
    comment: '同花顺完整代码（如 600519.SH），与 stock_symbols.thscode 对应',
  })
  thscode!: string

  @PrimaryColumn({
    name: 'category',
    type: 'varchar',
    length: 8,
    comment: 'K 线周期：day / 1m / 5m / 15m / 30m / 60m',
  })
  category!: StockKlineCategory

  @PrimaryColumn({
    name: 'datetime',
    type: 'varchar',
    length: 12,
    comment:
      'K 线时刻：日 K 为 yyyyMMdd（8 位）；分钟 K 为 yyyyMMddHHmm（12 位，Asia/Shanghai 墙钟）',
  })
  datetime!: string

  @Column({ name: 'open_price', type: 'double precision', comment: '开盘价（元）' })
  openPrice!: number

  @Column({ name: 'high_price', type: 'double precision', comment: '最高价（元）' })
  highPrice!: number

  @Column({ name: 'low_price', type: 'double precision', comment: '最低价（元）' })
  lowPrice!: number

  @Column({ name: 'close_price', type: 'double precision', comment: '收盘价（元）' })
  closePrice!: number

  @Column({
    name: 'volume',
    type: 'double precision',
    comment: '成交量（股）。上游通达信为「手」，落库前 ×100 换算',
  })
  volume!: number

  @Column({ name: 'amount', type: 'double precision', comment: '成交额（元）' })
  amount!: number

  @Column({
    name: 'sync_at',
    type: 'timestamptz',
    default: () => 'now()',
    comment: '该行的写入时间（插入时由数据库取 now()；值未变化的重复同步不会更新它）',
  })
  syncAt!: Date
}
