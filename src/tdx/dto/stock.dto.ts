import { IsIn } from 'class-validator'
import { EXCHANGES, type ExchangeKey } from '../tdx.constants'

/** 交易所路径参数（证券数量 / 证券列表共用） */
export class GetExchangeParamsDto {
  @IsIn(EXCHANGES, { message: `交易所必须是 ${EXCHANGES.join('/')}` })
  exchange!: ExchangeKey
}
