import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { THS_TICKER_SWEEP_PAGE_SIZE } from './api-ths.constants'
import { ApiThsService } from './api-ths.service'
import type { ThsPriceBar, ThsTickerItem, ThsTradingDay } from './api-ths.types'
import type { HistoricalKlineQueryDto } from './dto/historical-kline.dto'
import type { TickerListQueryDto } from './dto/ticker-list.dto'

/** 生成 n 条标的（内容不重要，只用于验证条数与分页边界） */
function makeItems(n: number, startIndex = 0): ThsTickerItem[] {
  return Array.from({ length: n }, (_, i) => ({
    thscode: `6000${startIndex + i}.SH`,
    ticker: `6000${startIndex + i}`,
    name: `标的${startIndex + i}`,
    exchange: 'SH',
    asset_type: 'a-share',
    currency: 'CNY',
    list_date: null,
    end_date: null,
    last_trade_date: null,
    last_delivery_date: null,
  }))
}

/** 生成 n 根 K 线 */
function makeBars(n: number): ThsPriceBar[] {
  return Array.from({ length: n }, (_, i) => ({
    date_ms: 1716134400000 + i * 86_400_000,
    open_price: 1600 + i,
    high_price: 1620 + i,
    low_price: 1590 + i,
    close_price: 1610 + i,
    volume: 1_000_000 + i,
    turnover: 1_600_000_000 + i,
  }))
}

/** 生成交易日序列（date 为 yyyyMMdd，测试只依赖它做判断） */
function makeDays(dates: string[]): ThsTradingDay[] {
  return dates.map((date) => ({ date, date_ms: 0 }))
}

/** 构造成功响应（HTTP 200 + code=0）；data 结构按接口而定 */
function okResponse<T>(data: T): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ code: 0, message: 'success', request_id: 'req-1', data }),
  } as Response
}

/** 构造业务错误响应（HTTP 200 + code !== 0，上游业务错误均走此形态） */
function errorResponse(code: number): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ code, message: 'upstream detail', request_id: 'req-1', data: null }),
  } as Response
}

/** 构造一个 name 为 TimeoutError 的异常（AbortSignal.timeout 的真实抛出形态） */
function timeoutError(): Error {
  const err = new Error('The operation was aborted due to timeout')
  err.name = 'TimeoutError'
  return err
}

describe('ApiThsService', () => {
  let service: ApiThsService
  let fetchSpy: jest.SpyInstance
  const mockConfig = { get: jest.fn() }

  /** 取出第 index 次 fetch 调用解析后的 URL */
  const calledUrl = (index = 0): URL => {
    const [input] = fetchSpy.mock.calls[index] as [URL, RequestInit]
    return input instanceof URL ? input : new URL(String(input))
  }

  beforeEach(() => {
    jest.clearAllMocks()
    Logger.overrideLogger(false) // 静音 service 内部日志，避免污染测试输出
    mockConfig.get.mockReturnValue({ apiKey: 'test-key' })
    service = new ApiThsService(mockConfig as unknown as ConfigService)
    // 默认拒绝：任何未被显式 mock 的调用都是测试遗漏，绝不能真的打到上游
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('单元测试不应发起真实网络请求'))
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('getTickerList（单页）', () => {
    it('注入 X-api-key 与查询参数，返回解包后的 item', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: makeItems(2) }))

      const items = await service.getTickerList({ assetType: 'a-share', limit: 5, offset: 10 })

      expect(items).toHaveLength(2)
      const url = calledUrl()
      expect(url.origin + url.pathname).toBe('https://fuyao.aicubes.cn/api/meta/tickers/list')
      expect(url.searchParams.get('asset_type')).toBe('a-share')
      expect(url.searchParams.get('limit')).toBe('5')
      expect(url.searchParams.get('offset')).toBe('10')
      const [, init] = fetchSpy.mock.calls[0] as [URL, RequestInit]
      expect((init.headers as Record<string, string>)['X-api-key']).toBe('test-key')
    })

    it('assetType 传数组：拼成逗号分隔并去重', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: [] }))

      await service.getTickerList({ assetType: ['fund-etf', 'fund-lof', 'fund-etf'] })

      expect(calledUrl().searchParams.get('asset_type')).toBe('fund-etf,fund-lof')
    })

    it('省略可选参数：不发送 asset_type，limit/offset 取默认值', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: [] }))

      await service.getTickerList({})

      const url = calledUrl()
      expect(url.searchParams.has('asset_type')).toBe(false)
      expect(url.searchParams.get('limit')).toBe('1000')
      expect(url.searchParams.get('offset')).toBe('0')
    })

    it('上游返回成功但缺 item 字段：兜底为空数组而非抛错', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          message: 'success',
          request_id: 'r',
          data: { timestamp: 1 },
        }),
      } as Response)

      await expect(service.getTickerList({})).resolves.toEqual([])
    })
  })

  describe('入参校验（本模块无 controller，不经 ValidationPipe）', () => {
    it.each([
      [{ limit: 0 }, '单页条数至少为 1'],
      [{ limit: 1.5 }, '单页条数必须是整数'],
      [{ limit: 20_000 }, '单页条数不能超过 10000'],
      [{ offset: -1 }, '分页偏移不能为负数'],
      [{ assetType: 'not-exist' }, '资产类型不在支持范围内'],
    ])('非法入参 %j → 400 且不向上游发起请求', async (dto, message) => {
      await expect(service.getTickerList(dto as TickerListQueryDto)).rejects.toBeInstanceOf(
        BadRequestException
      )
      await expect(service.getTickerList(dto as TickerListQueryDto)).rejects.toThrow(message)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('getAllTickers（自动翻页）', () => {
    it('单页不满即取尽：只请求一次', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: makeItems(1431) }))

      const items = await service.getAllTickers('a-share-index')

      expect(items).toHaveLength(1431)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('满页续取，到不满页终止：offset 按页递增', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          okResponse({ timestamp: 1, item: makeItems(THS_TICKER_SWEEP_PAGE_SIZE) })
        )
        .mockResolvedValueOnce(
          okResponse({ timestamp: 1, item: makeItems(10, THS_TICKER_SWEEP_PAGE_SIZE) })
        )

      const items = await service.getAllTickers()

      expect(items).toHaveLength(THS_TICKER_SWEEP_PAGE_SIZE + 10)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(calledUrl(0).searchParams.get('offset')).toBe('0')
      expect(calledUrl(1).searchParams.get('offset')).toBe(String(THS_TICKER_SWEEP_PAGE_SIZE))
    })
  })

  describe('getHistoricalKline（历史 K 线）', () => {
    const baseDto = {
      thscode: '600519.SH',
      start: 1716105600000,
      end: 1747641600000,
    }

    it('参数透传：未指定时补默认周期与不复权', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: makeBars(2) }))

      const bars = await service.getHistoricalKline({ ...baseDto })

      expect(bars).toHaveLength(2)
      const url = calledUrl()
      expect(url.origin + url.pathname).toBe(
        'https://fuyao.aicubes.cn/api/a-share/prices/historical'
      )
      expect(url.searchParams.get('thscode')).toBe('600519.SH')
      expect(url.searchParams.get('start')).toBe('1716105600000')
      expect(url.searchParams.get('end')).toBe('1747641600000')
      expect(url.searchParams.get('interval')).toBe('1d')
      expect(url.searchParams.get('adjust')).toBe('none')
    })

    it('显式指定复权方式时以入参为准', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: [] }))

      await service.getHistoricalKline({ ...baseDto, adjust: 'forward' })

      expect(calledUrl().searchParams.get('adjust')).toBe('forward')
    })

    it('上游缺 item 字段时兜底为空数组', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1 }))

      await expect(service.getHistoricalKline({ ...baseDto })).resolves.toEqual([])
    })

    it.each([
      [{ ...baseDto, thscode: '' }, '标的代码不能为空'],
      [{ ...baseDto, thscode: '600519.SH,000001.SZ' }, '标的代码只能是单只'],
      [{ ...baseDto, start: undefined }, '起始时间必须是毫秒时间戳'],
      [{ ...baseDto, end: undefined }, '结束时间必须是毫秒时间戳'],
      [{ ...baseDto, interval: '1m' }, 'K 线周期不在支持范围内'],
      [{ ...baseDto, adjust: 'avg' }, '复权方式不在支持范围内'],
    ])('入参校验 %j → 400 且不发起请求', async (dto, message) => {
      const query = dto as unknown as HistoricalKlineQueryDto

      await expect(service.getHistoricalKline(query)).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.getHistoricalKline(query)).rejects.toThrow(message)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('窗口方向相反（end < start）→ 400 且不发起请求', async () => {
      await expect(
        service.getHistoricalKline({
          thscode: '600519.SH',
          start: 1747641600000,
          end: 1716105600000,
        })
      ).rejects.toThrow('结束时间不能早于起始时间')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('窗口超过 10 年 → 400 且不发起请求', async () => {
      const elevenYears = 4000 * 24 * 60 * 60 * 1000

      await expect(
        service.getHistoricalKline({ thscode: '600519.SH', start: 0, end: elevenYears })
      ).rejects.toThrow('K 线时间窗口不能超过 10 年')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('getTradingDays（交易日历）', () => {
    it('无入参请求该端点，返回交易日序列', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: makeDays(['20261008']) }))

      const days = await service.getTradingDays()

      expect(days).toHaveLength(1)
      const url = calledUrl()
      expect(url.origin + url.pathname).toBe(
        'https://fuyao.aicubes.cn/api/a-share/calendar/trading-days'
      )
      expect(url.search).toBe('') // 该接口无任何查询参数
    })

    it('命中缓存时不重复请求上游', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: makeDays(['20261008']) }))

      await service.getTradingDays()
      await service.getTradingDays()

      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('上游返回空列表时不写缓存（避免把异常结果缓存 6 小时）', async () => {
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: [] }))

      await service.getTradingDays()
      await service.getTradingDays()

      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('缓存过期后重新请求上游', async () => {
      const nowSpy = jest.spyOn(Date, 'now')
      fetchSpy.mockResolvedValue(okResponse({ timestamp: 1, item: makeDays(['20261008']) }))

      nowSpy.mockReturnValue(1_000_000)
      await service.getTradingDays()

      nowSpy.mockReturnValue(1_000_000 + 6 * 60 * 60 * 1000 + 1) // 刚越过 TTL
      await service.getTradingDays()

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      nowSpy.mockRestore()
    })
  })

  describe('isTradingDay / getPrevTradingDay', () => {
    beforeEach(() => {
      fetchSpy.mockResolvedValue(
        okResponse({
          timestamp: 1,
          item: makeDays(['20261001', '20261002', '20261008', '20261009']),
        })
      )
    })

    it('交易日返回 true，非交易日返回 false', async () => {
      expect(await service.isTradingDay(new Date('2026-10-08T10:00:00+08:00'))).toBe(true)
      expect(await service.isTradingDay(new Date('2026-10-03T10:00:00+08:00'))).toBe(false)
    })

    it('取指定日期之前最近的交易日（不含当日）', async () => {
      const prev = await service.getPrevTradingDay(new Date('2026-10-08T10:00:00+08:00'))

      expect(prev?.date).toBe('20261002')
    })

    it('窗口内没有更早的交易日时返回 null', async () => {
      const prev = await service.getPrevTradingDay(new Date('2026-10-01T10:00:00+08:00'))

      expect(prev).toBeNull()
    })

    it('按北京自然日判断，钟点不影响结果', async () => {
      expect(await service.isTradingDay(new Date('2026-10-08T00:30:00+08:00'))).toBe(true)
      expect(await service.isTradingDay(new Date('2026-10-08T23:30:00+08:00'))).toBe(true)
    })

    it('跨时区输入按北京时间归属', async () => {
      // UTC 2026-10-07 17:00 = 北京 2026-10-08 01:00，应判为交易日
      expect(await service.isTradingDay(new Date('2026-10-07T17:00:00Z'))).toBe(true)
    })
  })

  describe('错误映射', () => {
    it.each([
      [2001, HttpStatus.SERVICE_UNAVAILABLE, '同花顺 API Key 缺失或无效'],
      [2003, HttpStatus.SERVICE_UNAVAILABLE, '同花顺 API Key 无权访问该接口'],
      [3001, HttpStatus.NOT_FOUND, '标的不存在'],
      [4001, HttpStatus.SERVICE_UNAVAILABLE, '同花顺接口触发限流'],
      [5001, HttpStatus.BAD_GATEWAY, '同花顺服务内部错误'],
      [5002, HttpStatus.GATEWAY_TIMEOUT, '同花顺上游服务超时'],
      [5003, HttpStatus.SERVICE_UNAVAILABLE, '同花顺数据源不可用'],
    ])('业务错误码 %i → HTTP %i', async (code, status, message) => {
      fetchSpy.mockResolvedValue(errorResponse(code))

      const err = await service.getTickerList({}).catch((e: HttpException) => e)

      expect(err).toBeInstanceOf(HttpException)
      expect((err as HttpException).getStatus()).toBe(status)
      expect((err as Error).message).toContain(message)
    })

    it('未知业务错误码 → 502 并透出原始 code', async () => {
      fetchSpy.mockResolvedValue(errorResponse(9999))

      await expect(service.getTickerList({})).rejects.toBeInstanceOf(BadGatewayException)
      await expect(service.getTickerList({})).rejects.toThrow('code=9999')
    })

    it('成功但 data 为 null → 502（宁可显式失败也不返回空表）', async () => {
      fetchSpy.mockResolvedValue(errorResponse(0))

      await expect(service.getTickerList({})).rejects.toThrow('返回成功但 data 为空')
    })

    it('HTTP 429（限流）→ 503，且不解析响应体', async () => {
      const json = jest.fn()
      fetchSpy.mockResolvedValue({ ok: false, status: 429, json } as unknown as Response)

      await expect(service.getTickerList({})).rejects.toBeInstanceOf(ServiceUnavailableException)
      await expect(service.getTickerList({})).rejects.toThrow('触发限流')
      expect(json).not.toHaveBeenCalled()
    })

    it('其他非 2xx → 502 且消息带状态码', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) } as Response)

      await expect(service.getTickerList({})).rejects.toThrow('HTTP 502')
    })

    it('网络不可达（fetch 抛 TypeError）→ 502', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'))

      await expect(service.getTickerList({})).rejects.toBeInstanceOf(BadGatewayException)
    })

    it('请求阶段超时（TimeoutError）→ 504', async () => {
      fetchSpy.mockRejectedValue(timeoutError())

      await expect(service.getTickerList({})).rejects.toBeInstanceOf(GatewayTimeoutException)
    })

    it('读取响应体阶段超时 → 504（与解析失败区分）', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw timeoutError()
        },
      } as unknown as Response)

      await expect(service.getTickerList({})).rejects.toBeInstanceOf(GatewayTimeoutException)
    })

    it('响应体不是合法 JSON → 502', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      } as unknown as Response)

      await expect(service.getTickerList({})).rejects.toThrow('不是合法 JSON')
    })
  })

  describe('凭证配置', () => {
    it('未配置 THS_API_KEY：调用时抛 503 且不发起请求（不阻塞启动）', async () => {
      // config 在构造期固化，须用空 Key 重新构造一个实例
      mockConfig.get.mockReturnValue({ apiKey: '' })
      const noKeyService = new ApiThsService(mockConfig as unknown as ConfigService)

      await expect(noKeyService.getTickerList({})).rejects.toBeInstanceOf(
        ServiceUnavailableException
      )
      await expect(noKeyService.getTickerList({})).rejects.toThrow('未配置 THS_API_KEY')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
