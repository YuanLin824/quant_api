import { Transform } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'
import type { IndicatorOptions } from 'stock-sdk'
import { Market } from '../stock-sdk.types'

/** 获取带指标K线数据路径参数 DTO */
export class GetKlineWithIndicatorsParamsDto {
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(Market, { message: '市场类型必须是 cn/hk/us' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 获取带指标K线数据查询参数 DTO */
export class GetKlineWithIndicatorsQueryDto {
  @IsOptional()
  @IsString({ message: 'K线周期必须是字符串' })
  period?: string

  @IsOptional()
  @IsString({ message: '复权类型必须是字符串' })
  adjust?: string

  @IsOptional()
  @IsString({ message: '开始日期必须是字符串' })
  startDate?: string

  @IsOptional()
  @IsString({ message: '结束日期必须是字符串' })
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
