import {
  BadGatewayException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { TdxClient } from 'node-tdx-market'
import { ApiTdxService } from './api-tdx.service'

/** 构造上游分时点（价格单位：厘，1299520 厘 = 1299.52 元） */
function makeItem(price = 1299520, avgPrice = 1298000) {
  return { time: '0931', price, avgPrice, volume: 100 }
}

describe('ApiTdxService', () => {
  let service: ApiTdxService
  /** 记录 client.on 注册的监听器，便于在测试里触发事件 */
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

  const mockClient = {
    connect: jest.fn(),
    getMinute: jest.fn(),
    getHistoryMinute: jest.fn(),
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
    mockClient.getMinute.mockResolvedValue({ count: 1, items: [makeItem()] })
    mockClient.getHistoryMinute.mockResolvedValue({ count: 1, items: [makeItem()] })

    service = new ApiTdxService(mockClient as unknown as TdxClient)
  })

  describe('连接管理（懒连接）', () => {
    it('首次调用才建连，后续调用复用连接', async () => {
      await service.getMinute('600519.SH')
      await service.getMinute('600519.SH')

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })

    it('并发调用只建连一次（复用同一个 connect Promise）', async () => {
      await Promise.all([service.getMinute('600519.SH'), service.getMinute('600519.SH')])

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
    })

    it('连接失败 → 503，且下次调用可重试（不永久卡死）', async () => {
      mockClient.connect.mockRejectedValueOnce(new Error('连接超时'))

      await expect(service.getMinute('600519.SH')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      )

      await service.getMinute('600519.SH')
      expect(mockClient.connect).toHaveBeenCalledTimes(2)
    })

    it('断线后下次调用重新建连', async () => {
      await service.getMinute('600519.SH')

      emit('disconnected') // 模拟库抛出断线事件

      await service.getMinute('600519.SH')
      expect(mockClient.connect).toHaveBeenCalledTimes(2)
    })
  })

  describe('getMinute（当日分时）', () => {
    it('把 thscode 转成通达信代码并换算价格为元', async () => {
      const data = await service.getMinute('600519.SH')

      expect(mockClient.getMinute).toHaveBeenCalledWith('sh600519')
      expect(data.count).toBe(1)
      expect(data.items[0]).toEqual({
        time: '0931',
        price: 1299.52,
        avgPrice: 1298,
        volume: 100,
      })
    })

    it.each([
      ['000001.SZ', 'sz000001'],
      ['430047.BJ', 'bj430047'],
      ['600519.sh', 'sh600519'], // 后缀大小写不敏感
    ])('%s → %s', async (thscode, expected) => {
      await service.getMinute(thscode)

      expect(mockClient.getMinute).toHaveBeenCalledWith(expected)
    })

    it.each([
      ['600519', '无效的标的代码'], // 缺交易所后缀
      ['600519.XX', '不支持的交易所后缀'],
      ['', '无效的标的代码'],
    ])('非法代码 %s → 400 且不发起连接', async (thscode, message) => {
      await expect(service.getMinute(thscode)).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.getMinute(thscode)).rejects.toThrow(message)
      expect(mockClient.connect).not.toHaveBeenCalled()
    })

    it('调用期异常 → 502', async () => {
      mockClient.getMinute.mockRejectedValue(new Error('socket closed'))

      await expect(service.getMinute('600519.SH')).rejects.toBeInstanceOf(BadGatewayException)
    })
  })

  describe('getHistoryMinute（历史分时）', () => {
    it('透传 thscode 与日期', async () => {
      const data = await service.getHistoryMinute('600519.SH', 20261008)

      expect(mockClient.getHistoryMinute).toHaveBeenCalledWith('sh600519', 20261008)
      expect(data.items[0].price).toBe(1299.52)
    })

    it.each([[2026100], [0], [-1], [20261008.5], [NaN]])(
      '非法日期 %s → 400 且不发起连接',
      async (date) => {
        await expect(service.getHistoryMinute('600519.SH', date)).rejects.toBeInstanceOf(
          BadRequestException
        )
        expect(mockClient.connect).not.toHaveBeenCalled()
      }
    )
  })
})
