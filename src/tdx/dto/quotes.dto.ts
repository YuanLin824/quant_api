import { IsCodeArray } from '../../common/decorators/is-code-array.decorator'

/** 批量获取五档盘口的请求体 */
export class GetQuotesBodyDto {
  /** 股票代码数组 */
  @IsCodeArray('股票代码')
  codes!: string[]
}
