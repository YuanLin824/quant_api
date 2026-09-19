import { SymbolsScheduler } from './symbols.scheduler'
import type { SymbolsService } from './symbols.service'

/**
 * `@nestjs/schedule` 12.x 是**纯 ESM**（`"type": "module"`），而 Jest 跑在 CJS
 * 模式下、不支持 `require(esm)`（Node 26 运行时支持，故应用本身没问题）。
 * 这里把装饰器换成空实现——本 spec 只验证调度器的异常吞噬行为，
 * 不需要真实的 cron 调度。
 */
jest.mock('@nestjs/schedule', () => ({ Cron: jest.fn(() => jest.fn()) }))

/**
 * 调度器只做「触发 + 异常吞噬」，故测试聚焦一条核心约束：
 * service 抛错时 `handleDaily` 必须 **resolve** 而非 reject。
 *
 * 原因是全局 `AllExceptionsFilter` 依赖 HTTP 上下文（`host.switchToHttp()` /
 * `httpAdapter.reply()`）——cron 抛出的异常进入该过滤器会在 `getResponse()`
 * 处二次报错，把真实错误盖掉。
 */
describe('SymbolsScheduler', () => {
  function makeScheduler(syncAll: jest.Mock): SymbolsScheduler {
    return new SymbolsScheduler({ syncAll } as unknown as SymbolsService)
  }

  it('service 抛错时 handleDaily 必须 resolve（异常不得冒泡到调度器）', async () => {
    const scheduler = makeScheduler(jest.fn().mockRejectedValue(new Error('上游不可达')))

    await expect(scheduler.handleDaily()).resolves.toBeUndefined()
  })

  it('同步完成时 resolve', async () => {
    const scheduler = makeScheduler(
      jest.fn().mockResolvedValue({
        results: [
          { market: 'cn', fetched: 5564, stored: 5564, inserted: 5564 },
          { market: 'hk', fetched: 4695, stored: 4695, inserted: 4695 },
        ],
        durationMs: 1234,
      })
    )

    await expect(scheduler.handleDaily()).resolves.toBeUndefined()
  })

  it('各市场全部失败时仍 resolve', async () => {
    const scheduler = makeScheduler(
      jest.fn().mockResolvedValue({
        results: [{ market: 'cn', fetched: 0, stored: 0, inserted: 0, error: '连接超时' }],
        durationMs: 10000,
      })
    )

    await expect(scheduler.handleDaily()).resolves.toBeUndefined()
  })
})
