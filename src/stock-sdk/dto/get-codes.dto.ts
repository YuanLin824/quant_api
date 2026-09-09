import { Transform } from 'class-transformer'
import { IsEnum } from 'class-validator'
import { CodesMarket } from '../stock-sdk.types'

/** 获取代码列表 DTO */
export class GetCodesDto {
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(CodesMarket, { message: '市场类型必须是 cn/hk/us/fund' })
  market!: CodesMarket
}
