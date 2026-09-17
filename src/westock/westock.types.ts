import type { SearchScope } from './westock.constants'

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
