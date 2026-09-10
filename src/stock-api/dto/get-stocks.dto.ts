import { IsCodeArray } from '../../common/decorators/is-code-array.decorator'

/** 批量获取股票行情 DTO */
export class GetStocksDto {
  @IsCodeArray('股票代码')
  codes!: string[]
}
