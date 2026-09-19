import { ServiceUnavailableException } from '@nestjs/common'
import { StockSDK } from 'stock-sdk'
import { StockSdkService } from './stock-sdk.service'

jest.mock('stock-sdk', () => ({ StockSDK: jest.fn() }))

const MockStockSDK = StockSDK as unknown as jest.Mock

describe('StockSdkService', () => {
  let service: StockSdkService
  let codes: { cn: jest.Mock; us: jest.Mock; hk: jest.Mock; fund: jest.Mock }

  beforeEach(() => {
    codes = {
      cn: jest.fn().mockResolvedValue(['sh600000']),
      us: jest.fn().mockResolvedValue(['usAAPL']),
      hk: jest.fn().mockResolvedValue(['hk00700']),
      fund: jest.fn().mockResolvedValue(['005827']),
    }
    MockStockSDK.mockImplementation(() => ({ codes, clearCaches: jest.fn() }))

    service = new StockSdkService()
  })

  describe('市场分支', () => {
    it('cn 透传 simple 与 exchange', async () => {
      await service.getCodeList({ market: 'cn', simple: false, exchange: 'sh' })

      expect(codes.cn).toHaveBeenCalledWith({ simple: false, market: 'sh' })
    })

    it('cn 不传可选参数时给出空对象（交由上游取默认值）', async () => {
      await service.getCodeList({ market: 'cn' })

      expect(codes.cn).toHaveBeenCalledWith({})
    })

    it('us 只接受 simple，忽略 exchange', async () => {
      await service.getCodeList({ market: 'us', simple: true, exchange: 'sh' })

      expect(codes.us).toHaveBeenCalledWith({ simple: true })
    })

    it('hk / fund 不接受任何参数', async () => {
      await service.getCodeList({ market: 'hk' })
      expect(codes.hk).toHaveBeenCalledWith()

      await service.getCodeList({ market: 'fund' })
      expect(codes.fund).toHaveBeenCalledWith()
    })

    it('按上游顺序返回代码数组', async () => {
      codes.cn.mockResolvedValue(['sh600000', 'sz000001'])

      await expect(service.getCodeList({ market: 'cn' })).resolves.toEqual(['sh600000', 'sz000001'])
    })
  })

  describe('代码格式规范化', () => {
    it('A 股已带前缀，原样返回', async () => {
      codes.cn.mockResolvedValue(['sh600036', 'sz000001', 'bj920000'])

      await expect(service.getCodeList({ market: 'cn' })).resolves.toEqual([
        'sh600036',
        'sz000001',
        'bj920000',
      ])
    })

    it('港股是纯数字，补 hk 前缀', async () => {
      // 上游实测返回形如 '00700'，不带前缀
      codes.hk.mockResolvedValue(['00700', '08003'])

      await expect(service.getCodeList({ market: 'hk' })).resolves.toEqual(['hk00700', 'hk08003'])
    })

    it('美股是东财 secid 格式，前缀换成 us 且保留代码自身的点号', async () => {
      // 上游实测返回形如 '105.AAPL'（105=NASDAQ / 106=NYSE / 107=AMEX）
      codes.us.mockResolvedValue(['105.AAPL', '106.BRK.A'])

      await expect(service.getCodeList({ market: 'us' })).resolves.toEqual(['usAAPL', 'usBRK.A'])
    })

    it('已符合格式时不叠加前缀（幂等）', async () => {
      codes.hk.mockResolvedValue(['hk00700'])

      await expect(service.getCodeList({ market: 'hk' })).resolves.toEqual(['hk00700'])
    })

    it('规范化后撞车的代码合并（同一标的挂两个板块）', async () => {
      // 105.PC 与 106.PC 规范后都是 usPC
      codes.us.mockResolvedValue(['105.PC', '106.PC'])

      await expect(service.getCodeList({ market: 'us' })).resolves.toEqual(['usPC'])
    })

    it('基金是纯数字，原样保留（不加前缀）', async () => {
      codes.fund.mockResolvedValue(['005827', '110011'])

      await expect(service.getCodeList({ market: 'fund' })).resolves.toEqual(['005827', '110011'])
    })

    it('A 股取纯数字（simple=true）时不补前缀', async () => {
      codes.cn.mockResolvedValue(['600036', '000001'])

      await expect(service.getCodeList({ market: 'cn', simple: true })).resolves.toEqual([
        '600036',
        '000001',
      ])
    })
  })

  describe('错误处理', () => {
    it('上游失败转 503，原始错误不进 message', async () => {
      codes.cn.mockRejectedValue(new Error('fetch failed: ECONNREFUSED 10.0.0.1'))

      const promise = service.getCodeList({ market: 'cn' })
      await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException)
      await expect(promise).rejects.toThrow('证券代码服务调用失败，请稍后重试')
      await expect(promise).rejects.not.toThrow(/ECONNREFUSED/)
    })
  })
})
