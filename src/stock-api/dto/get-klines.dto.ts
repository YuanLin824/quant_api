import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import { KlinePeriod, Market } from '../stock-api.types'

/** 获取K线数据路径参数 DTO */
export class GetKlinesParamsDto {
  @IsEnum(Market, { message: '市场类型必须是 SH/SZ/HK/US' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 获取K线数据查询参数 DTO */
export class GetKlinesQueryDto {
  @IsOptional()
  @IsEnum(KlinePeriod, { message: 'K线周期必须是 day/week/month' })
  period?: KlinePeriod

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'count 必须是整数' })
  @Min(1, { message: 'count 最小为 1' })
  @Max(1000, { message: 'count 最大为 1000' })
  count?: number
}
