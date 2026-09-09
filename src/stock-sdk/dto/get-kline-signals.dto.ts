import { Transform, Type } from 'class-transformer'
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator'
import { Market } from '../stock-sdk.types'
import { AdjustType, DATE_PATTERN, KlinePeriod } from './get-kline.dto'

/** K线周期枚举值集合（仅历史周期） */
const SIGNAL_PERIODS = Object.values(KlinePeriod)

/** 获取K线信号路径参数 DTO */
export class GetKlineSignalsParamsDto {
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(Market, { message: '市场类型必须是 cn/hk/us' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 获取K线信号查询参数 DTO */
export class GetKlineSignalsQueryDto {
  @IsOptional()
  @IsIn(SIGNAL_PERIODS, {
    message: 'K线周期必须是 daily/weekly/monthly',
  })
  period?: string

  @IsOptional()
  @IsEnum(AdjustType, { message: '复权类型必须是 qfq/hfq/空字符串' })
  adjust?: AdjustType

  @IsOptional()
  @Matches(DATE_PATTERN, { message: '开始日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  startDate?: string

  @IsOptional()
  @Matches(DATE_PATTERN, { message: '结束日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  endDate?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maFast 必须是数字' })
  @Min(1, { message: 'maFast 最小为 1' })
  maFast?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maSlow 必须是数字' })
  @Min(1, { message: 'maSlow 最小为 1' })
  maSlow?: number
}
