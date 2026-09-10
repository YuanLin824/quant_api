import { CodesMarket } from '../stock-sdk.types'
import { IsCodesMarket } from './validators'

/** 获取代码列表 DTO */
export class GetCodesDto {
  @IsCodesMarket()
  market!: CodesMarket
}
