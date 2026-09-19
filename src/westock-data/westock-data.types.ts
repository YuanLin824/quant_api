import type { TableRow } from '../common/cli/cli.types'
import type { SearchScope } from './westock-data.constants'

/** 证券搜索结果 */
export interface WestockSearchResult {
  /** 搜索关键词（已 trim，原样回显） */
  keyword: string
  /** 搜索范围（未指定时 CLI 默认返回股票与基金） */
  scope?: SearchScope
  /** 列名，顺序与 CLI 表格一致 */
  columns: string[]
  /** 行数据 */
  rows: TableRow[]
  /** 返回行数 */
  total: number
}

/** 分时查询的可选参数 */
export interface MinuteOptions {
  days?: number
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
  rows: TableRow[]
  /** 返回行数 */
  total: number
}
