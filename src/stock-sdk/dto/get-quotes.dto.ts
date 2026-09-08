import { Transform } from 'class-transformer'
import { IsArray, IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { Market } from '../stock-sdk.types'

/** 获取股票行情路径参数 DTO */
export class GetQuotesParamsDto {
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(Market, { message: '市场类型必须是 cn/hk/us' })
  market!: Market
}

/** 获取股票行情请求体 DTO */
export class GetQuotesBodyDto {
  @IsArray({ message: '股票代码必须是数组' })
  @IsString({ each: true, message: '股票代码必须是字符串' })
  @IsNotEmpty({ each: true, message: '股票代码不能为空' })
  codes!: string[]
}
