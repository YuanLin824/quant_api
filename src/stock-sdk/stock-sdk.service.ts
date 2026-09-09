import { Injectable, Logger } from '@nestjs/common'
import type { FundQuote, SearchResult } from 'stock-sdk'
import { StockSDK } from 'stock-sdk'
import { AdjustType, KlinePeriod, MinuteKlinePeriod } from './dto/get-kline.dto'
import { CodesMarket, Market } from './stock-sdk.types'

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
   * 获取历史K线数据
   * @param market 市场类型 (cn/hk/us)
   * @param code 股票代码
   * @param period K线周期 (daily/weekly/monthly)
   * @param adjust 复权类型 (qfq/hfq/空字符串)
   * @param startDate 开始日期 (YYYYMMDD)
   * @param endDate 结束日期 (YYYYMMDD)
   */
  async getKline(
    market: Market,
    code: string,
    period?: KlinePeriod,
    adjust?: AdjustType,
    startDate?: string,
    endDate?: string
  ) {
    this.logger.log(`获取K线数据: ${market}/${code}, 周期: ${period}`)

    // 构建选项，只添加有值的参数
    const options: any = {}
    if (period) options.period = period
    if (adjust !== undefined && adjust !== null) options.adjust = adjust
    if (startDate) options.startDate = startDate
    if (endDate) options.endDate = endDate

    switch (market) {
      case Market.CN:
        return this.sdk.kline.cn(code, options)
      case Market.HK:
        return this.sdk.kline.hk(code, options)
      case Market.US:
        return this.sdk.kline.us(code, options)
      default:
        return []
    }
  }

  /**
   * 获取分钟K线数据
   * @param market 市场类型 (cn/hk/us)
   * @param code 股票代码
   * @param period 分钟K线周期 (1/5/15/30/60)
   * @param adjust 复权类型 (qfq/hfq/空字符串)
   * @param startDate 开始日期
   * @param endDate 结束日期
   */
  async getMinuteKline(
    market: Market,
    code: string,
    period?: MinuteKlinePeriod,
    adjust?: AdjustType,
    startDate?: string,
    endDate?: string
  ) {
    this.logger.log(`获取分钟K线数据: ${market}/${code}, 周期: ${period}分钟`)

    // 构建选项，只添加有值的参数
    const options: any = {}
    if (period) options.period = period
    if (adjust !== undefined && adjust !== null) options.adjust = adjust
    if (startDate) options.startDate = startDate
    if (endDate) options.endDate = endDate

    switch (market) {
      case Market.CN:
        return this.sdk.kline.cnMinute(code, options)
      case Market.HK:
        return this.sdk.kline.hkMinute(code, options)
      case Market.US:
        return this.sdk.kline.usMinute(code, options)
      default:
        return []
    }
  }

  /**
   * 获取带技术指标的K线数据
   * @param market 市场类型 (cn/hk/us)
   * @param code 股票代码
   * @param period K线周期 (daily/weekly/monthly)
   * @param adjust 复权类型 (qfq/hfq/空字符串)
   * @param startDate 开始日期 (YYYYMMDD 或 YYYY-MM-DD)
   * @param endDate 结束日期 (YYYYMMDD 或 YYYY-MM-DD)
   * @param indicators 指标配置
   */
  async getKlineWithIndicators(
    market: Market,
    code: string,
    period?: string,
    adjust?: string,
    startDate?: string,
    endDate?: string,
    indicators?: Record<string, any>
  ) {
    this.logger.log(`获取带指标K线数据: ${market}/${code}, 周期: ${period}`)

    // 构建选项，只添加有值的参数
    const options: any = {}
    if (period) options.period = period
    if (adjust !== undefined && adjust !== null) options.adjust = adjust
    if (startDate) options.startDate = startDate
    if (endDate) options.endDate = endDate
    if (indicators) options.indicators = indicators

    // 通过 options 传递 market
    const marketMap: Record<string, string> = {
      cn: 'A',
      hk: 'HK',
      us: 'US',
    }
    if (market && marketMap[market]) {
      options.market = marketMap[market]
    }

    return this.sdk.kline.withIndicators(code, options)
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
    const options: any = {}
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
      options.market = marketMap[market]
    }

    return this.sdk.kline.signals(code, options)
  }
}
