import { Injectable, Logger } from '@nestjs/common'
import type { FundQuote, SearchResult } from 'stock-sdk'
import { StockSDK } from 'stock-sdk'
import {
  CodesMarket,
  KlineRequestOptions,
  KlineSignalsRequestOptions,
  Market,
} from './stock-sdk.types'

/** K 线信号（与 stock-sdk KlineSignal 结构一致） */
export interface KlineSignal {
  /** 信号类型（MA/MACD/KDJ 金叉死叉、KDJ/RSI 超买超卖、BOLL 突破、SAR 反转） */
  type: string
  /** 信号发生日期 */
  date: string
  /** 信号发生时间戳（毫秒） */
  timestamp: number
  /** 信号发生时收盘价 */
  close: number | null
  /** 附加信息 */
  detail?: Record<string, number>
}

/**
 * Stock SDK 服务
 *
 * 封装 stock-sdk 库，提供 A 股、港股、美股行情、基金净值和搜索功能。
 * 使用 StockSDK 命名空间 API：sdk.quotes / sdk.batch / sdk.search
 */
@Injectable()
export class StockSdkService {
  private readonly logger = new Logger(StockSdkService.name)
  private readonly sdk: StockSDK

  constructor() {
    this.sdk = new StockSDK({ rateLimit: { requestsPerSecond: 3, maxBurst: 5 } })
  }

  /**
   * 获取股票行情
   * @param market 市场类型 (cn/hk/us)
   * @param codes 股票代码数组
   */
  async getQuotes(market: string, codes: string[]) {
    this.logger.log(`获取股票行情: ${market}/${codes.join(',')}`)

    switch (market) {
      case 'cn':
        return this.sdk.quotes.cn(codes)
      case 'hk':
        return this.sdk.quotes.hk(codes)
      case 'us':
        return this.sdk.quotes.us(codes)
      default:
        return []
    }
  }

  /**
   * 获取基金行情
   * @param codes 基金代码数组
   */
  async getFundQuotes(codes: string[]): Promise<FundQuote[]> {
    this.logger.log(`获取基金行情: ${codes.join(',')}`)

    return this.sdk.quotes.fund(codes)
  }

  /**
   * 获取大单数据
   * @param codes 股票代码数组
   * @returns 大单成交数据（主力资金流向）
   */
  async getLargeOrder(codes: string[]) {
    this.logger.log(`获取大单数据: ${codes.join(',')}`)
    return this.sdk.quotes.largeOrder(codes)
  }

  /**
   * 获取股票/基金代码列表
   * @param market 市场类型 (cn/hk/us/fund)
   * @returns 代码字符串数组
   */
  async getCodes(market: CodesMarket) {
    switch (market) {
      case CodesMarket.CN:
        return this.sdk.codes.cn()
      case CodesMarket.HK:
        return this.sdk.codes.hk()
      case CodesMarket.US:
        return this.sdk.codes.us()
      case CodesMarket.FUND:
        return this.sdk.codes.fund()
      default:
        return []
    }
  }

  /**
   * 搜索股票/指数/基金
   * @param keyword 搜索关键词
   */
  async search(keyword: string): Promise<SearchResult[]> {
    this.logger.log(`搜索: ${keyword}`)

    return this.sdk.search(keyword)
  }

  /**
   * 获取全部市场行情
   * @param market 市场类型 (cn/hk/us)
   * @param batchSize 单次请求的股票数量
   * @param concurrency 最大并发请求数
   */
  async getAllQuotes(market: Market, batchSize?: number, concurrency?: number) {
    this.logger.log(`获取全部${market}行情`)

    const options = {
      ...(batchSize && { batchSize }),
      ...(concurrency && { concurrency }),
    }

    switch (market) {
      case Market.CN:
        return this.sdk.batch.cn(options)
      case Market.HK:
        return this.sdk.batch.hk(options)
      case Market.US:
        return this.sdk.batch.us(options)
      default:
        return []
    }
  }

  /**
   * 按代码批量获取行情
   * @param codes 股票代码数组
   * @param batchSize 单次请求的股票数量
   * @param concurrency 最大并发请求数
   */
  async batchByCodes(codes: string[], batchSize?: number, concurrency?: number) {
    this.logger.log(`按代码批量获取行情: ${codes.join(',')}`)

    const options = {
      ...(batchSize && { batchSize }),
      ...(concurrency && { concurrency }),
    }

    return this.sdk.batch.byCodes(codes, options)
  }

  /**
   * 判断 1 分钟 K 线应查询的交易日
   *
   * 规则（period='1' 时生效）：
   * - 盘前（pre_market）：当天尚未产生数据 → 返回前一交易日
   * - 交易中 / 午休 / 盘后（open/lunch_break/after_hours）：当天有数据 → 返回当天
   * - 休市（closed，周末/节假日/凌晨）：当天无数据 → 返回前一交易日
   *
   * @param market 市场类型 (cn/hk/us)
   * @param now 当前时间（默认取系统时间）
   * @returns 目标交易日 (YYYYMMDD)
   */
  private async resolveMinuteKlineDate(market: Market, now: Date = new Date()): Promise<string> {
    const marketMap: Record<string, 'A' | 'HK' | 'US'> = {
      [Market.CN]: 'A',
      [Market.HK]: 'HK',
      [Market.US]: 'US',
    }
    const sdkMarket = marketMap[market]
    const today = this.formatDate(now)
    if (!sdkMarket) return today

    const status = this.sdk.calendar.marketStatus(sdkMarket, now)

    // 盘前 / 休市：当天无数据，回退到前一交易日
    if (status === 'pre_market' || status === 'closed') {
      const prev = await this.sdk.calendar.prevTradingDay(now)
      // prevTradingDay 返回 YYYY-MM-DD，统一转为 YYYYMMDD
      return prev ? prev.replace(/-/g, '') : today
    }

    // 交易中 / 午休 / 盘后：当天有数据
    return today
  }

  /** 格式化日期为 YYYYMMDD */
  private formatDate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}${m}${d}`
  }

  /**
   * 获取K线数据（历史K线/分钟K线/带指标K线）
   * @param market 市场类型 (cn/hk/us)
   * @param code 股票代码
   * @param period K线周期 (daily/weekly/monthly 或 1/5/15/30/60)
   * @param adjust 复权类型 (qfq/hfq/空字符串)
   * @param startDate 开始日期 (YYYYMMDD)
   * @param endDate 结束日期 (YYYYMMDD)
   * @param indicators 指标配置（传入时调用 withIndicators）
   */
  async getKline(
    market: Market,
    code: string,
    period?: string,
    adjust?: string,
    startDate?: string,
    endDate?: string,
    indicators?: Record<string, any>
  ) {
    this.logger.log(`获取K线数据: ${market}/${code}, 周期: ${period}`)

    // 构建选项，只添加有值的参数
    const options: KlineRequestOptions = {}
    if (period) options.period = period
    if (adjust !== undefined && adjust !== null) options.adjust = adjust
    if (indicators) options.indicators = indicators

    // 分钟周期集合：period 为 1/5/15/30/60 时调用分钟K线接口
    const isMinutePeriod = ['1', '5', '15', '30', '60'].includes(period ?? '')

    if (isMinutePeriod) {
      // period='1' 时未指定日期范围，按交易时段自动定位交易日
      let resolvedStart = startDate
      let resolvedEnd = endDate
      if (period === '1' && !startDate && !endDate) {
        resolvedStart = await this.resolveMinuteKlineDate(market)
        resolvedEnd = resolvedStart
      }
      if (resolvedStart) options.startDate = resolvedStart
      if (resolvedEnd) options.endDate = resolvedEnd

      switch (market) {
        case Market.CN:
          return this.sdk.kline.cnMinute(code, options as any)
        case Market.HK:
          return this.sdk.kline.hkMinute(code, options as any)
        case Market.US:
          return this.sdk.kline.usMinute(code, options as any)
        default:
          return []
      }
    }

    // 历史周期：指定日期范围
    if (startDate) options.startDate = startDate
    if (endDate) options.endDate = endDate

    // 有 indicators 时调用 withIndicators（仅支持 daily/weekly/monthly）
    const marketMap: Record<string, 'A' | 'HK' | 'US'> = {
      [Market.CN]: 'A',
      [Market.HK]: 'HK',
      [Market.US]: 'US',
    }
    if (indicators && Object.keys(indicators).length > 0) {
      if (marketMap[market]) options.market = marketMap[market]
      return this.sdk.kline.withIndicators(code, options as any)
    }

    // 历史K线
    switch (market) {
      case Market.CN:
        return this.sdk.kline.cn(code, options as any)
      case Market.HK:
        return this.sdk.kline.hk(code, options as any)
      case Market.US:
        return this.sdk.kline.us(code, options as any)
      default:
        return []
    }
  }

  /**
   * 获取K线技术分析信号
   * 识别金叉/死叉、超买/超卖等技术信号
   *
   * @param market 市场类型 (cn/hk/us)
   * @param code 股票代码
   * @param period K线周期 (daily/weekly/monthly)
   * @param adjust 复权类型 (qfq/hfq/空字符串)
   * @param startDate 开始日期 (YYYYMMDD 或 YYYY-MM-DD)
   * @param endDate 结束日期 (YYYYMMDD 或 YYYY-MM-DD)
   * @param maFast MA 快线周期（默认 5）
   * @param maSlow MA 慢线周期（默认 20）
   * @returns K线信号数组，包含信号类型、日期、收盘价等信息
   */
  async getKlineSignals(
    market: Market,
    code: string,
    period?: string,
    adjust?: string,
    startDate?: string,
    endDate?: string,
    maFast?: number,
    maSlow?: number
  ): Promise<KlineSignal[]> {
    // 构建选项，只添加有值的参数
    const options: KlineSignalsRequestOptions = {}
    if (period) options.period = period
    if (adjust !== undefined && adjust !== null) options.adjust = adjust
    if (startDate) options.startDate = startDate
    if (endDate) options.endDate = endDate
    if (maFast) options.maFast = maFast
    if (maSlow) options.maSlow = maSlow

    // 通过 options 传递 market
    const marketMap: Record<string, string> = {
      cn: 'A',
      hk: 'HK',
      us: 'US',
    }
    if (market && marketMap[market]) {
      options.market = marketMap[market] as 'A' | 'HK' | 'US'
    }

    return this.sdk.kline.signals(code, options as any)
  }
}
