import { Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator'
import { AdjustType, KlinePeriod } from './constants'
import { GetKlineParamsDto } from './get-kline.dto'
import { IsAdjustType, IsKlineDate } from './validators'

/** K线周期枚举值集合（仅历史周期） */
const SIGNAL_PERIODS = Object.values(KlinePeriod)

/** 获取K线信号路径参数 DTO（与 K 线接口一致：market + code，继承复用校验） */
export class GetKlineSignalsParamsDto extends GetKlineParamsDto {}

/** 获取K线信号查询参数 DTO */
export class GetKlineSignalsQueryDto {
  @IsOptional()
  @IsIn(SIGNAL_PERIODS, {
    message: 'K线周期必须是 daily/weekly/monthly',
  })
  period?: string

  @IsAdjustType()
  adjust?: AdjustType

  @IsKlineDate('开始日期')
  startDate?: string

  @IsKlineDate('结束日期')
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
