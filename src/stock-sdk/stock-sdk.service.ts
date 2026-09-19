import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { StockSDK } from 'stock-sdk'
import { SDK_TIMEOUT_MS, type SdkAShareMarket, type SdkMarket } from './stock-sdk.constants'

/** 代码列表查询选项 */
export interface CodeListOptions {
  market: SdkMarket
  /** 是否返回不带前缀的纯代码 */
  simple?: boolean
  /** A 股细分市场（仅 `market=cn` 有效） */
  exchange?: SdkAShareMarket
}

/**
 * stock-sdk 服务
 *
 * 通过 `stock-sdk`（npm 包，零依赖）请求东方财富/腾讯等公开数据源获取证券代码列表。
 * **纯透传、不落库**——与 `SymbolsService`（定时同步入库的那套）是两条独立的取数路径，
 * 可用作交叉对照。
 *
 * 与 TdxModule 的区别：本模块走 HTTP，而 TDX 是通达信 TCP 长连接协议。
 */
@Injectable()
export class StockSdkService {
  private readonly logger = new Logger(StockSdkService.name)
  private readonly sdk: StockSDK

  constructor() {
    this.sdk = new StockSDK({ timeout: SDK_TIMEOUT_MS })
  }

  /**
   * 获取代码列表
   *
   * 返回**纯字符串数组**（不含名称等附加信息），且已做**格式规范化**：
   * - A 股：`sh600036` / `sz000001` / `bj920000`（上游已带前缀，原样保留）
   * - 港股：`hk00700`（上游是纯数字 `00700`，补前缀）
   * - 美股：`usAAPL`（上游是东财 secid `105.AAPL`，换前缀）
   *
   * `simple` 与 `exchange` 仅对 A 股与美股有意义——其余市场没有这些维度，
   * 传了会被忽略（而非报错），这与上游 `getHKCodeList()` 不接受任何参数的设计一致。
   */
  async getCodeList(options: CodeListOptions): Promise<string[]> {
    let codes: string[]
    try {
      switch (options.market) {
        case 'cn':
          codes = await this.sdk.codes.cn({
            ...(options.simple !== undefined ? { simple: options.simple } : {}),
            ...(options.exchange ? { market: options.exchange } : {}),
          })
          break
        case 'us':
          codes = await this.sdk.codes.us(
            options.simple !== undefined ? { simple: options.simple } : {}
          )
          break
        case 'hk':
          codes = await this.sdk.codes.hk()
          break
        case 'fund':
          codes = await this.sdk.codes.fund()
          break
        default:
          // 穷尽检查：新增市场时这里会编译报错，避免漏配分支
          throw new ServiceUnavailableException(`未支持的市场: ${String(options.market)}`)
      }
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err

      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`stock-sdk 获取代码列表失败 [${options.market}]: ${message}`)
      throw new ServiceUnavailableException('证券代码服务调用失败，请稍后重试')
    }

    // A 股要求 simple 时才返回纯数字，此时不该再补前缀——规范化需跳过
    if (options.market === 'cn' && options.simple === true) return codes

    return this.normalize(options.market, codes)
  }

  /**
   * 代码格式规范化：统一为「市场前缀 + 代码」
   *
   * 上游三个市场的原始格式**并不统一**（实测）：
   * - **A 股**：自带前缀（`sh600036` / `sz000001` / `bj920000`），原样保留
   * - **港股**：纯数字（`00700`），补 `hk` → `hk00700`
   * - **美股**：东财 secid 格式（`105.AAPL`，105=NASDAQ / 106=NYSE / 107=AMEX），
   *   把前缀换成 `us` → `usAAPL`
   *
   * 同时**去重**：美股同一只标的可能同时挂在两个板块下（`105.PC` 与 `106.PC`），
   * 规范化后会撞成同一个 `usPC`，需要合并。
   *
   * 规范化是幂等的——已符合格式的代码再次处理不会叠加前缀。
   */
  private normalize(market: SdkMarket, codes: string[]): string[] {
    const seen = new Set<string>()
    const normalized: string[] = []

    for (const code of codes) {
      let result: string
      switch (market) {
        case 'hk':
          result = /^hk/i.test(code) ? code : `hk${code}`
          break
        case 'us':
          // 只匹配开头的「数字 + 点」，不影响代码自身的点号（105.BRK.A → usBRK.A）
          result = code.replace(/^\d+\./, 'us')
          break
        default:
          result = code
      }

      if (seen.has(result)) continue
      seen.add(result)
      normalized.push(result)
    }

    return normalized
  }

  /**
   * 清空 SDK 内部缓存
   *
   * 代码表/交易日历等缓存按实例隔离（R7-11 起），长驻进程需要强刷时用。
   * 当前未对外暴露接口，保留给后续的运维路径。
   */
  clearCaches(): void {
    this.sdk.clearCaches()
  }
}
