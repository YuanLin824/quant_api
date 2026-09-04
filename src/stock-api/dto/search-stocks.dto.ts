import { IsNotEmpty, IsString } from 'class-validator'

/** 搜索股票 DTO */
export class SearchStocksDto {
  @IsString({ message: '关键词必须是字符串' })
  @IsNotEmpty({ message: '关键词不能为空' })
  keyword!: string
}
