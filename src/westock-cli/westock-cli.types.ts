import type { TableRow, TableSection } from '../common/cli/cli.types'
import type { KlineFq, KlinePeriod, SearchMarket, SearchType } from './westock-cli.constants'

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

/** 搜索查询的可选参数 */
export interface SearchOptions {
  /** 类型；**多个时 CLI 按类型分段返回**，不传则仅搜股票 */
  types?: SearchType[]
  /** 市场；`jp`/`kr` 与 `types` **互斥**（CLI 限制） */
  market?: SearchMarket
  limit?: number
  offset?: number
}

/** 搜索结果 */
export interface WestockCliSearchResult {
  /** 搜索关键词（已 trim，原样回显） */
  keyword: string
  /** 类型（未指定时由 CLI 默认仅搜股票） */
  types?: SearchType[]
  /** 市场（未指定时不限） */
  market?: SearchMarket
  /** 实际请求的条数上限 */
  limit: number
  /** 偏移量 */
  offset: number
  /**
   * 按类型分段的结果
   *
   * **全部无结果时是空数组**——某一类无结果不产生段，CLI 只打一行
   * 「未找到匹配的结果（…）。」提示，该提示会被解析器丢弃。
   */
  sections: TableSection[]
  /** 各段行数之和（**不等于**上游命中总数，见 `TableSection.total`） */
  total: number
}
