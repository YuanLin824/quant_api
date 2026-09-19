import { parseSectionedOutput } from './section-parser'

/** 拼一段「标题 + 表格」，模拟 Go CLI search 的输出 */
function section(title: string, total: number, shown: number, rows: string[][]): string {
  const header = '| code | name | type |'
  const separator = '| --- | --- | --- |'
  const body = rows.map((cells) => `| ${cells.join(' | ')} |`)
  return [`**${title}** — 共 ${total} 条，显示前 ${shown}`, '', header, separator, ...body].join(
    '\n'
  )
}

describe('parseSectionedOutput', () => {
  describe('分段', () => {
    it('单段：解析出标题、命中数与行', () => {
      const result = parseSectionedOutput(
        section('股票', 2, 2, [
          ['hk00700', '腾讯控股', 'GP'],
          ['hk80700', '腾讯控股-R', 'GP'],
        ])
      )

      expect(result).toEqual({
        status: 'ok',
        sections: [
          {
            title: '股票',
            total: 2,
            columns: ['code', 'name', 'type'],
            rows: [
              { code: 'hk00700', name: '腾讯控股', type: 'GP' },
              { code: 'hk80700', name: '腾讯控股-R', type: 'GP' },
            ],
          },
        ],
      })
    })

    it('多段：各段行归属自己的段，第二段的表头不会被当成数据行', () => {
      const result = parseSectionedOutput(
        [
          section('股票', 1, 1, [['sh601166', '兴业银行', 'GP-A']]),
          '',
          section('可转债', 1, 1, [['sh113052', '兴业转债', 'ZQ-KZZ']]),
        ].join('\n')
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return

      expect(result.sections.map((s) => s.title)).toEqual(['股票', '可转债'])
      expect(result.sections[0].rows).toEqual([
        { code: 'sh601166', name: '兴业银行', type: 'GP-A' },
      ])
      expect(result.sections[1].rows).toEqual([
        { code: 'sh113052', name: '兴业转债', type: 'ZQ-KZZ' },
      ])
    })

    it('段标题保留市场后缀原文，不硬编码类型名', () => {
      const result = parseSectionedOutput(
        section('股票·港股', 1, 1, [['hk00700', '腾讯控股', 'GP']])
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.sections[0].title).toBe('股票·港股')
    })

    it('日韩股形态：标题只有「显示 N 条」（无「共」）、列是 market 而非 type', () => {
      // --market jp/kr 是独立接口，输出形态与其余类型不同，按固定文案匹配会漏掉
      const result = parseSectionedOutput(
        [
          '**日股** — 显示 1 条',
          '',
          '| code | name | market |',
          '| --- | --- | --- |',
          '| t7203 | TOYOTA MOTOR CORPORATION | jp |',
        ].join('\n')
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.sections[0]).toEqual({
        title: '日股',
        total: 1,
        columns: ['code', 'name', 'market'],
        rows: [{ code: 't7203', name: 'TOYOTA MOTOR CORPORATION', market: 'jp' }],
      })
    })

    it('标题未给出任何计数时退回行数，而不是报 0', () => {
      const result = parseSectionedOutput(
        ['**股票** — 命中若干', '', '| code | name |', '| --- | --- |', '| a | b |'].join('\n')
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.sections[0].total).toBe(1)
    })
  })

  describe('命中数与行数', () => {
    it('total 取「共 N 条」，与 rows.length 可不同（--offset 场景）', () => {
      // 实测：7 条命中 + --limit 100 --offset 5 → `共 7 条，显示前 2`
      const result = parseSectionedOutput(
        section('股票', 7, 2, [
          ['sh600000', '浦发银行', 'GP-A'],
          ['sh600036', '招商银行', 'GP-A'],
        ])
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.sections[0].total).toBe(7)
      expect(result.sections[0].rows).toHaveLength(2)
    })

    it('行内单元格多于/少于表头时按位置映射，多则截断、少则补空', () => {
      const result = parseSectionedOutput(
        [
          '**股票** — 共 2 条，显示前 2',
          '',
          '| code | name | type |',
          '| --- | --- | --- |',
          '| a | b |',
          '| x | y | z | 多出来的 |',
        ].join('\n')
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.sections[0].rows).toEqual([
        { code: 'a', name: 'b', type: '' },
        { code: 'x', name: 'y', type: 'z' },
      ])
    })
  })

  describe('空结果与异常', () => {
    it('某一类无结果时只有提示行、不构成段，且不影响其它段', () => {
      const result = parseSectionedOutput(
        [
          section('股票', 1, 1, [['sh601166', '兴业银行', 'GP-A']]),
          '',
          '未找到匹配的结果（期货合约）。',
        ].join('\n')
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].title).toBe('股票')
    })

    it('全部无结果 → empty，sections 为空', () => {
      const result = parseSectionedOutput(
        ['未找到匹配的结果（股票）。', '', '未找到匹配的结果（ETF/LOF/QDII 基金）。'].join('\n')
      )

      expect(result).toEqual({ status: 'empty' })
    })

    it('空结果文案有多种，均按「未找到」前缀识别为 empty', () => {
      // 实测三种：`未找到匹配的结果（…）。`、`未找到匹配的结果（股票·美股）。`、
      // `未找到与"三星"匹配的韩股。`
      expect(parseSectionedOutput('未找到匹配的结果（股票·美股）。')).toEqual({ status: 'empty' })
      expect(parseSectionedOutput('未找到与"三星"匹配的韩股。')).toEqual({ status: 'empty' })
    })

    it('空输出 → empty', () => {
      expect(parseSectionedOutput('')).toEqual({ status: 'empty' })
      expect(parseSectionedOutput('   \n  ')).toEqual({ status: 'empty' })
    })

    it('非表格的报错输出 → invalid（如空关键词）', () => {
      // CLI 报的是「错误:」而非「执行失败」，两者都识别不出来时不能当成空结果
      expect(parseSectionedOutput('错误: 请提供搜索关键词')).toEqual({ status: 'invalid' })
    })

    it('以「执行失败」开头 → invalid（沿用扁平解析器的约定）', () => {
      expect(parseSectionedOutput('执行失败: 网络异常')).toEqual({ status: 'invalid' })
    })

    it('出现在任何段标题之前的表格被忽略', () => {
      const result = parseSectionedOutput(
        ['| code | name | type |', '| --- | --- | --- |', '| a | b | c |'].join('\n')
      )

      // 无段标题且无空结果提示 → 输出异常
      expect(result).toEqual({ status: 'invalid' })
    })
  })
})
