import { Injectable, Logger } from '@nestjs/common'
import { stocks } from 'stock-api'
import { KlineData, KlinePeriod, Market, StockQuote } from './stock-api.types'

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
  async getStock(market: Market, code: string): Promise<StockQuote> {
    const fullCode = `${market}${code}`
    this.logger.log(`获取股票行情: ${fullCode}`)

    const stock = await stocks.auto.getStock(fullCode)

    return {
      code: stock.code,
      name: stock.name,
      now: stock.now,
      percent: stock.percent,
      low: stock.low,
      high: stock.high,
      yesterday: stock.yesterday,
      source: stock.source,
    }
  }

  /**
   * 批量获取股票行情
   * @param codes 完整股票代码数组 (如 ["SH600519", "SZ000651"])
   */
  async getStocks(codes: string[]): Promise<StockQuote[]> {
    this.logger.log(`批量获取股票行情: ${codes.join(', ')}`)

    const list = await stocks.auto.getStocks(codes)

    return list.map((stock) => ({
      code: stock.code,
      name: stock.name,
      now: stock.now,
      percent: stock.percent,
      low: stock.low,
      high: stock.high,
      yesterday: stock.yesterday,
      source: stock.source,
    }))
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
  ): Promise<KlineData[]> {
    const fullCode = `${market}${code}`
    this.logger.log(`获取K线数据: ${fullCode}, 周期: ${period}, 数量: ${count}`)

    const klines = await stocks.auto.getKlines(fullCode, {
      period,
      count,
    })

    return klines.map((kline) => ({
      date: kline.date,
      open: kline.open,
      close: kline.close,
      high: kline.high,
      low: kline.low,
      volume: kline.volume,
      source: kline.source,
    }))
  }

  /**
   * 搜索股票
   * @param keyword 搜索关键词
   */
  async searchStocks(keyword: string): Promise<StockQuote[]> {
    this.logger.log(`搜索股票: ${keyword}`)

    const results = await stocks.auto.searchStocks(keyword)

    return results.map((stock) => ({
      code: stock.code,
      name: stock.name,
      now: stock.now,
      percent: stock.percent,
      low: stock.low,
      high: stock.high,
      yesterday: stock.yesterday,
      source: stock.source,
    }))
  }
}
