import { Logger } from '@nestjs/common'
import { StockKlineSchedule } from './stock-kline.schedule'
import type { StockKlineService } from './stock-kline.service'

describe('StockKlineSchedule', () => {
  let schedule: StockKlineSchedule
  const mockService = {
    syncDailyKlines: jest.fn(),
    syncMinuteKlines: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    Logger.overrideLogger(false)
    schedule = new StockKlineSchedule(mockService as unknown as StockKlineService)
  })

  it('日 K 触发时委托给 syncDailyKlines，自身不含业务逻辑', async () => {
    await schedule.handleDailySync()

    expect(mockService.syncDailyKlines).toHaveBeenCalledTimes(1)
  })

  it('分钟 K 触发时委托给 syncMinuteKlines，自身不含业务逻辑', async () => {
    await schedule.handleMinuteSync()

    expect(mockService.syncMinuteKlines).toHaveBeenCalledTimes(1)
  })

  it('同步异常被本类吞掉（框架外层另有兜底），不影响后续调度', async () => {
    mockService.syncDailyKlines.mockRejectedValue(new Error('上游限流'))
    mockService.syncMinuteKlines.mockRejectedValue(new Error('行情服务器断连'))

    await expect(schedule.handleDailySync()).resolves.toBeUndefined()
    await expect(schedule.handleMinuteSync()).resolves.toBeUndefined()
  })
})
