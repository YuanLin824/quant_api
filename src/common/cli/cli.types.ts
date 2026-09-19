/** 表格行：键为列名，值一律为字符串（不做数值推断——不同命令的列语义不同） */
export type TableRow = Record<string, string>

/**
 * 表格解析结果——三态判别联合
 *
 * 让「无结果」与「输出异常」在类型层面分开：CLI 对这两者的退出码都是 0，
 * 无法靠退出码区分。
 */
export type TableParseResult =
  | { status: 'ok'; columns: string[]; rows: TableRow[] }
  | { status: 'empty' }
  | { status: 'invalid' }

/**
 * 分段表格的一节（如搜索结果的「股票」段与「可转债」段）
 *
 * `columns` 逐段独立：不同段的列可能不同，故不可跨段复用。
 */
export interface TableSection {
  /** 段标题原文（如 `股票`、`股票·港股`） */
  title: string
  /**
   * 上游命中数（标题里的「共 N 条」）
   *
   * ⚠️ **不等于 `rows.length`**：带 `--offset` 时「共 7 条，显示前 2」两者就不同；
   * 且它本身**受 `--limit` 约束**（命中数超过 limit 时只报 limit）。
   */
  total: number
  /** 列名，顺序与该段表格一致 */
  columns: string[]
  /** 行数据 */
  rows: TableRow[]
}

/** 分段表格的解析结果——同样是三态 */
export type SectionParseResult =
  { status: 'ok'; sections: TableSection[] } | { status: 'empty' } | { status: 'invalid' }
