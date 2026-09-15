import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator'

/** 分笔成交接口的路径参数 */
export class GetTradeParamsDto {
  /** 股票代码，如 600036 或 sh600036 */
  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 当日分笔成交的查询参数 */
export class GetTradeQueryDto {
  /** 起始位置（0 = 最新） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'start 必须是整数' })
  @Min(0, { message: 'start 最小为 0' })
  start?: number

  /** 返回数量 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'count 必须是整数' })
  @Min(1, { message: 'count 最小为 1' })
  count?: number
}

/** 历史分笔成交的查询参数 */
export class GetHistoryTradeQueryDto {
  /** 交易日期，格式 YYYYMMDD */
  @Matches(/^\d{8}$/, { message: '日期必须是 YYYYMMDD 格式' })
  date!: string

  /** 起始位置（0 = 最新） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'start 必须是整数' })
  @Min(0, { message: 'start 最小为 0' })
  start?: number

  /** 返回数量 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'count 必须是整数' })
  @Min(1, { message: 'count 最小为 1' })
  count?: number
}
