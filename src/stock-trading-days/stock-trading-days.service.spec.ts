import { Logger } from '@nestjs/common'
import type { Repository } from 'typeorm'
import type { ApiThsService } from '../api-ths/api-ths.service'
import type { ThsTradingDay } from '../api-ths/api-ths.types'
import type { StockTradingDay } from './entities/stock-trading-day.entity'
import { StockTradingDaysService } from './stock-trading-days.service'

/** 生成交易日（date 为 yyyyMMdd，date_ms 为该日北京时间 0 点） */
function makeDays(dates: string[]): ThsTradingDay[] {
  return dates.map((date) => ({
    date,
    date_ms: Date.parse(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+08:00`
    ),
  }))
}

describe('StockTradingDaysService', () => {
  let service: StockTradingDaysService
  const mockRepo = {
    count: jest.fn(),
    find: jest.fn(),
    upsert: jest.fn(),
  }
  const mockThsApi = { getTradingDays: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    Logger.overrideLogger(false)
    mockRepo.count.mockResolvedValue(1)
    mockRepo.find.mockResolvedValue([])
    mockRepo.upsert.mockResolvedValue({})
    service = new StockTradingDaysService(
      mockRepo as unknown as Repository<StockTradingDay>,
      mockThsApi as unknown as ApiThsService
    )
  })

  describe('syncStockTradingDays', () => {
    it('按 date upsert，字段完整映射', async () => {
      mockThsApi.getTradingDays.mockResolvedValue(makeDays(['20261008', '20261009']))

      const result = await service.syncStockTradingDays()

      expect(result).toMatchObject({ fetched: 2, skipped: false })

      const [rows, conflictPaths] = mockRepo.upsert.mock.calls[0] as [
        Record<string, unknown>[],
        string[],
      ]
      expect(rows).toHaveLength(2)
      expect(rows[0].date).toBe('20261008')
      expect(rows[0].dateMs).toBeInstanceOf(Date)
      expect(rows[0].syncAt).toBeInstanceOf(Date)
      expect(Object.keys(rows[0]).sort()).toEqual(['date', 'dateMs', 'syncAt'])
      // 冲突键与主键一致（date 既是主键也是 upsert 的冲突目标）
      expect(conflictPaths).toEqual(['date'])
    })

    it('上游返回空列表时跳过写入', async () => {
      mockThsApi.getTradingDays.mockResolvedValue([])

      const result = await service.syncStockTradingDays()

      expect(result).toMatchObject({ fetched: 0, skipped: false })
      expect(mockRepo.upsert).not.toHaveBeenCalled()
    })

    it('上游异常向上传播，且不写库', async () => {
      mockThsApi.getTradingDays.mockRejectedValue(new Error('上游限流'))

      await expect(service.syncStockTradingDays()).rejects.toThrow('上游限流')
      expect(mockRepo.upsert).not.toHaveBeenCalled()
    })

    it('异常后释放防重入标志，后续调用仍可进行', async () => {
      mockThsApi.getTradingDays.mockRejectedValueOnce(new Error('上游限流'))
      await expect(service.syncStockTradingDays()).rejects.toThrow('上游限流')

      mockThsApi.getTradingDays.mockResolvedValue(makeDays(['20261008']))
      await expect(service.syncStockTradingDays()).resolves.toMatchObject({ fetched: 1 })
    })

    it('并发调用：后者返回 skipped，且不重复拉取上游', async () => {
      let releaseFetch!: (days: ThsTradingDay[]) => void
      mockThsApi.getTradingDays.mockReturnValue(
        new Promise<ThsTradingDay[]>((resolve) => {
          releaseFetch = resolve
        })
      )

      const first = service.syncStockTradingDays()
      const second = await service.syncStockTradingDays()

      expect(second).toMatchObject({ skipped: true, fetched: 0 })
      expect(mockThsApi.getTradingDays).toHaveBeenCalledTimes(1)

      releaseFetch(makeDays(['20261008']))
      await first
    })
  })

  describe('onApplicationBootstrap（首次补齐）', () => {
    it('表为空时触发同步', async () => {
      mockRepo.count.mockResolvedValue(0)
      mockThsApi.getTradingDays.mockResolvedValue(makeDays(['20261008']))

      service.onApplicationBootstrap()
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockThsApi.getTradingDays).toHaveBeenCalledTimes(1)
    })

    it('表非空时不触发同步（后续重启不再拉取）', async () => {
      mockRepo.count.mockResolvedValue(242)

      service.onApplicationBootstrap()
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockThsApi.getTradingDays).not.toHaveBeenCalled()
    })
  })
})
