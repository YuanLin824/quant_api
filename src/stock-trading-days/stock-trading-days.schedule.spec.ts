import { Logger } from '@nestjs/common'
import { StockTradingDaysSchedule } from './stock-trading-days.schedule'
import type { StockTradingDaysService } from './stock-trading-days.service'

describe('StockTradingDaysSchedule', () => {
  let schedule: StockTradingDaysSchedule
  const mockService = { syncStockTradingDays: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    Logger.overrideLogger(false)
    mockService.syncStockTradingDays.mockResolvedValue({
      fetched: 242,
      skipped: false,
      costMs: 100,
    })
    schedule = new StockTradingDaysSchedule(mockService as unknown as StockTradingDaysService)
  })

  it('触发时委托给 StockTradingDaysService.syncStockTradingDays，自身不含业务逻辑', async () => {
    await schedule.handleSync()

    expect(mockService.syncStockTradingDays).toHaveBeenCalledTimes(1)
  })

  it('同步异常被本类吞掉（框架外层另有兜底），不影响后续调度', async () => {
    mockService.syncStockTradingDays.mockRejectedValue(new Error('上游限流'))

    await expect(schedule.handleSync()).resolves.toBeUndefined()
  })
})
