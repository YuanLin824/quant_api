import { Injectable } from '@nestjs/common'
import { CliRunnerBase } from '../common/cli/cli-runner.base'
import { CLAWHUB_ENTRY_PATH, MINUTE_DEFAULT_DAYS } from './westock-data.constants'
import type { MinuteOptions, WestockMinuteResult } from './westock-data.types'

/**
 * `westock-data-clawhub` 服务（分时）
 *
 * 通过子进程执行仓库 `src/scripts/` 下的单文件 bundle 获取数据。
 *
 * 本服务**只剩分时**：搜索已由 `WestockCliService.search`（腾讯 Go CLI）承接——
 * 后者支持类型/市场/分页，能力全面覆盖且更强；K 线也不在这里，本 CLI 的 kline
 * 不支持分钟周期，见 `WestockCliService`。
 */
@Injectable()
export class WestockDataService extends CliRunnerBase {
  constructor() {
    super(WestockDataService.name)
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

  /** 经 `node <入口>` 执行 bundle（避免依赖 .bin 的 shell 包装） */
  private runClawhub(args: string[]): Promise<string> {
    return this.exec(process.execPath, [CLAWHUB_ENTRY_PATH, ...args], CLAWHUB_ENTRY_PATH)
  }
}
