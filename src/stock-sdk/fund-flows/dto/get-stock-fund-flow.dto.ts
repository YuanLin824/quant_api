import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator'
import { DATE_PATTERN } from '../../dto/constants'
import type { RankIndicator } from '../stock-fund-flow.service'

/** 查询个股资金流排名的查询参数 */
export class GetStockFundFlowDto {
  /** 数据所属交易日；不传则返回最近一批 */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: '查询日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  date?: string

  /** 排名周期过滤 */
  @IsOptional()
  @IsIn(['today', '3day', '5day', '10day'], {
    message: '排名周期必须是 today/3day/5day/10day',
  })
  indicator?: RankIndicator

  /** 页码，默认 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number

  /** 每页条数，默认 50，最大 200（单日数据为全市场个股，数千条） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须是整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(200, { message: 'pageSize 最大为 200' })
  pageSize?: number
}
