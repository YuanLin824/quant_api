import { EMPTY_MESSAGES, ERROR_PREFIX } from './westock.constants'
import type { TableParseResult, WestockRow } from './westock.types'

/**
 * CLI 输出解析器（纯函数，无 Nest 依赖）
 *
 * CLI 输出一张扁平的 Markdown 表格（**没有分组标题**），列名随命令变化：
 * - `search` → `code | name | type`
 * - `minute`（当日）→ `code | time | price | volume | amount`
 * - `minute --days 5` → `code | date | time | price | volume | amount`
 *
 * 故列名一律从表头读取，不硬编码，新增列无需改解析器。
 *
 * 失败与无结果的**退出码都是 0**，只能按内容判定。
 */

/** 按未转义的竖线拆分表格行，返回去掉首尾空白后的单元格 */
function splitTableRow(line: string): string[] {
  const parts = line.split(/(?<!\\)\|/)

  // 首尾竖线会产生空串；用判空而非固定 slice，以兼容不以 `|` 结尾的行
  if (parts.length > 0 && parts[0].trim() === '') parts.shift()
  if (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop()

  return parts.map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

/** 是否为表格分隔行（如 `| --- | --- |`） */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell))
}

/**
 * 解析命令的 stdout 为表格结构
 *
 * 判定顺序（短路）：
 * 1. 空输出 → `empty`（实测 `--sector` 即如此：无任何输出且退出码 0）
 * 2. 以「执行失败」开头 → `invalid`
 * 3. 以「数据为空」/「无分时数据」开头 → `empty`
 * 4. 解析表格；连表头都没有 → `invalid`
 */
export function parseTableOutput(stdout: string): TableParseResult {
  const text = stdout.replace(/\r\n/g, '\n').trim()

  if (text === '') return { status: 'empty' }
  if (text.startsWith(ERROR_PREFIX)) return { status: 'invalid' }
  if (EMPTY_MESSAGES.some((message) => text.startsWith(message))) return { status: 'empty' }

  let columns: string[] | null = null
  const rows: WestockRow[] = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || !line.startsWith('|')) continue

    const cells = splitTableRow(line)
    if (cells.length === 0 || isSeparatorRow(cells)) continue

    // 首个表格行即表头
    if (!columns) {
      columns = cells
      continue
    }

    // 数据行：按位置映射，多则截断、少则补空
    const row: WestockRow = {}
    columns.forEach((column, index) => {
      row[column] = cells[index] ?? ''
    })
    rows.push(row)
  }

  if (!columns) return { status: 'invalid' }

  return { status: 'ok', columns, rows }
}
