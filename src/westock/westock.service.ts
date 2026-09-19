import {
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common'
import { execFile, type ChildProcess, type ExecFileException } from 'node:child_process'
import {
  CLAWHUB_ENTRY_PATH,
  CLI_MAX_BUFFER,
  CLI_TIMEOUT_MS,
  GO_CLI_BIN_PATH,
  KLINE_DEFAULT_LIMIT,
  KLINE_DEFAULT_PERIOD,
  KLINE_MINUTE_MAX_SPAN_DAYS,
  MINUTE_DEFAULT_DAYS,
  type KlinePeriod,
  type SearchScope,
} from './westock.constants'
import { parseTableOutput } from './westock.parser'
import type {
  KlineOptions,
  MinuteOptions,
  TableParseResult,
  WestockKlineResult,
  WestockMinuteResult,
  WestockSearchResult,
} from './westock.types'

/** 日志中截断输出的长度，避免刷屏 */
const LOG_SNIPPET_LENGTH = 500

/**
 * WeStock 数据服务
 *
 * 通过子进程调用第三方 CLI 获取证券数据。用到**两个** CLI，能力互补：
 * - `westock-data-clawhub`（bundle，经 node 执行入口）→ search、minute
 * - 腾讯 Go CLI（直接执行二进制）→ kline（clawhub 的 kline 无分钟周期）
 *
 * 与项目中其它服务不同，这里没有长连接可维护——每次调用 fork 一个进程
 * （实测约 400ms），因此需要处理的是**进程生命周期**：超时终止、
 * 模块销毁时清掉在途进程。
 *
 * 用 `execFile` 而非 shell：参数以数组传递，天然免疫命令注入。
 */
@Injectable()
export class WestockService implements OnModuleDestroy {
  private readonly logger = new Logger(WestockService.name)
  /** 在途子进程，销毁时统一终止，避免进程退出时挂起 */
  private readonly running = new Set<ChildProcess>()

  onModuleDestroy(): void {
    for (const child of this.running) child.kill()
    this.running.clear()
  }

  /** 证券搜索：按关键词查代码 */
  async search(keyword: string, scope?: SearchScope): Promise<WestockSearchResult> {
    const args = ['search', keyword]
    if (scope) args.push(`--${scope}`)

    const parsed = this.parseOrThrow(await this.runClawhub(args), `search keyword=${keyword}`)

    return {
      keyword,
      scope,
      columns: parsed.status === 'ok' ? parsed.columns : [],
      rows: parsed.status === 'ok' ? parsed.rows : [],
      total: parsed.status === 'ok' ? parsed.rows.length : 0,
    }
  }

  /** 分时数据：`days` 为 1 时是当日，2~5 为五日（CLI 上限即 5） */
  async minute(code: string, options: MinuteOptions = {}): Promise<WestockMinuteResult> {
    const days = options.days ?? MINUTE_DEFAULT_DAYS
    const args = ['minute', code]
    if (days > MINUTE_DEFAULT_DAYS) args.push('--days', String(days))

    const parsed = this.parseOrThrow(
      await this.runClawhub(args),
      `minute code=${code} days=${days}`
    )

    return {
      code,
      days,
      columns: parsed.status === 'ok' ? parsed.columns : [],
      rows: parsed.status === 'ok' ? parsed.rows : [],
      total: parsed.status === 'ok' ? parsed.rows.length : 0,
    }
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

    // `code` 已由 DTO 校验为纯代码，多代码以逗号分隔（CLI 原生支持）
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

  /** 解析输出；无法解析即视为上游异常（无结果不在此列） */
  private parseOrThrow(stdout: string, context: string): TableParseResult {
    const parsed = parseTableOutput(stdout)

    if (parsed.status === 'invalid') {
      this.logger.error(`CLI 输出无法解析: ${context} stdout=${truncate(stdout)}`)
      throw new ServiceUnavailableException('证券数据服务返回异常，请稍后重试')
    }

    return parsed
  }

  /** 调用 clawhub bundle（经 node 执行入口，避免依赖 .bin 的 shell 包装） */
  private runClawhub(args: string[]): Promise<string> {
    return this.exec(process.execPath, [CLAWHUB_ENTRY_PATH, ...args], CLAWHUB_ENTRY_PATH)
  }

  /** 调用腾讯 Go CLI（直接执行二进制） */
  private runGoCli(args: string[]): Promise<string> {
    return this.exec(GO_CLI_BIN_PATH, args, GO_CLI_BIN_PATH)
  }

  /** 执行子进程并返回 stdout；失败按类型转为 HTTP 异常 */
  private exec(command: string, args: string[], artifact: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        command,
        args,
        {
          timeout: CLI_TIMEOUT_MS,
          killSignal: 'SIGKILL',
          windowsHide: true,
          encoding: 'utf8',
          maxBuffer: CLI_MAX_BUFFER,
        },
        (error, stdout, stderr) => {
          if (!error) {
            resolve(stdout)
            return
          }
          reject(this.toException(error, args.join(' '), stderr, artifact))
        }
      )

      this.running.add(child)
      child.once('close', () => this.running.delete(child))
    })
  }

  /** 把子进程错误分类为对外的 HTTP 异常（原始输出只进日志，不进 message） */
  private toException(
    error: ExecFileException,
    args: string,
    stderr: string,
    artifact: string
  ): HttpException {
    if (error.killed) {
      this.logger.error(`CLI 执行超时: args=${args} 超时=${CLI_TIMEOUT_MS}ms`)
      return new GatewayTimeoutException('证券数据查询超时，请稍后重试')
    }

    // 组件文件缺失或无读取权限
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      this.logger.error(
        `CLI 不可用（${error.code}）: 组件=${artifact}，可执行 npm run setup:westock 重新获取`
      )
      return new ServiceUnavailableException('证券数据组件不可用，请稍后重试')
    }

    this.logger.error(
      `CLI 调用失败: args=${args} exit=${String(error.code)} stderr=${truncate(stderr)}`
    )
    return new ServiceUnavailableException('证券数据服务调用失败，请稍后重试')
  }
}

/** 压缩并截断输出，仅用于日志 */
function truncate(text: string): string {
  const compact = text.trim().replace(/\s+/g, ' ')
  return compact.length > LOG_SNIPPET_LENGTH ? `${compact.slice(0, LOG_SNIPPET_LENGTH)}…` : compact
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
