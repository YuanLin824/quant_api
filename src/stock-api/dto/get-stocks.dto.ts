import { IsArray, IsNotEmpty, IsString } from 'class-validator'

/** 批量获取股票行情 DTO */
export class GetStocksDto {
  @IsArray({ message: '股票代码必须是数组' })
  @IsString({ each: true, message: '股票代码必须是字符串' })
  @IsNotEmpty({ each: true, message: '股票代码不能为空' })
  codes!: string[]
}
