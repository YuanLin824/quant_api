import {
  GatewayTimeoutException,
  HttpException,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common'
import { execFile, type ChildProcess, type ExecFileException } from 'node:child_process'
import { CLI_MAX_BUFFER, CLI_SETUP_HINT, CLI_TIMEOUT_MS, LOG_SNIPPET_LENGTH } from './cli.constants'
import type { TableParseResult } from './cli.types'
import { parseTableOutput } from './table-parser'

/**
 * CLI 子进程调用的公共基类
 *
 * 封装各个 CLI 服务共用的部分：`execFile` 调用、超时与错误分类、
 * 在途进程的生命周期管理、以及「输出无法解析」的统一判定。
 *
 * 与项目中的长连接服务（如 `TdxService`）不同，这里每次调用 fork 一个进程，
 * 因此需要处理的是**进程生命周期**：超时终止、模块销毁时清掉在途进程。
 *
 * `execFile` 而非 shell：参数以数组传递，天然免疫命令注入。
 */
export abstract class CliRunnerBase implements OnModuleDestroy {
  protected readonly logger: Logger

  /** 在途子进程，销毁时统一终止，避免进程退出时挂起 */
  private readonly running = new Set<ChildProcess>()

  protected constructor(context: string) {
    this.logger = new Logger(context)
  }

  onModuleDestroy(): void {
    for (const child of this.running) child.kill()
    this.running.clear()
  }

  /** 解析输出；无法解析即视为上游异常（无结果不在此列） */
  protected parseOrThrow(stdout: string, context: string): TableParseResult {
    const parsed = parseTableOutput(stdout)

    if (parsed.status === 'invalid') {
      this.logger.error(`CLI 输出无法解析: ${context} stdout=${truncate(stdout)}`)
      throw new ServiceUnavailableException('证券数据服务返回异常，请稍后重试')
    }

    return parsed
  }

  /** 执行子进程并返回 stdout；失败按类型转为 HTTP 异常 */
  protected exec(command: string, args: string[], artifact: string): Promise<string> {
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
        `CLI 不可用（${error.code}）: 组件=${artifact}，可执行 ${CLI_SETUP_HINT} 重新获取`
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
