import { Injectable, Logger } from '@nestjs/common'
import type { FullQuote, FundQuote, HKQuote, SearchResult, USQuote } from 'stock-sdk'
import { StockSDK } from 'stock-sdk'

/**
 * Stock SDK 服务
 *
 * 封装 stock-sdk 库，提供 A 股、港股、美股行情、基金净值和搜索功能。
 * 使用 StockSDK 命名空间 API：sdk.quotes / sdk.search
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
  async getQuotes(market: string, codes: string[]): Promise<(FullQuote | HKQuote | USQuote)[]> {
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
}
