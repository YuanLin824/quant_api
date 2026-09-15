import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Exchange, KlineCategory } from 'node-tdx-market'
import { TdxClient } from 'node-tdx-market'
import { ENV_KEYS } from '../config/constants'
import { KLINE_CATEGORY_MAP, type KlinePeriodKey } from './tdx.constants'

/**
 * 通达信行情服务
 *
 * 封装 `node-tdx-market`（通达信 TCP 协议客户端）。与项目中其它行情模块不同，
 * 这里维护的是一条**长连接**，因此需要处理连接生命周期：
 * - 启动时主动建连，但**不阻塞应用启动**——服务不可达时只记 warn，首次请求会重试
 * - 请求前检查连接状态（懒连接），断线由库的 autoReconnect 负责
 * - 模块销毁时断开，避免进程退出时挂起
 *
 * 库内部已做请求串行化（同一连接同时只有一个在途请求），无需在此再加锁。
 */
@Injectable()
export class TdxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TdxService.name)
  private readonly client: TdxClient

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>(ENV_KEYS.TDX_HOST)
    const port = this.configService.get<string>(ENV_KEYS.TDX_PORT)

    this.client = new TdxClient({
      // 不指定 host 时由库自动测速选择最快的服务器
      ...(host ? { host } : {}),
      ...(port ? { port: Number(port) } : {}),
      autoReconnect: true,
    })
  }

  async onModuleInit(): Promise<void> {
    try {
      const address = await this.client.connect()
      this.logger.log(`通达信服务器已连接: ${address}`)
    } catch (err) {
      // 不阻塞启动：行情服务不可达不应导致整个应用起不来
      this.logger.warn(
        `通达信服务器连接失败（首次请求时将重试）: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  onModuleDestroy(): void {
    this.client.destroy()
  }

  /** 获取 K 线数据 */
  async getKline(code: string, period: KlinePeriodKey, start?: number, count?: number) {
    await this.ensureConnected()

    return this.client.getKline({
      code,
      category: KLINE_CATEGORY_MAP[period] as KlineCategory,
      ...(start !== undefined ? { start } : {}),
      ...(count !== undefined ? { count } : {}),
    })
  }

  /** 获取五档盘口（支持批量） */
  async getQuotes(codes: string | string[]) {
    await this.ensureConnected()

    return this.client.getQuote(codes)
  }

  /** 获取当日分时数据 */
  async getMinute(code: string) {
    await this.ensureConnected()

    return this.client.getMinute(code)
  }

  /** 获取历史分时数据（date 为 YYYYMMDD 数字） */
  async getHistoryMinute(code: string, date: number) {
    await this.ensureConnected()

    return this.client.getHistoryMinute(code, date)
  }

  /** 获取当日分笔成交 */
  async getTrade(code: string, start?: number, count?: number) {
    await this.ensureConnected()

    return this.client.getTrade(code, start, count)
  }

  /** 获取历史分笔成交（date 为 YYYYMMDD 数字） */
  async getHistoryTrade(code: string, date: number, start?: number, count?: number) {
    await this.ensureConnected()

    return this.client.getHistoryTrade(code, date, start, count)
  }

  /** 获取指定交易所的证券数量 */
  async getStockCount(exchange: Exchange) {
    await this.ensureConnected()

    return this.client.getStockCount(exchange)
  }

  /** 获取指定交易所的全部证券列表（库内自动分页拉取） */
  async getStockList(exchange: Exchange) {
    await this.ensureConnected()

    return this.client.getStockList(exchange)
  }

  /**
   * 确保连接可用
   *
   * 库内部有 `connecting` 标志，并发调用 connect() 不会重复建连；
   * 断线后的重连由 autoReconnect 负责，这里只兜底「从未连上」的情况。
   */
  private async ensureConnected(): Promise<void> {
    if (this.client.isConnected) return

    try {
      await this.client.connect()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`通达信服务器连接失败: ${message}`)
      throw new ServiceUnavailableException('通达信行情服务器连接失败，请稍后重试')
    }
  }
}
