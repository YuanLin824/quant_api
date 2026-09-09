import { Transform, Type } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { Market } from '../stock-sdk.types'

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
