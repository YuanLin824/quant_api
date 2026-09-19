import { Transform, Type } from 'class-transformer'
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
  type KlineFq,
  type KlinePeriod,
  CODE_MAX_LENGTH,
  DATE_PATTERN,
  KLINE_FQ_VALUES,
  KLINE_MAX_LIMIT,
  KLINE_PERIODS,
  TEXT_INPUT_PATTERN,
} from '../westock.constants'

/** 多代码查询时的长度上限（单个代码最长 20，逗号分隔后留足余量） */
const CODE_LIST_MAX_LENGTH = CODE_MAX_LENGTH * 10

/** K 线数据的查询参数 */
export class GetKlineQueryDto {
  /**
   * 证券代码，**须带市场前缀**（如 `sh600519` / `hk00700` / `pt01801081`）
   *
   * 支持逗号分隔多代码（CLI 原生批量），如 `sh600519,hk00700`。
   * 先 trim 再校验；不允许以 `-` 开头，否则会被 CLI 当作参数开关。
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '证券代码必须是字符串' })
  @IsNotEmpty({ message: '证券代码不能为空' })
  @MaxLength(CODE_LIST_MAX_LENGTH, {
    message: `证券代码过长（多代码以逗号分隔，总长不超过 ${CODE_LIST_MAX_LENGTH}）`,
  })
  @Matches(TEXT_INPUT_PATTERN, { message: '证券代码不能以 - 开头，也不能包含控制字符' })
  code!: string

  /**
   * K 线周期
   *
   * 注意是 `m1`/`m5`（前缀 m）而非 `1m`/`5m`——后者会被 CLI 判为不支持的周期。
   */
  @IsOptional()
  @IsIn(KLINE_PERIODS, { message: `K线周期必须是 ${KLINE_PERIODS.join('/')}` })
  period?: KlinePeriod

  /** 返回条数 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 最小为 1' })
  @Max(KLINE_MAX_LIMIT, { message: `limit 最大为 ${KLINE_MAX_LIMIT}` })
  limit?: number

  /** 复权方式（不传则由上游默认；`bfq` 仅部分市场支持） */
  @IsOptional()
  @IsIn(KLINE_FQ_VALUES, { message: `复权方式必须是 ${KLINE_FQ_VALUES.join('/')}` })
  fq?: KlineFq

  /**
   * 起始日期 `YYYY-MM-DD`
   *
   * **分钟周期查历史必须指定**——不传时上游默认只返回当天。
   * 分钟周期的 `start`~`end` 跨度不能超过 5 天（由 service 校验）。
   */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'start 必须是 YYYY-MM-DD 格式' })
  start?: string

  /** 结束日期 `YYYY-MM-DD` */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'end 必须是 YYYY-MM-DD 格式' })
  end?: string
}
