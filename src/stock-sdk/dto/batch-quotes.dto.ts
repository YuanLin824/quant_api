import { IsCodeArray } from '../../common/decorators/is-code-array.decorator'
import { Market } from '../stock-sdk.types'
import { IsBatchSize, IsConcurrency, IsSdkMarket } from './validators'

/** 获取全部行情路径参数 DTO */
export class GetAllQuotesParamsDto {
  @IsSdkMarket()
  market!: Market
}

/** 获取全部行情查询参数 DTO */
export class GetAllQuotesQueryDto {
  @IsBatchSize()
  batchSize?: number

  @IsConcurrency()
  concurrency?: number
}

/** 按代码批量获取行情 DTO */
export class BatchByCodesDto {
  @IsCodeArray('股票代码')
  codes!: string[]

  @IsBatchSize()
  batchSize?: number

  @IsConcurrency()
  concurrency?: number
}
