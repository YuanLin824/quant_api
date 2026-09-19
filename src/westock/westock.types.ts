import type { KlineFq, KlinePeriod, SearchScope } from './westock.constants'

/** 表格行：键为列名，值一律为字符串（不做数值推断——不同命令的列语义不同） */
export type WestockRow = Record<string, string>

/** 证券搜索结果 */
export interface WestockSearchResult {
  /** 搜索关键词（已 trim，原样回显） */
  keyword: string
  /** 搜索范围（未指定时 CLI 默认返回股票与基金） */
  scope?: SearchScope
  /** 列名，顺序与 CLI 表格一致 */
  columns: string[]
  /** 行数据 */
  rows: WestockRow[]
  /** 返回行数 */
  total: number
}

/** 分时结果 */
export interface WestockMinuteResult {
  /** 证券代码（已 trim，原样回显） */
  code: string
  /** 天数：1 = 当日，2~5 = 五日 */
  days: number
  /** 列名，顺序与 CLI 表格一致；五日比当日多一列 `date` */
  columns: string[]
  /** 行数据 */
  rows: WestockRow[]
  /** 返回行数 */
  total: number
}

/** 分时查询的可选参数（与 HTTP DTO 解耦） */
export interface MinuteOptions {
  days?: number
}

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
  /** 证券代码（已 trim，原样回显；多代码时为逗号分隔的原文） */
  code: string
  /** 周期 */
  period: KlinePeriod
  /** 复权方式；未指定时由上游默认（实测与 qfq 一致） */
  fq?: KlineFq
  /**
   * 起始日期（未指定时为 `null`）
   *
   * 本模块**不做补齐**，只在显式传入时转发——上游的默认区间是
   * `[1990-12-01, 当日]`，详见 docs/api-westock.md。
   */
  start?: string
  /** 结束日期（未指定时为 `null`；上游默认取当日） */
  end?: string
  /** 列名，顺序与 CLI 表格一致；多代码时首列为 `code`，单代码时无该列 */
  columns: string[]
  /** 行数据 */
  rows: WestockRow[]
  /** 返回行数 */
  total: number
}

/**
 * 表格解析结果——三态判别联合
 *
 * 让「无结果」与「输出异常」在类型层面分开：CLI 对这两者的退出码都是 0，
 * 无法靠退出码区分。
 */
export type TableParseResult =
  | { status: 'ok'; columns: string[]; rows: WestockRow[] }
  | { status: 'empty' }
  | { status: 'invalid' }
