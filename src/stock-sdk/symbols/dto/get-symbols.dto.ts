import { IsOptional } from 'class-validator'
import { IsCodesMarket } from '../../dto/validators'
import { CodesMarket } from '../../stock-sdk.types'

/** 查询标的代码的查询参数 */
export class GetSymbolsDto {
  /** 市场；不传则返回各市场的代码数量统计 */
  @IsOptional()
  @IsCodesMarket()
  market?: CodesMarket
}
