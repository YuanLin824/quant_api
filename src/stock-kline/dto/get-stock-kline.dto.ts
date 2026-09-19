import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import {
  DATE_PATTERN,
  KLINE_FQ_VALUES,
  KLINE_PERIODS,
  type KlineFq,
  type KlinePeriod,
} from '../../westock-cli/westock-cli.constants'
import { STOCK_KLINE_QUERY_MAX_LIMIT } from '../stock-kline.constants'

/** 查询 K 线的查询参数 */
export class GetKlinesQueryDto {
  /** 证券代码（带市场前缀，如 `sh600036`） */
  @IsString({ message: '证券代码必须是字符串' })
  @IsNotEmpty({ message: '证券代码不能为空' })
  @MaxLength(20, { message: '证券代码最长 20 个字符' })
  code!: string

  /**
   * K 线周期，不传默认日线
   *
   * 取值即 `westock` CLI 的 `--period`（**分钟级前缀是 `m`，不是后缀**）：
   * `m1`/`m5`/`m15`/`m30`/`m60`/`m120`/`day`/`week`/`month`/`season`/`year`。
   * 分钟级只影响**时间字段的精度**（`YYYY-MM-DD HH:mm`）与上游的可用历史长度。
   */
  @IsOptional()
  @IsIn(KLINE_PERIODS, { message: `period 必须是 ${KLINE_PERIODS.join('/')} 之一` })
  period?: KlinePeriod

  /**
   * 复权方式，不传则由上游取默认（**实测为前复权 `qfq`**）
   *
   * - `qfq` 前复权 / `hfq` 后复权 / `nofq` 不复权
   * - ⚠️ `bfq`（不复权，同 `nofq` 的别名）**A 股不支持**，传了会由上游报错 → 503；港股正常
   */
  @IsOptional()
  @IsIn(KLINE_FQ_VALUES, { message: `fq 必须是 ${KLINE_FQ_VALUES.join('/')} 之一` })
  fq?: KlineFq

  /**
   * 起始日期 `YYYY-MM-DD`，不传时由服务层补 `1990-07-31`（等价于全部可得历史）
   *
   * ⚠️ 与 `end` **同时传入**时，分钟周期的跨度不能超过 5 天，否则 400。
   */
  @IsOptional()
  @IsString({ message: 'start 必须是字符串' })
  @Matches(DATE_PATTERN, { message: 'start 格式必须为 YYYY-MM-DD' })
  start?: string

  /**
   * 结束日期 `YYYY-MM-DD`，不传时由上游取当日
   *
   * ⚠️ 分钟周期请与 `start` 一并传入（跨度 ≤ 5 天）——只给 `end` 会因默认 `start` 跨度过大而 400。
   */
  @IsOptional()
  @IsString({ message: 'end 必须是字符串' })
  @Matches(DATE_PATTERN, { message: 'end 格式必须为 YYYY-MM-DD' })
  end?: string

  /**
   * 返回条数（取最近 N 根）
   *
   * 上限即上游的硬截断点——超过不会报错，只会**静默少返回**，故必须挡住。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 最小为 1' })
  @Max(STOCK_KLINE_QUERY_MAX_LIMIT, { message: `limit 最大为 ${STOCK_KLINE_QUERY_MAX_LIMIT}` })
  limit?: number
}
