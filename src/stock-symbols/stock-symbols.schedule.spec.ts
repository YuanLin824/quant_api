import { Logger } from '@nestjs/common'
import { StockSymbolsSchedule } from './stock-symbols.schedule'
import type { StockSymbolsService } from './stock-symbols.service'

describe('StockSymbolsSchedule', () => {
  let schedule: StockSymbolsSchedule
  const mockService = { syncSymbols: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    Logger.overrideLogger(false)
    mockService.syncSymbols.mockResolvedValue({
      fetched: 7009,
      deactivated: 0,
      skipped: false,
      costMs: 100,
    })
    schedule = new StockSymbolsSchedule(mockService as unknown as StockSymbolsService)
  })

  it('触发时委托给 StockSymbolsService.syncSymbols，自身不含业务逻辑', async () => {
    await schedule.handleSync()

    expect(mockService.syncSymbols).toHaveBeenCalledTimes(1)
  })

  it('同步异常被本类吞掉（框架外层另有兜底），不影响后续调度', async () => {
    mockService.syncSymbols.mockRejectedValue(new Error('上游限流'))

    await expect(schedule.handleSync()).resolves.toBeUndefined()
  })
})
