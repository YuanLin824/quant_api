import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { priceToYuan, type TdxClient } from 'node-tdx-market'
import {
  TDX_CLIENT,
  TDX_EXCHANGE_SUFFIXES,
  TDX_KLINE_DEFAULT_COUNT,
  type TdxKlineCategory,
} from './api-tdx.constants'
import type { TdxKlineBar } from './api-tdx.types'
import { TdxKlineQueryDto } from './dto/kline-query.dto'

/**
 * 对外周期 → 库的 `KlineCategory` 数值映射
 *
 * 这里用**数值字面量**而不是 `KlineCategory.Day` 这类写法：库把该枚举声明为 `const enum`，
 * 而本项目开启了 `isolatedModules`，TypeScript 不允许访问 ambient const enum（TS2748）。
 *
 * 数值取自库的类型定义：`Minute5=0, Minute15=1, Minute30=2, Minute60=3, Week=5,
 * Month=6, Minute1=7, Day=9, Quarter=10, Year=11`（`Day2=4`、`Minute1Alt=8`
 * 是语义重复的成员，刻意不用）。升级该依赖时需核对这张表。
 */
const KLINE_CATEGORY_MAP: Record<TdxKlineCategory, number> = {
  '1m': 7, // Minute1
  '5m': 0, // Minute5
  '15m': 1, // Minute15
  '30m': 2, // Minute30
  '60m': 3, // Minute60
  day: 9, // Day
  week: 5, // Week
  month: 6, // Month
  quarter: 10, // Quarter
  year: 11, // Year
}

/**
 * 通达信行情数据服务
 *
 * 数据源契约（详见 API_TDX.md）：基于 `node-tdx-market` 直连通达信公开行情服务器，
 * **TCP 长连接**（非 HTTP），免费、零鉴权。与前几个数据源模块的三点差异：
 * - **长连接**：懒连接（首次调用时建连并复用），断线后下次调用自动重连
 * - **代码格式**：对外仍是项目的 thscode（`600519.SH`），内部转成库要求的 `sh600519`
 * - **价格单位**：上游是「厘」整数（元 × 1000），对外统一换算为元
 *
 * 当前实现 K 线（`getKlines`）——上游提供标准 OHLC 与分钟级周期，
 * 正好补上分时数据「只有成交价与量、无开高低」的短板。
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
   * 获取 K 线（最近的 N 根）
   *
   * 上游按「从最新往前倒推」取数，故这里只暴露 `count`（根数）而不暴露偏移——
   * 需要更早的历史时，增大 `count` 后在本地截取即可（单次上限 800 根）。
   * 价格已换算为元。
   */
  async getKlines(dto: TdxKlineQueryDto): Promise<TdxKlineBar[]> {
    await this.assertValidDto(dto, TdxKlineQueryDto)

    const code = this.toTdxCode(dto.thscode)
    const category = KLINE_CATEGORY_MAP[dto.category ?? 'day']
    const count = dto.count ?? TDX_KLINE_DEFAULT_COUNT

    await this.ensureConnected()

    try {
      const { bars } = await this.client.getKline({ code, category, start: 0, count })
      return bars.map((bar) => ({
        time: bar.time,
        open: priceToYuan(bar.open),
        high: priceToYuan(bar.high),
        low: priceToYuan(bar.low),
        close: priceToYuan(bar.close),
        // 成交额与价格同为「厘」（实测茅台日成交额 3260057856000 ÷ 1000 = 32.6 亿元，量级吻合）
        amount: priceToYuan(bar.amount),
        // 成交量单位为「手」，上游已是可读量级（实测茅台日成交约 2.6 万手），不做换算
        volume: bar.volume,
      }))
    } catch (err) {
      this.logger.error({ message: '通达信 K 线获取失败', thscode: dto.thscode, error: err })
      throw new BadGatewayException('通达信行情获取失败')
    }
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

  /**
   * 服务层入参校验
   *
   * 本模块没有 controller，不经过全局 ValidationPipe，DTO 上的校验装饰器**不会自动生效**，
   * 因此在服务入口显式触发一次。异常消息传字符串而非数组——数组会被 HttpException
   * 退化为构造器名（`Bad Request`），服务层调用方读 `err.message` 时拿不到中文。
   */
  private async assertValidDto<T extends object>(dto: T, metatype: new () => T): Promise<void> {
    const errors = await validate(plainToInstance(metatype, dto))
    const messages = errors.flatMap((err) => Object.values(err.constraints ?? {}))
    if (messages.length > 0) {
      throw new BadRequestException(messages.join('; '))
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
}
