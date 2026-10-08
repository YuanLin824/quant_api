import {
  BadGatewayException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { TdxClient } from 'node-tdx-market'
import { ApiTdxService } from './api-tdx.service'

/** 构造上游 K 线（价格单位：厘，1299520 厘 = 1299.52 元） */
function makeBar(close = 1299520) {
  return {
    time: new Date('2026-10-08T00:00:00+08:00'),
    open: 1290880,
    high: 1305000,
    low: 1286000,
    close,
    volume: 2324759,
    amount: 3003033719.95,
  }
}

describe('ApiTdxService', () => {
  let service: ApiTdxService
  /** 记录 client.on 注册的监听器，便于在测试里触发事件 */
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

  const mockClient = {
    connect: jest.fn(),
    getKline: jest.fn(),
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      ;(listeners[event] ??= []).push(cb)
    }),
  }

  /** 触发指定事件的所有监听器（模拟库抛出事件） */
  const emit = (event: string) => {
    for (const cb of listeners[event] ?? []) cb()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(listeners)) delete listeners[key]
    Logger.overrideLogger(false)

    mockClient.connect.mockResolvedValue('1.2.3.4:7709')
    mockClient.getKline.mockResolvedValue({ count: 1, bars: [makeBar()] })

    service = new ApiTdxService(mockClient as unknown as TdxClient)
  })

  describe('连接管理（懒连接）', () => {
    it('首次调用才建连，后续调用复用连接', async () => {
      await service.getKlines({ thscode: '600519.SH' })
      await service.getKlines({ thscode: '600519.SH' })

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })

    it('并发调用只建连一次（复用同一个 connect Promise）', async () => {
      await Promise.all([
        service.getKlines({ thscode: '600519.SH' }),
        service.getKlines({ thscode: '600519.SH' }),
      ])

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })

    it('连接失败 → 503，且下次调用可重试（不永久卡死）', async () => {
      mockClient.connect.mockRejectedValueOnce(new Error('连接超时'))

      await expect(service.getKlines({ thscode: '600519.SH' })).rejects.toBeInstanceOf(
        ServiceUnavailableException
      )

      await service.getKlines({ thscode: '600519.SH' })
      expect(mockClient.connect).toHaveBeenCalledTimes(2)
    })

    it('断线后下次调用重新建连', async () => {
      await service.getKlines({ thscode: '600519.SH' })

      emit('disconnected') // 模拟库抛出断线事件

      await service.getKlines({ thscode: '600519.SH' })
      expect(mockClient.connect).toHaveBeenCalledTimes(2)
    })
  })

  describe('getKlines（K 线）', () => {
    it('把 thscode 转成通达信代码，价格由厘换算为元', async () => {
      const bars = await service.getKlines({ thscode: '600519.SH' })

      expect(mockClient.getKline).toHaveBeenCalledWith({
        code: 'sh600519',
        category: 9, // Day
        start: 0,
        count: 100,
      })
      expect(bars).toHaveLength(1)
      expect(bars[0]).toMatchObject({
        open: 1290.88,
        high: 1305,
        low: 1286,
        close: 1299.52,
        volume: 2324759,
        // 成交额与价格同为「厘」，需换算为元
        amount: 3003033.71995,
      })
      expect(bars[0].time).toBeInstanceOf(Date)
    })

    it.each([
      ['1m', 7],
      ['5m', 0],
      ['15m', 1],
      ['30m', 2],
      ['60m', 3],
      ['day', 9],
      ['week', 5],
      ['month', 6],
      ['quarter', 10],
      ['year', 11],
    ] as const)('周期 %s → 库的枚举值 %i', async (category, expected) => {
      await service.getKlines({ thscode: '600519.SH', category })

      expect(mockClient.getKline).toHaveBeenCalledWith(
        expect.objectContaining({ category: expected })
      )
    })

    it('显式指定根数时透传给上游', async () => {
      await service.getKlines({ thscode: '600519.SH', count: 800 })

      expect(mockClient.getKline).toHaveBeenCalledWith(expect.objectContaining({ count: 800 }))
    })

    it('显式指定偏移时透传给上游（用于取更早的历史）', async () => {
      await service.getKlines({ thscode: '600519.SH', start: 800, count: 400 })

      expect(mockClient.getKline).toHaveBeenCalledWith(
        expect.objectContaining({ start: 800, count: 400 })
      )
    })

    it.each([
      ['000001.SZ', 'sz000001'],
      ['430047.BJ', 'bj430047'],
      ['600519.sh', 'sh600519'], // 后缀大小写不敏感
    ])('%s → %s', async (thscode, expected) => {
      await service.getKlines({ thscode })

      expect(mockClient.getKline).toHaveBeenCalledWith(expect.objectContaining({ code: expected }))
    })

    it.each([
      [{ thscode: '' }, '标的代码不能为空'],
      [{ thscode: '600519' }, '无效的标的代码'], // 缺交易所后缀
      [{ thscode: '600519.XX' }, '不支持的交易所后缀'],
      [{ thscode: '600519.SH', category: '2h' }, 'K 线周期不在支持范围内'],
      [{ thscode: '600519.SH', count: 0 }, 'K 线根数至少为 1'],
      [{ thscode: '600519.SH', count: 801 }, 'K 线根数不能超过 800'],
      [{ thscode: '600519.SH', start: -1 }, 'K 线偏移不能为负数'],
    ])('入参校验 %j → 400 且不发起连接', async (dto, message) => {
      await expect(service.getKlines(dto as never)).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.getKlines(dto as never)).rejects.toThrow(message)
      expect(mockClient.connect).not.toHaveBeenCalled()
    })

    it('调用期异常 → 502', async () => {
      mockClient.getKline.mockRejectedValue(new Error('socket closed'))

      await expect(service.getKlines({ thscode: '600519.SH' })).rejects.toBeInstanceOf(
        BadGatewayException
      )
    })
  })
})
