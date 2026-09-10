import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'
import type { IndicatorOptions } from 'stock-sdk'
import { Market } from '../stock-sdk.types'
import { AdjustType, KLINE_PERIODS } from './constants'
import { IsAdjustType, IsKlineDate, IsSdkMarket } from './validators'

/** 获取K线数据路径参数 DTO */
export class GetKlineParamsDto {
  @IsSdkMarket()
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 获取K线数据查询参数 DTO */
export class GetKlineQueryDto {
  @IsOptional()
  @IsIn(KLINE_PERIODS, {
    message: 'K线周期必须是 daily/weekly/monthly 或 1/5/15/30/60',
  })
  period?: string

  @IsAdjustType()
  adjust?: AdjustType

  @IsKlineDate('开始日期')
  startDate?: string

  @IsKlineDate('结束日期')
  endDate?: string

  @IsOptional()
  @IsObject({ message: 'indicators 必须是对象' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    }
    return value ?? {}
  })
  indicators?: IndicatorOptions
}
