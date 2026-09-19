import { BadRequestException, Injectable } from '@nestjs/common'
import { CliRunnerBase } from '../common/cli/cli-runner.base'
import {
  GO_CLI_BIN_PATH,
  KLINE_DEFAULT_LIMIT,
  KLINE_DEFAULT_PERIOD,
  KLINE_MINUTE_MAX_SPAN_DAYS,
  SEARCH_DEFAULT_LIMIT,
  type KlinePeriod,
} from './westock-cli.constants'
import type {
  KlineOptions,
  SearchOptions,
  WestockCliSearchResult,
  WestockKlineResult,
} from './westock-cli.types'

/**
 * 腾讯 Go CLI 服务（K 线与统一搜索）
 *
 * 通过子进程调用 `src/scripts/westock.exe` 获取数据。之所以不复用
 * `WestockDataService`（clawhub）的 kline：后者不支持分钟周期，
 * 传 `m1`/`5m` 等会静默回退到日线。
 */
@Injectable()
export class WestockCliService extends CliRunnerBase {
  constructor() {
    super(WestockCliService.name)
  }

  /** K 线数据：支持 11 种周期（含分钟）与复权 */
  async kline(code: string, options: KlineOptions = {}): Promise<WestockKlineResult> {
    const period = options.period ?? KLINE_DEFAULT_PERIOD
    const limit = options.limit ?? KLINE_DEFAULT_LIMIT

    // 分钟周期跨度上限由上游限制，前置校验以便返回 400 而非 503。
    // 仅在两端都显式传入时判定——只传一端时另一端由**上游**取默认值，本模块不补齐
    if (isMinutePeriod(period) && options.start && options.end) {
      const span = daysBetween(options.start, options.end)
      if (span > KLINE_MINUTE_MAX_SPAN_DAYS) {
        throw new BadRequestException(`分钟周期的日期跨度不能超过 ${KLINE_MINUTE_MAX_SPAN_DAYS} 天`)
      }
    }

    const args = ['kline', code, '--period', period, '--limit', String(limit)]
    if (options.fq) args.push('--fq', options.fq)
    if (options.start) args.push('--start', options.start)
    if (options.end) args.push('--end', options.end)

    const parsed = this.parseOrThrow(
      await this.runGoCli(args),
      `kline code=${code} period=${period} fq=${options.fq ?? '默认'} range=${options.start ?? '-'}~${options.end ?? '-'}`
    )

    return {
      code,
      period,
      fq: options.fq,
      start: options.start,
      end: options.end,
      columns: parsed.status === 'ok' ? parsed.columns : [],
      rows: parsed.status === 'ok' ? parsed.rows : [],
      total: parsed.status === 'ok' ? parsed.rows.length : 0,
    }
  }

  /**
   * 统一搜索：不传类型时 CLI **默认仅搜股票**（排除 ETF/可转债）
   *
   * 多类型时 CLI **按类型分段**返回，故结果是 `sections` 而非扁平行——
   * 必须用 `parseSectionsOrThrow`，`parseOrThrow` 只认单张表格，
   * 会把第二段的表头当成数据行混进结果。
   */
  async search(keyword: string, options: SearchOptions = {}): Promise<WestockCliSearchResult> {
    const trimmed = keyword.trim()
    // 前置校验以便返回 400 而非 503：CLI 对空关键词只报 `错误: 请提供搜索关键词`，
    // 那种输出解析不出表格，会被当成「上游异常」
    if (trimmed === '') {
      throw new BadRequestException('搜索关键词不能为空')
    }

    const limit = options.limit ?? SEARCH_DEFAULT_LIMIT
    const offset = options.offset ?? 0

    const args = ['search', trimmed, '--limit', String(limit)]
    if (options.types?.length) args.push('--type', options.types.join(','))
    if (options.market) args.push('--market', options.market)
    // offset 为 0 时不必显式传（与 CLI 默认一致）
    if (offset > 0) args.push('--offset', String(offset))

    const parsed = this.parseSectionsOrThrow(
      await this.runGoCli(args),
      `search keyword=${trimmed} type=${options.types?.join(',') ?? '默认(仅股票)'} market=${options.market ?? '-'} limit=${limit} offset=${offset}`
    )

    const sections = parsed.status === 'ok' ? parsed.sections : []

    return {
      keyword: trimmed,
      types: options.types,
      market: options.market,
      limit,
      offset,
      sections,
      // 各段行数之和；上游命中总数在每段的 `total` 里（分页时两者不同）
      total: sections.reduce((sum, section) => sum + section.rows.length, 0),
    }
  }

  /** 直接执行二进制（与 clawhub 的 `node <入口>` 方式不同） */
  private runGoCli(args: string[]): Promise<string> {
    return this.exec(GO_CLI_BIN_PATH, args, GO_CLI_BIN_PATH)
  }
}

/** 分钟周期判定（取值形如 `m1`/`m120`） */
function isMinutePeriod(period: KlinePeriod): boolean {
  return period.startsWith('m')
}

/** 两个 `YYYY-MM-DD` 之间的天数差（按 UTC 计算，避免时区干扰） */
function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  return Math.round((endMs - startMs) / 86_400_000)
}
