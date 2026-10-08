import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { priceToYuan, type TdxClient } from 'node-tdx-market'
import { TDX_CLIENT, TDX_EXCHANGE_SUFFIXES } from './api-tdx.constants'
import type { TdxMinuteData } from './api-tdx.types'

/** 上游分时响应的类型（从客户端方法签名推导，库未在顶层导出 `MinuteItem`） */
type TdxMinuteResponse = Awaited<ReturnType<TdxClient['getMinute']>>

/**
 * 通达信行情数据服务
 *
 * 数据源契约（详见 API_TDX.md）：基于 `node-tdx-market` 直连通达信公开行情服务器，
 * **TCP 长连接**（非 HTTP），免费、零鉴权。与前几个数据源模块的三点差异：
 * - **长连接**：懒连接（首次调用时建连并复用），断线后下次调用自动重连
 * - **代码格式**：对外仍是项目的 thscode（`600519.SH`），内部转成库要求的 `sh600519`
 * - **价格单位**：上游是「厘」整数（元 × 1000），对外统一换算为元
 *
 * 当前仅实现分时数据（当日 / 历史分时）。
 */
@Injectable()
export class ApiTdxService {
  private readonly logger = new Logger(ApiTdxService.name)

  /** 懒连接缓存的 connect Promise：进行中或已成功时复用，失败或断线后置空以便重连 */
  private connectPromise: Promise<void> | null = null

  constructor(@Inject(TDX_CLIENT) private readonly client: TdxClient) {
    // 断线后清空缓存的 Promise，使下次调用重新建连（而非一直复用已失效的连接）
    this.client.on('disconnected', () => {
      this.connectPromise = null
    })
  }

  /**
   * 当日分时
   *
   * 交易时段内为实时序列，收盘后为当日全天；价格已换算为元。
   */
  async getMinute(thscode: string): Promise<TdxMinuteData> {
    const code = this.toTdxCode(thscode)
    await this.ensureConnected()

    return this.toMinuteData(() => this.client.getMinute(code), thscode)
  }

  /**
   * 历史分时
   *
   * ⚠️ 上游对历史分时返回的**均价不可靠**（见 `TdxMinuteTick.avgPrice` 的说明），
   * 且更早的日期可能直接无数据（实测仅近期若干交易日有值，超出即返回空列表）。
   *
   * @param date 交易日，`yyyyMMdd` 格式（如 `20261008`）
   */
  async getHistoryMinute(thscode: string, date: number): Promise<TdxMinuteData> {
    const code = this.toTdxCode(thscode)
    this.assertDate(date)
    await this.ensureConnected()

    return this.toMinuteData(() => this.client.getHistoryMinute(code, date), thscode)
  }

  /**
   * 懒连接：首次调用时建连，之后复用同一个 Promise
   *
   * 失败时清空缓存，使下一次调用可以重试，而不是永久卡在失败状态。
   */
  private async ensureConnected(): Promise<void> {
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = this.client
      .connect()
      .then(() => undefined)
      .catch((err: unknown) => {
        this.connectPromise = null
        this.logger.error({ message: '通达信行情服务器连接失败', error: err })
        throw new ServiceUnavailableException('通达信行情服务器连接失败')
      })

    return this.connectPromise
  }

  /** 调用上游并把价格由厘换算为元；调用期异常统一映射为 502 */
  private async toMinuteData(
    fetch: () => Promise<TdxMinuteResponse>,
    thscode: string
  ): Promise<TdxMinuteData> {
    try {
      const { count, items } = await fetch()
      return {
        count,
        items: items.map((item) => ({
          time: item.time,
          price: priceToYuan(item.price),
          avgPrice: priceToYuan(item.avgPrice),
          volume: item.volume,
        })),
      }
    } catch (err) {
      this.logger.error({ message: '通达信分时数据获取失败', thscode, error: err })
      throw new BadGatewayException('通达信行情获取失败')
    }
  }

  /**
   * thscode（`600519.SH`）→ 通达信代码（`sh600519`）
   *
   * 本模块对外统一使用项目的 thscode 格式，前缀转换细节在此收口。
   */
  private toTdxCode(thscode: string): string {
    const [ticker, suffix] = thscode.split('.')
    if (!ticker || !suffix) {
      throw new BadRequestException(`无效的标的代码: ${thscode}（应形如 600519.SH）`)
    }

    const upper = suffix.toUpperCase()
    if (!(TDX_EXCHANGE_SUFFIXES as readonly string[]).includes(upper)) {
      throw new BadRequestException(
        `不支持的交易所后缀: ${suffix}（支持 ${TDX_EXCHANGE_SUFFIXES.join(' / ')}）`
      )
    }

    return `${upper.toLowerCase()}${ticker}`
  }

  /** 校验历史分时的日期参数（`yyyyMMdd`） */
  private assertDate(date: number): void {
    if (!Number.isInteger(date) || date < 19700101 || date > 99991231) {
      throw new BadRequestException(`无效的日期: ${date}（应为 yyyyMMdd 格式，如 20261008）`)
    }
  }
}
