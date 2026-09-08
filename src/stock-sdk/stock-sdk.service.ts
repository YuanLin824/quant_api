import { Injectable, Logger } from '@nestjs/common'
import type { FundQuote, SearchResult } from 'stock-sdk'
import { StockSDK } from 'stock-sdk'
import { Market } from './stock-sdk.types'

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
    this.sdk = new StockSDK()
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
}
