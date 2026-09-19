import { ERROR_PREFIX } from './cli.constants'
import type { SectionParseResult, TableRow, TableSection } from './cli.types'
import { isSeparatorRow, splitTableRow } from './table-parser'

/**
 * 分段表格解析器（纯函数，无 Nest 依赖）
 *
 * 与 `table-parser.ts` 的区别在输出形态：那些命令输出**一张**扁平表格，
 * 而 Go CLI 的 `search` **按类型分段**，每段一个标题头 + 一张表：
 *
 * ```
 * **股票** — 共 3 条，显示前 3
 *
 * | code | name | type |
 * | --- | --- | --- |
 * | sh601166 | 兴业银行 | GP-A |
 *
 * **可转债** — 共 1 条，显示前 1
 * ...
 * ```
 *
 * 四点实测结论：
 * - 「共 N 条」是**上游命中数**，「显示前 M」是**实际返回行数**，带 `--offset` 时两者不同
 *   （7 条命中、`--limit 100 --offset 5` → `共 7 条，显示前 2`）
 * - ⚠️ **`--market jp`/`kr` 的标题没有「共 N 条」**，只有 `**日股** — 显示 1 条`，
 *   且该段的列是 `code`/`name`/`market`（不是 `type`）。故标题只校验 `**…** — …` 这个外形，
 *   计数再从尾部按 `共` / `显示` 分别提取——按类型名或固定文案匹配都会漏掉日韩股
 * - 某一类无结果时**不产生段**，只有一行提示（多类型时逐类各一行）。提示文案实测有三种
 *   （`未找到匹配的结果（…）。` / `未找到与"…"匹配的韩股。`），共同前缀是 `未找到`
 * - 段标题带市场后缀（`股票·港股`），故按 `**…**` 取原文，不硬编码类型名
 */

/** 段标题行：`**股票** — 共 3 条，显示前 3`、`**日股** — 显示 1 条` */
const SECTION_HEADER = /^\*\*(.+?)\*\*\s*[—-]\s*(.*)$/

/** 标题尾部的计数，两者可能只出现其一 */
const TOTAL_COUNT = /共\s*(\d+)\s*条/
const SHOWN_COUNT = /显示\s*(?:前\s*)?(\d+)\s*条/

/** 某一类无结果的提示行（**不**构成段） */
const NOT_FOUND_NOTICE = /^未找到/

/** 解析分段表格命令的 stdout */
export function parseSectionedOutput(stdout: string): SectionParseResult {
  const text = stdout.replace(/\r\n/g, '\n').trim()

  if (text === '') return { status: 'empty' }
  if (text.startsWith(ERROR_PREFIX)) return { status: 'invalid' }

  const sections: TableSection[] = []
  let current: TableSection | null = null
  let sawNotFoundNotice = false

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') continue

    const header = SECTION_HEADER.exec(line)
    if (header) {
      const counts = TOTAL_COUNT.exec(header[2])?.[1] ?? SHOWN_COUNT.exec(header[2])?.[1] ?? '0'
      current = { title: header[1].trim(), total: Number(counts), columns: [], rows: [] }
      sections.push(current)
      continue
    }

    if (NOT_FOUND_NOTICE.test(line)) {
      sawNotFoundNotice = true
      continue
    }

    if (!line.startsWith('|')) continue

    // 表格行归属于最近的段标题；出现在任何段标题之前的表格（不该发生）直接忽略
    if (!current) continue

    const cells = splitTableRow(line)
    if (cells.length === 0 || isSeparatorRow(cells)) continue

    // 段内首个表格行即该段的表头
    if (current.columns.length === 0) {
      current.columns = cells
      continue
    }

    const row: TableRow = {}
    current.columns.forEach((column, index) => {
      row[column] = cells[index] ?? ''
    })
    current.rows.push(row)
  }

  if (sections.length > 0) {
    // 标题里连计数都没有时（未观察到的形态）退回行数——报 0 比报行数更容易误导
    for (const section of sections) {
      if (section.total === 0 && section.rows.length > 0) section.total = section.rows.length
    }
    return { status: 'ok', sections }
  }

  // 一个段都没有时，「未找到匹配的结果」是**空结果**，其余是**输出异常**
  // （后者如空关键词时 CLI 报的 `错误: 请提供搜索关键词`，无法按表格解析）
  return sawNotFoundNotice ? { status: 'empty' } : { status: 'invalid' }
}
