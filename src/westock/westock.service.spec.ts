import { GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { CLI_ENTRY_PATH } from './westock.constants'
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

/** 取最近一次调用传给 CLI 的参数（跳过入口路径） */
function lastCliArgs(): string[] {
  const args = mockExecFile.mock.calls[0][1] as string[]
  return args.slice(1) // [0] 是 CLI 入口
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

      expect(lastCliArgs()).toEqual(['search', '银行', '--fund'])
    })

    it('未指定 scope 时不追加参数', async () => {
      stubExecFile({ stdout: SEARCH_STDOUT })

      await service.search('腾讯')

      expect(lastCliArgs()).toEqual(['search', '腾讯'])
    })
  })

  describe('minute', () => {
    it('默认查当日，不传 --days', async () => {
      stubExecFile({ stdout: MINUTE_STDOUT })

      const result = await service.minute('sh600519')

      expect(lastCliArgs()).toEqual(['minute', 'sh600519'])
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

      expect(lastCliArgs()).toEqual(['minute', 'sh600519', '--days', '5'])
      expect(result.columns).toEqual(['code', 'date', 'time'])
    })

    it('无分时数据时返回空表格', async () => {
      stubExecFile({ stdout: '无分时数据' })

      const result = await service.minute('sh999999')

      expect(result.rows).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('调用方式', () => {
    it('经 node 执行 CLI 入口（而非直接执行 bin）', async () => {
      stubExecFile({ stdout: SEARCH_STDOUT })

      await service.search('腾讯')

      const [file, args] = mockExecFile.mock.calls[0] as [string, string[]]
      expect(file).toBe(process.execPath)
      expect(args[0]).toBe(CLI_ENTRY_PATH)
      expect(CLI_ENTRY_PATH).toContain('westock-data-clawhub')
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
