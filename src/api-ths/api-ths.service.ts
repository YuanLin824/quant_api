import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CONFIG_MODULES, ENV_KEYS } from '../config/constants'
import { type IThsConfig } from './api-ths.config'
import {
  THS_BASE_URL,
  THS_CALENDAR_CACHE_TTL_MS,
  THS_CODE,
  THS_KLINE_MAX_WINDOW_MS,
  THS_KLINE_PATH,
  THS_REQUEST_TIMEOUT_MS,
  THS_TICKER_LIST_DEFAULT_LIMIT,
  THS_TICKER_LIST_PATH,
  THS_TICKER_SWEEP_MAX_PAGES,
  THS_TICKER_SWEEP_PAGE_SIZE,
  THS_TRADING_DAYS_PATH,
  type ThsAssetType,
} from './api-ths.constants'
import {
  type ThsApiEnvelope,
  type ThsKlineData,
  type ThsPriceBar,
  type ThsTickerItem,
  type ThsTickerListData,
  type ThsTradingDay,
  type ThsTradingDaysData,
} from './api-ths.types'
import { HistoricalKlineQueryDto } from './dto/historical-kline.dto'
import { TickerListQueryDto } from './dto/ticker-list.dto'

/**
 * 上游业务错误码 → HTTP 状态码 & 中文消息
 *
 * 与全局异常过滤器中的 `DB_ERROR_MAP` 同构：把外部系统的错误码翻译成本服务可读的语义，
 * 由 AllExceptionsFilter 统一封装成 `{ code, data, message }` 响应。
 *
 * 注意 2001/2003 映射为 503 而非 401/403：这是**我方与上游之间的凭证问题**，
 * 不是调用方凭证问题，若报成 401/403 会让调用方误以为是自己未登录。
 * 同理 4001 用 503 而非 429——429 是本服务 ThrottlerGuard 入站限流的专有语义，
 * 混用会让调用方误判为「我被限流」而对本服务盲目重试。
 */
const THS_ERROR_MAP: Record<number, { status: number; message: string }> = {
  [THS_CODE.MISSING_PARAM]: { status: HttpStatus.BAD_REQUEST, message: '同花顺接口缺少必填参数' },
  [THS_CODE.INVALID_PARAM]: { status: HttpStatus.BAD_REQUEST, message: '同花顺接口参数格式错误' },
  [THS_CODE.OUT_OF_RANGE]: { status: HttpStatus.BAD_REQUEST, message: '同花顺接口参数取值越界' },
  [THS_CODE.PARAM_CONFLICT]: { status: HttpStatus.BAD_REQUEST, message: '同花顺接口参数冲突' },
  [THS_CODE.UNAUTHENTICATED]: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: `同花顺 API Key 缺失或无效, 请检查 ${ENV_KEYS.THS_API_KEY} 配置`,
  },
  [THS_CODE.FORBIDDEN]: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: '同花顺 API Key 无权访问该接口',
  },
  [THS_CODE.TICKER_NOT_FOUND]: { status: HttpStatus.NOT_FOUND, message: '标的不存在' },
  [THS_CODE.DATA_NOT_READY]: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: '同花顺数据未就绪, 请稍后重试',
  },
  [THS_CODE.UNSUPPORTED_ASSET_TYPE]: {
    status: HttpStatus.BAD_REQUEST,
    message: '该标的类型不支持此能力',
  },
  [THS_CODE.RATE_LIMITED]: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: '同花顺接口触发限流, 请稍后重试',
  },
  [THS_CODE.INTERNAL_ERROR]: { status: HttpStatus.BAD_GATEWAY, message: '同花顺服务内部错误' },
  [THS_CODE.UPSTREAM_TIMEOUT]: {
    status: HttpStatus.GATEWAY_TIMEOUT,
    message: '同花顺上游服务超时',
  },
  [THS_CODE.SOURCE_UNAVAILABLE]: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: '同花顺数据源不可用',
  },
}

/**
 * 是否为超时/取消类异常
 *
 * `AbortSignal.timeout()` 触发的是 `TimeoutError`，手动 `abort()` 抛 `AbortError`。
 */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
}

/**
 * 同花顺金融数据服务
 *
 * 数据源契约（详见 API_THS.md / API_THS_FULL.md）：
 * - Base URL `https://fuyao.aicubes.cn`，请求头 `X-api-key` 鉴权
 * - 响应统一为 `{ code, message, request_id, data }` 信封，`code !== 0` 即业务错误
 * - 时间戳字段为毫秒级 Unix 时间戳（Asia/Shanghai）
 *
 * 所有请求经私有 `request()` 收口（鉴权头注入、超时控制、信封解包、错误码映射），
 * 新增其他同花顺接口时复用该方法即可。
 */
@Injectable()
export class ApiThsService {
  private readonly logger = new Logger(ApiThsService.name)
  private readonly config: IThsConfig

  /** 交易日历内存缓存（详见 getTradingDays） */
  private calendarCache: { items: ThsTradingDay[]; expiresAt: number } | null = null

  constructor(configService: ConfigService) {
    this.config = configService.get<IThsConfig>(CONFIG_MODULES.THS)!
  }

  /**
   * 标的列表获取（单页）
   *
   * 按资产类型分页获取证券、基金、期货与期权代码表。
   * 需要全量时用 `getAllTickers()`，它按上游约定自动翻页。
   */
  async getTickerList(dto: TickerListQueryDto = {}): Promise<ThsTickerItem[]> {
    await this.assertValidDto(dto, TickerListQueryDto)

    const data = await this.request<ThsTickerListData>(THS_TICKER_LIST_PATH, {
      asset_type: this.toAssetTypeParam(dto.assetType),
      limit: dto.limit ?? THS_TICKER_LIST_DEFAULT_LIMIT,
      offset: dto.offset ?? 0,
    })

    return data.item ?? []
  }

  /**
   * 取尽全部标的（自动翻页）
   *
   * 按上游分页约定「循环递增 offset，直到 `item.length < limit` 即取尽」串行拉取。
   * 刻意不并发——契约要求限流时降低并发与频率，串行是最低成本的合规做法。
   *
   * 触达轮数上限会抛错而非返回已取部分：静默截断的代码表会被下游当成全集使用，
   * 比一次显式失败代价更高。
   */
  async getAllTickers(assetType?: ThsAssetType | ThsAssetType[]): Promise<ThsTickerItem[]> {
    const limit = THS_TICKER_SWEEP_PAGE_SIZE
    const all: ThsTickerItem[] = []

    for (let page = 0; page < THS_TICKER_SWEEP_MAX_PAGES; page++) {
      const items = await this.getTickerList({ assetType, limit, offset: page * limit })
      all.push(...items)

      // 上游约定：返回条数不足一页即已取尽（恰好整页时需再请求一次才能确认）
      if (items.length < limit) return all
    }

    throw new BadGatewayException(
      `标的列表翻页超过 ${THS_TICKER_SWEEP_MAX_PAGES} 轮仍未取尽, 已中止`
    )
  }

  /**
   * 历史 K 线（单只标的）
   *
   * 契约见 API_THS_FULL.md「历史 K 线」：接口层强约束**每次请求仅一个 thscode**，
   * 且 `[start, end]` 窗口跨度不超过 10 年；多标的需分多次请求。
   */
  async getHistoricalKline(dto: HistoricalKlineQueryDto): Promise<ThsPriceBar[]> {
    await this.assertValidDto(dto, HistoricalKlineQueryDto)
    this.assertKlineWindow(dto)

    const data = await this.request<ThsKlineData>(THS_KLINE_PATH, {
      thscode: dto.thscode,
      interval: dto.interval ?? '1d',
      start: dto.start,
      end: dto.end,
      // 刻意与上游默认值（forward 前复权）不同：取原始价格更符合回测与技术分析的预期
      adjust: dto.adjust ?? 'none',
    })

    return data.item ?? []
  }

  /**
   * 交易日历（近一年）
   *
   * 契约见 API_THS_FULL.md「交易日历」：接口**无入参**，固定返回 `[今日 - 1 年, 今日]`
   * （Asia/Shanghai）的交易日序列，按时间升序。
   *
   * 结果带 6 小时内存缓存——窗口一天最多变一次，不必每次判断都打上游。
   */
  async getTradingDays(): Promise<ThsTradingDay[]> {
    const now = Date.now()
    if (this.calendarCache && this.calendarCache.expiresAt > now) {
      return this.calendarCache.items
    }

    const data = await this.request<ThsTradingDaysData>(THS_TRADING_DAYS_PATH, {})
    const items = data.item ?? []

    // 仅在非空时写缓存：上游异常返回空列表时，不能把「近期没有交易日」缓存 6 小时
    if (items.length > 0) {
      this.calendarCache = { items, expiresAt: now + THS_CALENDAR_CACHE_TTL_MS }
    }

    return items
  }

  /**
   * 判断指定时间是否落在交易日内（默认当前时刻）
   *
   * 按 Asia/Shanghai **自然日**判断，传入时刻的具体钟点不影响结果。
   */
  async isTradingDay(date: Date = new Date()): Promise<boolean> {
    const days = await this.getTradingDays()
    const key = this.toShanghaiDateKey(date)
    return days.some((day) => day.date === key)
  }

  /**
   * 取指定时间之前最近的交易日（默认当前时刻，**不含当日**）
   *
   * 常用于「前一交易日」类计算（如超短线策略里取昨日 K 线）。
   * 若日历窗口内没有更早的交易日（如传入日期早于窗口左边界），返回 null。
   */
  async getPrevTradingDay(date: Date = new Date()): Promise<ThsTradingDay | null> {
    const days = await this.getTradingDays()
    const key = this.toShanghaiDateKey(date)

    // 列表按时间升序，且 yyyyMMdd 的字典序即时间序，故从后往前找第一个更早的
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].date < key) return days[i]
    }
    return null
  }

  /**
   * 服务层入参校验
   *
   * 本模块没有 controller，不经过全局 ValidationPipe，DTO 上的校验装饰器**不会自动生效**，
   * 因此在服务入口显式触发一次（各接口的 DTO 类经 metatype 传入）。
   * 异常消息传字符串而非数组——数组会被 HttpException 退化为构造器名（`Bad Request`），
   * 服务层调用方读 `err.message` 时拿不到中文。
   */
  private async assertValidDto<T extends object>(dto: T, metatype: new () => T): Promise<void> {
    const errors = await validate(plainToInstance(metatype, dto))
    const messages = errors.flatMap((err) => Object.values(err.constraints ?? {}))
    if (messages.length > 0) {
      throw new BadRequestException(messages.join('; '))
    }
  }

  /** 校验 K 线时间窗口：本地拦截方向相反或明显超限的请求，避免白打一次上游 */
  private assertKlineWindow(dto: HistoricalKlineQueryDto): void {
    if (dto.end < dto.start) {
      throw new BadRequestException('结束时间不能早于起始时间')
    }

    const windowMs = dto.end - dto.start
    if (windowMs > THS_KLINE_MAX_WINDOW_MS) {
      const days = Math.ceil(windowMs / (24 * 60 * 60 * 1000))
      throw new BadRequestException(`K 线时间窗口不能超过 10 年（当前约 ${days} 天）`)
    }
  }

  /** 把时间转成 Asia/Shanghai 的 `yyyyMMdd`（与日历条目的 date 同格式，可直接比较） */
  private toShanghaiDateKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' })
      .format(date)
      .replace(/-/g, '')
  }

  /** 把资产类型入参拼成上游要求的逗号分隔格式（去重、去空；省略时返回 undefined 表示不过滤） */
  private toAssetTypeParam(assetType?: ThsAssetType | ThsAssetType[]): string | undefined {
    if (!assetType) return undefined

    const values = [...new Set(Array.isArray(assetType) ? assetType : [assetType])].filter(Boolean)
    return values.length > 0 ? values.join(',') : undefined
  }

  /**
   * 发起同花顺请求：注入鉴权 → 解包信封 → 映射错误
   *
   * 不实现自动重试——契约明确要求限流时避免立即连续重试，重试策略交由调用方决策。
   * 日志一律不记录 apiKey（凭证不落日志）。
   */
  private async request<T>(
    path: string,
    query: Record<string, string | number | undefined>
  ): Promise<T> {
    if (!this.config.apiKey) {
      throw new ServiceUnavailableException(`未配置 ${ENV_KEYS.THS_API_KEY}, 无法调用同花顺接口`)
    }

    const url = new URL(path, THS_BASE_URL)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    let response: Response
    try {
      response = await fetch(url, {
        headers: { 'X-api-key': this.config.apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(THS_REQUEST_TIMEOUT_MS),
      })
    } catch (err) {
      if (isAbortError(err)) {
        throw new GatewayTimeoutException(`同花顺接口请求超时（${THS_REQUEST_TIMEOUT_MS}ms）`)
      }
      // DNS / 连接 / TLS 的真实原因在 err.cause 里，一并记录
      this.logger.error({
        message: '同花顺接口网络异常',
        path,
        error: err,
        cause: err instanceof Error ? err.cause : undefined,
      })
      throw new BadGatewayException('同花顺接口网络异常')
    }

    // 限流优先判断：429 的响应体未必是标准信封
    if (response.status === 429) {
      this.logger.warn({ message: '同花顺接口触发限流', path })
      throw new ServiceUnavailableException('同花顺接口触发限流, 请稍后重试')
    }
    if (!response.ok) {
      this.logger.error({ message: '同花顺接口响应异常', path, status: response.status })
      throw new BadGatewayException(`同花顺接口响应异常（HTTP ${response.status}）`)
    }

    let envelope: ThsApiEnvelope<T>
    try {
      envelope = (await response.json()) as ThsApiEnvelope<T>
    } catch (err) {
      // 超时可能发生在读取响应体阶段（大 payload 下载途中），须与解析失败区分开
      if (isAbortError(err)) {
        throw new GatewayTimeoutException(`同花顺接口读取响应超时（${THS_REQUEST_TIMEOUT_MS}ms）`)
      }
      throw new BadGatewayException('同花顺接口响应不是合法 JSON')
    }

    if (envelope.code !== THS_CODE.SUCCESS) {
      const mapped = THS_ERROR_MAP[envelope.code]
      this.logger.error({
        message: '同花顺接口业务错误',
        path,
        code: envelope.code,
        upstreamMessage: envelope.message,
        requestId: envelope.request_id,
      })
      throw mapped
        ? new HttpException(mapped.message, mapped.status)
        : new BadGatewayException(`同花顺接口返回未知错误（code=${envelope.code}）`)
    }

    if (envelope.data === null) {
      throw new BadGatewayException('同花顺接口返回成功但 data 为空')
    }

    return envelope.data
  }
}
