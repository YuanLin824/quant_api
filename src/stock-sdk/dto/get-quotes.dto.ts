import { IsCodeArray } from '../../common/decorators/is-code-array.decorator'
import { Market } from '../stock-sdk.types'
import { IsSdkMarket } from './validators'

/** 获取股票行情路径参数 DTO */
export class GetQuotesParamsDto {
  @IsSdkMarket()
  market!: Market
}

/** 获取股票行情请求体 DTO */
export class GetQuotesBodyDto {
  @IsCodeArray('股票代码')
  codes!: string[]
}
