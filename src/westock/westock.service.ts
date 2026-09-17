import {
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common'
import { execFile, type ChildProcess, type ExecFileException } from 'node:child_process'
import {
  CLI_ENTRY_PATH,
  CLI_MAX_BUFFER,
  CLI_TIMEOUT_MS,
  MINUTE_DEFAULT_DAYS,
  type SearchScope,
} from './westock.constants'
import { parseTableOutput } from './westock.parser'
import type {
  MinuteOptions,
  TableParseResult,
  WestockMinuteResult,
  WestockSearchResult,
} from './westock.types'

/** 日志中截断输出的长度，避免刷屏 */
const LOG_SNIPPET_LENGTH = 500

/**
 * WeStock 数据服务
 *
 * 通过子进程调用 `scripts/westock-data-clawhub.mjs`（单文件 bundle，ESM）获取证券数据。
 * 与项目中其它服务不同，这里没有长连接可维护——每次调用 fork 一个进程
 * （实测约 400ms），因此需要处理的是**进程生命周期**：超时终止、
 * 模块销毁时清掉在途进程。
 *
 * 用 `execFile` 而非 shell：参数以数组传递，天然免疫命令注入。
 * 入口经 `process.execPath` 调用而非直接执行 bin——Windows 下 `.bin` 是
 * shell 脚本，execFile 无法直接运行。
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

    const parsed = this.parseOrThrow(await this.run(args), `search keyword=${keyword}`)

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

    const parsed = this.parseOrThrow(await this.run(args), `minute code=${code} days=${days}`)

    return {
      code,
      days,
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

  /** 执行 CLI 子命令并返回 stdout */
  private run(args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.execPath, // 用当前 node 执行入口，避免依赖 .bin 的 shell 包装
        [CLI_ENTRY_PATH, ...args],
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
          reject(this.toException(error, args.join(' '), stderr))
        }
      )

      this.running.add(child)
      child.once('close', () => this.running.delete(child))
    })
  }

  /** 把子进程错误分类为对外的 HTTP 异常（原始输出只进日志，不进 message） */
  private toException(error: ExecFileException, args: string, stderr: string): HttpException {
    if (error.killed) {
      this.logger.error(`CLI 执行超时: args=${args} 超时=${CLI_TIMEOUT_MS}ms`)
      return new GatewayTimeoutException('证券数据查询超时，请稍后重试')
    }

    // 入口文件缺失或无读取权限
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      this.logger.error(
        `CLI 不可用（${error.code}）: 入口=${CLI_ENTRY_PATH}，请确认 scripts/westock-data-clawhub.mjs 存在`
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
