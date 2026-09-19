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
