import type { TableRow } from '../common/cli/cli.types'
import type { KlineFq, KlinePeriod } from './westock-cli.constants'

/** K 线查询的可选参数 */
export interface KlineOptions {
  period?: KlinePeriod
  limit?: number
  fq?: KlineFq
  /** 起始日期 `YYYY-MM-DD`（分钟周期跨度上限 5 天） */
  start?: string
  /** 结束日期 `YYYY-MM-DD` */
  end?: string
}

/** K 线结果 */
export interface WestockKlineResult {
  /** 证券代码（原样回显；多代码时为逗号分隔的原文） */
  code: string
  /** 周期 */
  period: KlinePeriod
  /** 复权方式；未指定时由上游默认 */
  fq?: KlineFq
  /**
   * 起始日期（未指定时为 `null`）
   *
   * 本模块**不做补齐**，只在显式传入时转发——上游的默认区间是
   * `[1990-12-01, 当日]`。
   */
  start?: string
  /** 结束日期（未指定时为 `null`；上游默认取当日） */
  end?: string
  /** 列名，顺序与 CLI 表格一致；多代码时首列为 `code`，单代码时无该列 */
  columns: string[]
  /** 行数据 */
  rows: TableRow[]
  /** 返回行数 */
  total: number
}
