import { Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import { KLINE_MAX_COUNT, KLINE_PERIODS, type KlinePeriodKey } from '../tdx.constants'

/** 获取 K 线的路径参数 */
export class GetKlineParamsDto {
  /** 股票代码，如 600036 或 sh600036 */
  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 获取 K 线的查询参数 */
export class GetKlineQueryDto {
  /** K 线周期，默认 day */
  @IsOptional()
  @IsIn(KLINE_PERIODS, { message: `K线周期必须是 ${KLINE_PERIODS.join('/')}` })
  period?: KlinePeriodKey

  /** 起始位置（0 = 最新，往前倒推） */
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
  @Max(KLINE_MAX_COUNT, { message: `count 最大为 ${KLINE_MAX_COUNT}` })
  count?: number
}
