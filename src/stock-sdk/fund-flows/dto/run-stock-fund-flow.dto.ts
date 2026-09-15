import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, Matches } from 'class-validator'
import { DATE_PATTERN } from '../../dto/constants'
import type { RankIndicator } from '../stock-fund-flow.service'

/** 手动触发个股资金流采集的请求体 */
export class RunStockFundFlowDto {
  /** 数据所属交易日；不传则取当天或之前最近的交易日 */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: '数据日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  tradeDate?: string

  /** 排名周期，默认 today */
  @IsOptional()
  @IsIn(['today', '3day', '5day', '10day'], {
    message: '排名周期必须是 today/3day/5day/10day',
  })
  indicator?: RankIndicator

  /** 只取数不落库 */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'dryRun 必须是布尔值' })
  dryRun?: boolean
}
