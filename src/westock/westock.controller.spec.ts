import type { GetKlineQueryDto, GetMinuteQueryDto, GetSearchQueryDto } from './dto'
import { WestockController } from './westock.controller'
import type { WestockService } from './westock.service'

/**
 * 控制器只做「查参 → service」的透传，故这里不测业务逻辑（那是 service.spec 的事），
 * 只钉住**每个 DTO 字段都被原样传给 service**。
 *
 * 这层测试是必要的：漏传一个字段是**静默**的——参数被丢弃、接口照样返回 200 和一份
 * 看似正常的数据，只有 service 层的测试永远发现不了（它直接构造 options，不经控制器）。
 */
describe('WestockController', () => {
  let controller: WestockController
  let service: { search: jest.Mock; minute: jest.Mock; kline: jest.Mock }

  beforeEach(() => {
    service = { search: jest.fn(), minute: jest.fn(), kline: jest.fn() }
    controller = new WestockController(service as unknown as WestockService)
  })

  /** 取某个 service 方法最近一次收到的参数数组 */
  function lastCall(method: keyof typeof service): unknown[] {
    return service[method].mock.calls[0] as unknown[]
  }

  describe('search', () => {
    it('keyword 与 scope 原样透传', async () => {
      service.search.mockResolvedValue({})

      const query: GetSearchQueryDto = { keyword: '腾讯', scope: 'stock' }
      await controller.search(query)

      expect(lastCall('search')).toEqual(['腾讯', 'stock'])
    })

    it('未传 scope 时透传 undefined（由 service 决定默认行为）', async () => {
      service.search.mockResolvedValue({})

      await controller.search({ keyword: '腾讯' })

      expect(lastCall('search')).toEqual(['腾讯', undefined])
    })
  })

  describe('minute', () => {
    it('code 与 days 原样透传', async () => {
      service.minute.mockResolvedValue({})

      const query: GetMinuteQueryDto = { code: 'sh600519', days: 5 }
      await controller.minute(query)

      expect(lastCall('minute')).toEqual(['sh600519', { days: 5 }])
    })
  })

  describe('kline', () => {
    it('全部查询参数原样透传（含 start/end）', async () => {
      service.kline.mockResolvedValue({})

      const query: GetKlineQueryDto = {
        code: 'sh600519',
        period: 'm5',
        limit: 240,
        fq: 'qfq',
        start: '2026-09-14',
        end: '2026-09-18',
      }
      await controller.kline(query)

      expect(lastCall('kline')).toEqual([
        'sh600519',
        { period: 'm5', limit: 240, fq: 'qfq', start: '2026-09-14', end: '2026-09-18' },
      ])
    })

    /**
     * 兜底：DTO 新增字段却忘了在控制器透传时，上面的用例仍会通过
     * （它只断言已知字段），故这里单独比对**键集合**。
     *
     * 用 `Required<>` 是为了让「DTO 加了字段但本用例没跟上」变成编译错误，
     * 而不是悄悄少测一个字段。
     */
    it('未漏传任何 DTO 字段', async () => {
      service.kline.mockResolvedValue({})

      const query: Required<GetKlineQueryDto> = {
        code: 'sh600519',
        period: 'day',
        limit: 240,
        fq: 'qfq',
        start: '2026-01-01',
        end: '2026-09-18',
      }
      await controller.kline(query)

      const [, options] = lastCall('kline') as [string, Record<string, unknown>]
      const expectedKeys = (Object.keys(query) as (keyof GetKlineQueryDto)[])
        .filter((key) => key !== 'code')
        .sort()
      expect(Object.keys(options).sort()).toEqual(expectedKeys)
    })
  })

  it('返回统一响应包装 { code, message, data }', async () => {
    service.search.mockResolvedValue({ rows: [], total: 0 })

    await expect(controller.search({ keyword: '腾讯' })).resolves.toEqual({
      code: 200,
      message: '获取成功',
      data: { rows: [], total: 0 },
    })
  })
})
