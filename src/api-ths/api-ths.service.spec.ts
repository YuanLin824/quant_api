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
import type { ThsTickerItem, ThsTickerListData } from './api-ths.types'
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

/** 构造成功响应（HTTP 200 + code=0） */
function okResponse(data: ThsTickerListData): Response {
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
