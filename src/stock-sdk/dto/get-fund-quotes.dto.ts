import { IsCodeArray } from '../../common/decorators/is-code-array.decorator'

/** 批量获取基金行情 DTO */
export class GetFundQuotesDto {
  @IsCodeArray('基金代码')
  codes!: string[]
}
