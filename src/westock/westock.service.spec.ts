import {
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { CLAWHUB_ENTRY_PATH, GO_CLI_BIN_PATH } from './westock.constants'
import { WestockService } from './westock.service'

jest.mock('node:child_process')

const mockExecFile = execFile as unknown as jest.Mock

/** 最小可用的 ChildProcess 替身（service 会注册 close 监听与 kill） */
function fakeChild() {
  return Object.assign(new EventEmitter(), { kill: jest.fn(), pid: 12345 })
}

/** 让 mock 的 execFile 走给定结果（回调在 nextTick 触发，模拟异步） */
function stubExecFile(result: { error?: unknown; stdout?: string; stderr?: string }) {
  mockExecFile.mockImplementation(
    (_file: string, _args: string[], _opts: unknown, callback: (...args: unknown[]) => void) => {
      const child = fakeChild()
      process.nextTick(() => {
        callback(result.error ?? null, result.stdout ?? '', result.stderr ?? '')
        child.emit('close')
      })
      return child
    }
  )
}

/** 取最近一次调用的完整参数数组 */
function lastArgs(): string[] {
  return mockExecFile.mock.calls[0][1] as string[]
}

/**
 * clawhub 调用的参数——首个元素是 bundle 入口，需跳过
 *
 * 注意 Go CLI 的调用**没有**入口前缀（直接以子命令开头），故用 lastArgs 断言。
 */
function lastClawhubArgs(): string[] {
  return lastArgs().slice(1)
}

const SEARCH_STDOUT = `
| code | name | type |
| --- | --- | --- |
| hk00700 | 腾讯控股 | GP |
| usTCEHY.PS | 腾讯控股(ADR) | GP |
`

const MINUTE_STDOUT = `
| code | time | price | volume | amount |
| --- | --- | --- | --- | --- |
| sh600519 | 0930 | 1257.98 | 140 | 17611720.00 |
`

describe('WestockService', () => {
  let service: WestockService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WestockService()
  })

  describe('search', () => {
    it('返回列名与行数据', async () => {
      stubExecFile({ stdout: SEARCH_STDOUT })

      const result = await service.search('腾讯')

      expect(result.keyword).toBe('腾讯')
      expect(result.columns).toEqual(['code', 'name', 'type'])
      expect(result.total).toBe(2)
      expect(result.rows[0]).toEqual({ code: 'hk00700', name: '腾讯控股', type: 'GP' })
    })

    it('无结果时返回空表格且不抛异常', async () => {
      stubExecFile({ stdout: '数据为空' })

      const result = await service.search('zzz')

      expect(result).toEqual({ keyword: 'zzz', scope: undefined, columns: [], rows: [], total: 0 })
    })

    it('scope 作为 --<scope> 参数传入', async () => {
      stubExecFile({ stdout: SEARCH_STDOUT })

      await service.search('银行', 'fund')

      expect(lastClawhubArgs()).toEqual(['search', '银行', '--fund'])
    })

    it('未指定 scope 时不追加参数', async () => {
      stubExecFile({ stdout: SEARCH_STDOUT })

      await service.search('腾讯')

      expect(lastClawhubArgs()).toEqual(['search', '腾讯'])
    })
  })

  describe('minute', () => {
    it('默认查当日，不传 --days', async () => {
      stubExecFile({ stdout: MINUTE_STDOUT })

      const result = await service.minute('sh600519')

      expect(lastClawhubArgs()).toEqual(['minute', 'sh600519'])
      expect(result.days).toBe(1)
      expect(result.code).toBe('sh600519')
      expect(result.total).toBe(1)
      expect(result.rows[0]).toMatchObject({ time: '0930', price: '1257.98' })
    })

    it('days 大于 1 时传 --days', async () => {
      stubExecFile({
        stdout: '| code | date | time |\n| --- | --- | --- |\n| sh600519 | 20260917 | 0930 |',
      })

      const result = await service.minute('sh600519', { days: 5 })

      expect(lastClawhubArgs()).toEqual(['minute', 'sh600519', '--days', '5'])
      expect(result.columns).toEqual(['code', 'date', 'time'])
    })

    it('无分时数据时返回空表格', async () => {
      stubExecFile({ stdout: '无分时数据' })

      const result = await service.minute('sh999999')

      expect(result.rows).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('kline', () => {
    const KLINE_STDOUT = `
| date | open | last | high | low | volume | amount | exchange | change_pct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-18 | 1262.99 | 1257.12 | 1265.88 | 1256.1 | 24891 | 3135850000 | 0.2 | -0.78 |
`

    it('默认查日线、limit 240，不带 --fq；日期参数一概不追加', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      const result = await service.kline('sh600519')

      expect(lastArgs()).toEqual(['kline', 'sh600519', '--period', 'day', '--limit', '240'])
      expect(result.period).toBe('day')
      expect(result.fq).toBeUndefined()
      expect(result.start).toBeUndefined()
      expect(result.end).toBeUndefined()
      expect(result.total).toBe(1)
      expect(result.rows[0]).toMatchObject({ date: '2026-09-18', last: '1257.12' })
    })

    it('分钟周期与复权：按 CLI 的命名传 m5 而非 5m', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      await service.kline('sh600519', { period: 'm5', limit: 100, fq: 'hfq' })

      expect(lastArgs()).toEqual([
        'kline',
        'sh600519',
        '--period',
        'm5',
        '--limit',
        '100',
        '--fq',
        'hfq',
      ])
    })

    it('只传 start 时不追加 --end（另一端交由上游取默认值）', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      const result = await service.kline('sh600519', { start: '2026-01-01' })

      expect(lastArgs()).toEqual([
        'kline',
        'sh600519',
        '--period',
        'day',
        '--limit',
        '240',
        '--start',
        '2026-01-01',
      ])
      expect(result.start).toBe('2026-01-01')
      expect(result.end).toBeUndefined()
    })

    it('只传 end 时不追加 --start（另一端交由上游取默认值）', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      const result = await service.kline('sh600519', { end: '2026-01-01' })

      expect(lastArgs()).toEqual([
        'kline',
        'sh600519',
        '--period',
        'day',
        '--limit',
        '240',
        '--end',
        '2026-01-01',
      ])
      expect(result.start).toBeUndefined()
      expect(result.end).toBe('2026-01-01')
    })

    it('多代码以逗号分隔整体作为单个 argv', async () => {
      stubExecFile({
        stdout: '| code | date | last |\n| --- | --- | --- |\n| sh600519 | 2026-09-18 | 1257.12 |',
      })

      const result = await service.kline('sh600519,hk00700')

      expect(lastArgs()).toEqual(['kline', 'sh600519,hk00700', '--period', 'day', '--limit', '240'])
      expect(result.columns).toEqual(['code', 'date', 'last'])
    })

    it('无结果时返回空表格且不抛异常（Go CLI 同样输出「数据为空」）', async () => {
      stubExecFile({ stdout: '数据为空' })

      const result = await service.kline('sh999999')

      expect(result.rows).toEqual([])
      expect(result.total).toBe(0)
    })

    it('上游错误文本（非表格）→ 503', async () => {
      stubExecFile({
        stdout: '查询dayK线失败：[code=1620053001] error_type=2 suggest=3 msg=service error',
      })

      const promise = service.kline('badcode123')
      await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException)
      await expect(promise).rejects.toThrow('证券数据服务返回异常，请稍后重试')
    })

    it('两端都显式传入时原样转发', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      const result = await service.kline('sh600519', {
        period: 'm5',
        start: '2026-09-14',
        end: '2026-09-18',
      })

      expect(lastArgs()).toEqual([
        'kline',
        'sh600519',
        '--period',
        'm5',
        '--limit',
        '240',
        '--start',
        '2026-09-14',
        '--end',
        '2026-09-18',
      ])
      expect(result.start).toBe('2026-09-14')
      expect(result.end).toBe('2026-09-18')
    })

    it('分钟周期跨度超过 5 天 → 400（前置校验，不落到上游）', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      const promise = service.kline('sh600519', {
        period: 'm1',
        start: '2026-09-01',
        end: '2026-09-18',
      })

      await expect(promise).rejects.toBeInstanceOf(BadRequestException)
      await expect(promise).rejects.toThrow('分钟周期的日期跨度不能超过 5 天')
      expect(mockExecFile).not.toHaveBeenCalled() // 未调用 CLI
    })

    it('分钟周期跨度刚好 5 天 → 放行', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      await service.kline('sh600519', { period: 'm1', start: '2026-09-14', end: '2026-09-18' })

      expect(mockExecFile).toHaveBeenCalled()
    })

    it('日线不受跨度限制', async () => {
      stubExecFile({ stdout: KLINE_STDOUT })

      await service.kline('sh600519', {
        period: 'day',
        start: '2026-01-01',
        end: '2026-09-18',
      })

      expect(mockExecFile).toHaveBeenCalled()
    })
  })

  describe('调用方式', () => {
    it('search/minute 经 node 执行 clawhub 入口（而非直接执行 bin）', async () => {
      stubExecFile({ stdout: SEARCH_STDOUT })

      await service.search('腾讯')

      const [file, args] = mockExecFile.mock.calls[0] as [string, string[]]
      expect(file).toBe(process.execPath)
      expect(args[0]).toBe(CLAWHUB_ENTRY_PATH)
      expect(CLAWHUB_ENTRY_PATH).toContain('westock-data-clawhub')
    })

    it('kline 直接执行 Go CLI 二进制', async () => {
      stubExecFile({ stdout: '| date | last |\n| --- | --- |\n| 2026-09-18 | 1257.12 |' })

      await service.kline('sh600519')

      const [file, args] = mockExecFile.mock.calls[0] as [string, string[]]
      expect(file).toBe(GO_CLI_BIN_PATH)
      expect(args[0]).toBe('kline') // 不以入口开头，直接是子命令
      expect(GO_CLI_BIN_PATH).toMatch(/westock(\.exe)?$/)
    })
  })

  describe('错误分类', () => {
    it('「执行失败」（退出码为 0）→ 503', async () => {
      stubExecFile({ stdout: '执行失败 [MKT_ERROR]: 不支持的市场: badcode123' })

      const promise = service.search('badcode123')
      await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException)
      await expect(promise).rejects.toThrow('证券数据服务返回异常，请稍后重试')
    })

    it('非零退出码 → 503，且 stderr 原文不进 message', async () => {
      const error = Object.assign(new Error('Command failed'), { code: 1 })
      stubExecFile({ error, stderr: 'Error: 请提供搜索关键词\n示例: westock-data search 腾讯' })

      const promise = service.search('腾讯')
      await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException)
      await expect(promise).rejects.toThrow('证券数据服务调用失败，请稍后重试')
      await expect(promise).rejects.not.toThrow(/示例/)
    })

    it('依赖未安装（ENOENT）→ 503，文案指向组件不可用', async () => {
      const error = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
      stubExecFile({ error })

      const promise = service.search('腾讯')
      await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException)
      await expect(promise).rejects.toThrow('证券数据组件不可用，请稍后重试')
    })

    it('超时被 kill → 504', async () => {
      const error = Object.assign(new Error('Command failed'), { killed: true })
      stubExecFile({ error })

      const promise = service.minute('sh600519')
      await expect(promise).rejects.toBeInstanceOf(GatewayTimeoutException)
      await expect(promise).rejects.toThrow('证券数据查询超时，请稍后重试')
    })
  })

  it('销毁时终止在途子进程', async () => {
    const child = fakeChild()
    mockExecFile.mockImplementation(() => child) // 回调不触发，模拟仍在运行

    void service.search('腾讯')
    service.onModuleDestroy()

    expect(child.kill).toHaveBeenCalled()
  })
})
