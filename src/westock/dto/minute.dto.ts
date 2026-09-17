import { Transform, Type } from 'class-transformer'
import {
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
  CODE_MAX_LENGTH,
  MINUTE_DEFAULT_DAYS,
  MINUTE_MAX_DAYS,
  TEXT_INPUT_PATTERN,
} from '../westock.constants'

/** 分时数据的查询参数 */
export class GetMinuteQueryDto {
  /**
   * 证券代码（需带市场前缀，如 `sh600519` / `hk00700`）
   *
   * 先 trim 再校验；不允许以 `-` 开头，否则会被 CLI 当作参数开关。
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '证券代码必须是字符串' })
  @IsNotEmpty({ message: '证券代码不能为空' })
  @MaxLength(CODE_MAX_LENGTH, { message: `证券代码最长 ${CODE_MAX_LENGTH} 个字符` })
  @Matches(TEXT_INPUT_PATTERN, { message: '证券代码不能以 - 开头，也不能包含控制字符' })
  code!: string

  /** 天数：1 = 当日，2~5 = 五日（CLI 上限即 5） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days 必须是整数' })
  @Min(MINUTE_DEFAULT_DAYS, { message: `days 最小为 ${MINUTE_DEFAULT_DAYS}` })
  @Max(MINUTE_MAX_DAYS, { message: `days 最大为 ${MINUTE_MAX_DAYS}` })
  days?: number
}
