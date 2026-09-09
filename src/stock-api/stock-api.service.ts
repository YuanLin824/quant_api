import { Injectable, Logger } from '@nestjs/common'
import { stocks } from 'stock-api'
import { Kline, KlinePeriod, Market, Stock } from './stock-api.types'

/**
 * 股票行情服务
 *
 * 封装 stock-api 库，提供 A 股、港股、美股行情查询。
 * 使用 stocks.auto 自动兜底：tencent -> sina -> eastmoney
 */
@Injectable()
export class StockApiService {
  private readonly logger = new Logger(StockApiService.name)

  /**
   * 获取单只股票行情
   * @param market 市场类型 (SH/SZ/HK/US)
   * @param code 股票代码
   */
  async getStock(market: Market, code: string): Promise<Stock> {
    const fullCode = `${market}${code}`
    this.logger.log(`获取股票行情: ${fullCode}`)

    return stocks.auto.getStock(fullCode)
  }

  /**
   * 批量获取股票行情
   * @param codes 完整股票代码数组 (如 ["SH600519", "SZ000651"])
   */
  async getStocks(codes: string[]): Promise<Stock[]> {
    this.logger.log(`批量获取股票行情: ${codes.join(', ')}`)

    return stocks.auto.getStocks(codes)
  }

  /**
   * 获取K线数据
   * @param market 市场类型
   * @param code 股票代码
   * @param period K线周期 (day/week/month)
   * @param count 数量 (默认 120)
   */
  async getKlines(
    market: Market,
    code: string,
    period: KlinePeriod = KlinePeriod.DAY,
    count: number = 120
  ): Promise<Kline[]> {
    const fullCode = `${market}${code}`
    this.logger.log(`获取K线数据: ${fullCode}, 周期: ${period}, 数量: ${count}`)

    return stocks.auto.getKlines(fullCode, {
      period,
      count,
    })
  }

  /**
   * 搜索股票
   * @param keyword 搜索关键词
   */
  async searchStocks(keyword: string): Promise<Stock[]> {
    this.logger.log(`搜索股票: ${keyword}`)

    return stocks.auto.searchStocks(keyword)
  }
}
