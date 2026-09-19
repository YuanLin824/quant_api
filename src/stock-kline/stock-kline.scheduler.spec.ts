import { StockKlineScheduler } from './stock-kline.scheduler'
import type { StockKlineService } from './stock-kline.service'

/**
 * `@nestjs/schedule` 12.x 是**纯 ESM**（`"type": "module"`），而 Jest 跑在 CJS
 * 模式下、不支持 `require(esm)`（Node 运行时支持，故应用本身没问题）。
 * 这里把装饰器换成空实现——本 spec 只验证调度器的异常吞噬行为。
 */
jest.mock('@nestjs/schedule', () => ({ Cron: jest.fn(() => jest.fn()) }))

/**
 * 核心约束同 symbols 调度器：service 抛错时 `handleDaily` 必须 **resolve** 而非 reject。
 * 全局 `AllExceptionsFilter` 依赖 HTTP 上下文，cron 抛出的异常进入该过滤器会在
 * `getResponse()` 处二次报错，把真实错误盖掉。
 */
describe('StockKlineScheduler', () => {
  function makeScheduler(sync: jest.Mock): StockKlineScheduler {
    return new StockKlineScheduler({ sync } as unknown as StockKlineService)
  }

  it('service 抛错时 handleDaily 必须 resolve', async () => {
    const scheduler = makeScheduler(jest.fn().mockRejectedValue(new Error('标的代码表为空')))

    await expect(scheduler.handleDaily()).resolves.toBeUndefined()
  })

  it('同步完成时 resolve', async () => {
    const scheduler = makeScheduler(
      jest.fn().mockResolvedValue({
        mode: 'incremental',
        total: 5400,
        succeeded: 5390,
        failed: 10,
        rows: 27000,
        durationMs: 120000,
        errors: [],
      })
    )

    await expect(scheduler.handleDaily()).resolves.toBeUndefined()
  })
})
