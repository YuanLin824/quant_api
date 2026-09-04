import { IsArray, IsNotEmpty, IsString } from 'class-validator'

/** 批量获取基金行情 DTO */
export class GetFundQuotesDto {
  @IsArray({ message: '基金代码必须是数组' })
  @IsString({ each: true, message: '基金代码必须是字符串' })
  @IsNotEmpty({ each: true, message: '基金代码不能为空' })
  codes!: string[]
}
