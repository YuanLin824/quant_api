import { IsCodeArray } from '../../common/decorators/is-code-array.decorator'

/** 获取大单数据 DTO */
export class GetLargeOrderDto {
  @IsCodeArray('股票代码')
  codes!: string[]
}
