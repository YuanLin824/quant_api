import { parseTableOutput } from './westock.parser'

/**
 * 解析器单测
 *
 * 样例均取自 CLI 实测输出，非构造数据。
 */
describe('parseTableOutput', () => {
  describe('正常解析', () => {
    it('search：code / name / type 三列', () => {
      const stdout = `
| code | name | type |
| --- | --- | --- |
| hk00700 | 腾讯控股 | GP |
| usTCEHY.PS | 腾讯控股(ADR) | GP |
`
      const result = parseTableOutput(stdout)

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.columns).toEqual(['code', 'name', 'type'])
      expect(result.rows).toEqual([
        { code: 'hk00700', name: '腾讯控股', type: 'GP' },
        { code: 'usTCEHY.PS', name: '腾讯控股(ADR)', type: 'GP' },
      ])
    })

    it('minute 当日：五列，含 time', () => {
      const stdout = `
| code | time | price | volume | amount |
| --- | --- | --- | --- | --- |
| sh600519 | 0930 | 1257.98 | 140 | 17611720.00 |
| sh600519 | 0931 | 1261.98 | 572 | 71968937.77 |
`
      const result = parseTableOutput(stdout)

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.columns).toEqual(['code', 'time', 'price', 'volume', 'amount'])
      expect(result.rows[0]).toEqual({
        code: 'sh600519',
        time: '0930',
        price: '1257.98',
        volume: '140',
        amount: '17611720.00',
      })
    })

    it('minute 五日：比当日多一列 date', () => {
      const stdout = `
| code | date | time | price | volume | amount |
| --- | --- | --- | --- | --- | --- |
| sh600519 | 20260917 | 0930 | 1257.98 | 140 | 17611720.00 |
| sh600519 | 20260916 | 0955 | 1263.45 | 5479 | 694623942.00 |
`
      const result = parseTableOutput(stdout)

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.columns).toEqual(['code', 'date', 'time', 'price', 'volume', 'amount'])
      expect(result.rows[0]).toMatchObject({ date: '20260917', time: '0930' })
      expect(result.rows[1]).toMatchObject({ date: '20260916', time: '0955' })
    })

    it('值一律为字符串，不做数值推断', () => {
      const result = parseTableOutput('| code | price |\n| --- | --- |\n| sh600519 | 1257.98 |')

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(typeof result.rows[0].price).toBe('string')
    })

    it('CRLF 换行', () => {
      const result = parseTableOutput(
        '| code | name |\r\n| --- | --- |\r\n| sh600519 | 贵州茅台 |\r\n'
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.rows[0]).toEqual({ code: 'sh600519', name: '贵州茅台' })
    })

    it('单元格内的转义竖线不被拆成两列', () => {
      const result = parseTableOutput('| code | name |\n| --- | --- |\n| sh600519 | 贵州\\|茅台 |')

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.rows[0].name).toBe('贵州|茅台')
      expect(result.columns).toHaveLength(2)
    })

    it('列数不匹配时短行补空、长行截断', () => {
      const result = parseTableOutput(
        '| code | name |\n| --- | --- |\n| sh600519 |\n| sh600036 | 招商银行 | 多余 |'
      )

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.rows[0]).toEqual({ code: 'sh600519', name: '' })
      expect(result.rows[1]).toEqual({ code: 'sh600036', name: '招商银行' })
    })

    it('只有表头、无数据行', () => {
      const result = parseTableOutput('| code | name |\n| --- | --- |')

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') return
      expect(result.columns).toEqual(['code', 'name'])
      expect(result.rows).toEqual([])
    })
  })

  describe('无结果（正常业务结果，非异常）', () => {
    it('search 的「数据为空」', () => {
      expect(parseTableOutput('数据为空')).toEqual({ status: 'empty' })
    })

    it('minute 的「无分时数据」', () => {
      expect(parseTableOutput('\n无分时数据\n')).toEqual({ status: 'empty' })
    })

    it('完全空输出（实测 --sector 即如此，退出码 0）', () => {
      expect(parseTableOutput('')).toEqual({ status: 'empty' })
      expect(parseTableOutput('   \n  ')).toEqual({ status: 'empty' })
    })
  })

  describe('输出异常', () => {
    it('「执行失败 [MKT_ERROR]」+ 温馨提示', () => {
      const stdout = `执行失败 [MKT_ERROR]: 不支持的市场: badcode123

---
> **温馨提示**：当前数据查询遇到问题，您可以：
> 1. 打开 **腾讯微证券小程序** 直接查看最新行情数据`

      expect(parseTableOutput(stdout)).toEqual({ status: 'invalid' })
    })

    it('既非表格也非已知提示', () => {
      expect(parseTableOutput('股票查询工具 - 命令行接口\n\n使用方法:')).toEqual({
        status: 'invalid',
      })
    })
  })
})
