import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { KlinePeriod, Market } from '../stock-api.types'

/** 获取K线数据 DTO */
export class GetKlinesDto {
  @IsEnum(Market, { message: '市场类型必须是 SH/SZ/HK/US' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string

  @IsOptional()
  @IsEnum(KlinePeriod, { message: 'K线周期必须是 day/week/month' })
  period?: KlinePeriod

  @IsOptional()
  count?: number
}
