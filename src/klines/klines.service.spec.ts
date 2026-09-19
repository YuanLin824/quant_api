import { ConflictException, ServiceUnavailableException } from '@nestjs/common'
import type { Repository } from 'typeorm'
import type { StockSymbol } from '../symbols/entities/stock-symbol.entity'
import type { TdxService } from '../tdx/tdx.service'
import type { WestockCliService } from '../westock-cli/westock-cli.service'
import type { DailyKline } from './entities/daily-kline.entity'
import { KlinesService } from './klines.service'

// 把串行间隔置 0：否则每个用例都要真等「1 秒 × 股票数」，测试会慢到不可用
jest.mock('./klines.constants', () => ({
  ...jest.requireActual('./klines.constants'),
  KLINES_REQUEST_INTERVAL_MS: 0,
}))

/** 距今 offset 天的日期 */
function recentDate(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() - offset)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * 造一根 TDX K 线（上游单位：价格与成交额是「厘」，成交量是「手」）
 *
 * 取整数便于断言：10000 厘 = 10 元、100 手、1e8 厘 = 10 万元。
 */
function kbar(tradeDate: string) {
  return {
    time: new Date(`${tradeDate}T15:00:00`),
    open: 10000,
    high: 10050,
    low: 9950,
    close: 10000,
    volume: 100,
    amount: 100_000_000,
  }
}

/** CLI kline 表格的列名（实测顺序；**收盘价的列名是 `last` 不是 `close`**） */
const CLI_COLUMNS = [
  'date',
  'open',
  'last',
  'high',
  'low',
  'volume',
  'amount',
  'exchange',
  'change_pct',
]

/** 造一行 CLI kline 表格（值一律为字符串，且已是「元 / 手」） */
function cliRow(date: string) {
  return {
    date,
    open: '40.530',
    last: '40.590',
    high: '40.920',
    low: '40.430',
    volume: '485204',
    amount: '1972730000',
    exchange: '0.24',
    change_pct: '-0.0246305419',
  }
}

describe('KlinesService', () => {
  let service: KlinesService
  let tdx: { getKline: jest.Mock }
  let westock: { kline: jest.Mock }
  let symbolRepo: { find: jest.Mock }
  let qb: Record<string, jest.Mock>
  let repo: { findOne: jest.Mock; find: jest.Mock; count: jest.Mock; createQueryBuilder: jest.Mock }

  /** 收集所有写入过的行 */
  function writtenRows(): Record<string, string>[] {
    return qb.values.mock.calls.flatMap((call) => call[0] as Record<string, string>[])
  }

  beforeEach(() => {
    qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      // 清理超期数据走 delete 链
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      // upsert 不读返回值；purgeExpired 读 affected
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    }
    tdx = { getKline: jest.fn().mockResolvedValue({ count: 0, bars: [] }) }
    westock = { kline: jest.fn().mockResolvedValue({ columns: CLI_COLUMNS, rows: [], total: 0 }) }
    // 代码表里 A 股的市场键是 'cn'（交易所前缀编码在代码里）
    symbolRepo = { find: jest.fn().mockResolvedValue([{ code: 'sh600036' }]) }
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => qb),
    }

    service = new KlinesService(
      tdx as unknown as TdxService,
      westock as unknown as WestockCliService,
      repo as unknown as Repository<DailyKline>,
      symbolRepo as unknown as Repository<StockSymbol>
    )
  })

  describe('单位换算', () => {
    it('价格与成交额换算为元、成交量保持手', async () => {
      tdx.getKline.mockResolvedValue({ count: 1, bars: [kbar(recentDate(1))] })

      await service.sync('full')

      expect(writtenRows()[0]).toMatchObject({
        open: '10.000',
        high: '10.050',
        low: '9.950',
        close: '10.000',
        volume: '100', // 手，原值不动
        amount: '100000.000', // 1e8 厘 ÷ 1000
      })
    })

    it('日期按本地时区取，不因 UTC 偏移到前一天', async () => {
      const tradeDate = recentDate(1)
      tdx.getKline.mockResolvedValue({ count: 1, bars: [kbar(tradeDate)] })

      await service.sync('full')

      expect(writtenRows()[0].tradeDate).toBe(tradeDate)
    })
  })

  describe('时间窗', () => {
    it('丢弃早于两年的 bar', async () => {
      tdx.getKline.mockResolvedValue({
        count: 2,
        // 800 根可能回溯到 3 年多，必须自己按时间窗裁剪
        bars: [kbar('2020-01-02'), kbar(recentDate(1))],
      })

      await service.sync('full')

      expect(writtenRows().map((row) => row.tradeDate)).toEqual([recentDate(1)])
    })
  })

  describe('请求参数', () => {
    it('全量请求 800 根（上游硬上限）、增量请求 5 根', async () => {
      await service.sync('full')
      expect(tdx.getKline).toHaveBeenCalledWith('sh600036', 'day', 0, 800)

      tdx.getKline.mockClear()
      await service.sync('incremental')
      expect(tdx.getKline).toHaveBeenCalledWith('sh600036', 'day', 0, 5)
    })

    it('模式不传时：空表走全量、非空走增量', async () => {
      repo.findOne.mockResolvedValue(null)
      expect((await service.sync()).mode).toBe('full')

      repo.findOne.mockResolvedValue({ code: 'sh600036' })
      expect((await service.sync()).mode).toBe('incremental')
    })
  })

  describe('写入', () => {
    it('去重：同一 (code, tradeDate) 只写一次', async () => {
      const d = recentDate(1)
      tdx.getKline.mockResolvedValue({ count: 2, bars: [kbar(d), kbar(d)] })

      await service.sync('full')

      expect(writtenRows()).toHaveLength(1)
    })

    it('累积超过分片大小时分批写入（11 只 × 100 根 = 1100 行 → 2 批）', async () => {
      const codes = Array.from({ length: 11 }, (_, i) => `sh600${String(i).padStart(3, '0')}`)
      symbolRepo.find.mockResolvedValue(codes.map((code) => ({ code })))
      tdx.getKline.mockResolvedValue({
        count: 100,
        bars: Array.from({ length: 100 }, (_, i) => kbar(recentDate(i + 1))),
      })

      await service.sync('full')

      // 用 values 而非 execute 计数：后者还会被清理超期数据的 delete 用到
      expect(qb.values).toHaveBeenCalledTimes(2)
      for (const call of qb.values.mock.calls) {
        expect((call[0] as unknown[]).length).toBeLessThanOrEqual(1000)
      }
    })

    it('orUpdate 冲突键为 (code, trade_date)，只覆盖行情列', async () => {
      tdx.getKline.mockResolvedValue({ count: 1, bars: [kbar(recentDate(1))] })

      await service.sync('full')

      expect(qb.orUpdate).toHaveBeenCalledWith(
        ['open', 'high', 'low', 'close', 'volume', 'amount'],
        ['code', 'trade_date'],
        { skipUpdateIfNoValuesChanged: true }
      )
    })

    it('上游返回空时不触发写库（但与清理超期数据的调用无关）', async () => {
      await service.sync('full')

      expect(qb.values).not.toHaveBeenCalled()
    })
  })

  describe('串行与节奏', () => {
    it('请求严格串行：上一只结束后才发下一只', async () => {
      const codes = ['sh600036', 'sh600000', 'sh600004']
      symbolRepo.find.mockResolvedValue(codes.map((code) => ({ code })))

      const events: string[] = []
      tdx.getKline.mockImplementation((code: string) => {
        events.push(`start:${code}`)
        return new Promise((resolve) => {
          // 用真实的定时器模拟一次「在途请求」
          setTimeout(() => {
            events.push(`end:${code}`)
            resolve({ count: 0, bars: [] })
          }, 1)
        })
      })

      await service.sync('full')

      // 若并发发起，end 会晚于多个 start，顺序就会被打乱
      expect(events).toEqual([
        'start:sh600036',
        'end:sh600036',
        'start:sh600000',
        'end:sh600000',
        'start:sh600004',
        'end:sh600004',
      ])
    })

    it('相邻请求之间会等待（走 setTimeout），最后一只不再等', async () => {
      const codes = ['sh600036', 'sh600000']
      symbolRepo.find.mockResolvedValue(codes.map((code) => ({ code })))

      const spy = jest.spyOn(global, 'setTimeout')
      await service.sync('full')

      // 测试里间隔被 mock 成 0，但 sleep(0) 仍会排一次 setTimeout
      const delayCalls = spy.mock.calls.filter((call) => call[1] === 0)
      expect(delayCalls).toHaveLength(1) // 2 只股票 → 只有 1 次间隔
      spy.mockRestore()
    })
  })

  describe('清理超期数据', () => {
    it('同步后硬删除早于两年窗口的行，并回传条数', async () => {
      tdx.getKline.mockResolvedValue({ count: 1, bars: [kbar(recentDate(1))] })
      qb.execute.mockResolvedValue({ affected: 7 })

      const result = await service.sync('full')

      expect(qb.delete).toHaveBeenCalled()
      expect(qb.from).toHaveBeenCalled()
      expect(qb.where).toHaveBeenCalledWith('trade_date < :since', expect.any(Object))
      expect(result.purged).toBe(7)
    })

    it('增量模式同样会清理（过滤只挡新数据，旧数据靠删）', async () => {
      repo.findOne.mockResolvedValue({ code: 'sh600036' }) // 非空 → 增量
      qb.execute.mockResolvedValue({ affected: 3 })

      const result = await service.sync()

      expect(result.mode).toBe('incremental')
      expect(qb.delete).toHaveBeenCalled()
      expect(result.purged).toBe(3)
    })

    it('没有超期行时 purged 为 0', async () => {
      tdx.getKline.mockResolvedValue({ count: 1, bars: [kbar(recentDate(1))] })
      qb.execute.mockResolvedValue({ affected: 0 })

      const result = await service.sync('full')

      expect(result.purged).toBe(0)
    })
  })

  describe('实时查询', () => {
    it('走 westock CLI，不读库、不经 TDX', async () => {
      westock.kline.mockResolvedValue({
        columns: CLI_COLUMNS,
        rows: [cliRow('2026-09-18')],
        total: 1,
      })

      const rows = await service.getRealtime('sh600036')

      expect(westock.kline).toHaveBeenCalledWith('sh600036', {
        period: 'day',
        limit: 240,
        start: '1990-07-31', // start 不传时补默认值
      })
      expect(repo.find).not.toHaveBeenCalled()
      expect(tdx.getKline).not.toHaveBeenCalled()
      // CLI 的值已是「元 / 手」，直接透传不做换算
      expect(rows[0]).toEqual({
        code: 'sh600036',
        time: '2026-09-18',
        open: '40.530',
        high: '40.920',
        low: '40.430',
        close: '40.590', // 取自 CLI 的 last 列
        volume: '485204',
        amount: '1972730000',
      })
    })

    it('period 透传给上游，不传则为日线', async () => {
      await service.getRealtime('sh600036', { period: 'm60' })
      expect(westock.kline).toHaveBeenLastCalledWith(
        'sh600036',
        expect.objectContaining({ period: 'm60' })
      )

      await service.getRealtime('sh600036')
      expect(westock.kline).toHaveBeenLastCalledWith(
        'sh600036',
        expect.objectContaining({ period: 'day' })
      )
    })

    it('start 传了原样转发、不传补默认；end 不传则透传 undefined（由上游取当日）', async () => {
      await service.getRealtime('sh600036')
      expect(westock.kline).toHaveBeenLastCalledWith(
        'sh600036',
        expect.objectContaining({ start: '1990-07-31', end: undefined })
      )

      await service.getRealtime('sh600036', { start: '2026-09-01', end: '2026-09-18' })
      expect(westock.kline).toHaveBeenLastCalledWith(
        'sh600036',
        expect.objectContaining({ start: '2026-09-01', end: '2026-09-18' })
      )
    })

    it('fq 传了原样转发、不传则不补（与上游默认解耦，避免上游改动静默改变语义）', async () => {
      await service.getRealtime('sh600036', { fq: 'nofq' })
      expect(westock.kline).toHaveBeenLastCalledWith(
        'sh600036',
        expect.objectContaining({ fq: 'nofq' })
      )

      await service.getRealtime('sh600036')
      expect(westock.kline).toHaveBeenLastCalledWith(
        'sh600036',
        expect.objectContaining({ fq: undefined })
      )
    })

    it('时间归一化：日线原样、分钟级截掉秒', async () => {
      westock.kline.mockResolvedValue({
        columns: CLI_COLUMNS,
        rows: [cliRow('2026-09-18 15:00:00')],
        total: 1,
      })

      const rows = await service.getRealtime('sh600036', { period: 'm1' })

      // 不截秒的话与响应契约（`YYYY-MM-DD HH:mm`）对不上
      expect(rows[0].time).toBe('2026-09-18 15:00')
    })

    it('limit 超过上游上限时截断到 1000（否则会被静默少返回）', async () => {
      await service.getRealtime('sh600036', { limit: 5000 })

      expect(westock.kline).toHaveBeenCalledWith(
        'sh600036',
        expect.objectContaining({ limit: 1000 })
      )
    })

    it('上游返回空时返回空数组（列名不校验，空结果的 columns 也是空的）', async () => {
      westock.kline.mockResolvedValue({ columns: [], rows: [], total: 0 })

      await expect(service.getRealtime('sh600036')).resolves.toEqual([])
    })

    it('CLI 输出缺列时抛 503，而不是静默返回空值', async () => {
      // 例如 CLI 把收盘价列名从 last 改掉：按旧列名取值只会拿到 undefined
      westock.kline.mockResolvedValue({
        columns: CLI_COLUMNS.filter((name) => name !== 'last'),
        rows: [cliRow('2026-09-18')],
        total: 1,
      })

      await expect(service.getRealtime('sh600036')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      )
    })
  })

  describe('容错', () => {
    it('单只股票失败不中断整体，错误记入结果', async () => {
      symbolRepo.find.mockResolvedValue([{ code: 'sh600036' }, { code: 'sh600000' }])
      tdx.getKline
        .mockRejectedValueOnce(new Error('连接超时'))
        .mockResolvedValue({ count: 1, bars: [kbar(recentDate(1))] })

      const result = await service.sync('full')

      expect(result.total).toBe(2)
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors[0]).toContain('sh600036')
      expect(qb.values).toHaveBeenCalled()
    })

    it('标的代码表为空时抛 503 并提示先同步代码', async () => {
      symbolRepo.find.mockResolvedValue([])

      const promise = service.sync('full')
      await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException)
      await expect(promise).rejects.toThrow('请先执行 POST /api/symbols/sync')
    })

    it('同步执行中再次调用抛 409', async () => {
      let release: () => void = () => {}
      tdx.getKline.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ count: 0, bars: [] })
          })
      )

      const first = service.sync('full')
      await expect(service.sync('full')).rejects.toBeInstanceOf(ConflictException)

      release()
      await first
      await expect(service.sync('full')).resolves.toBeDefined()
    })
  })
})
