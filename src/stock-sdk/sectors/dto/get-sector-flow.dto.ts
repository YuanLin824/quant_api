import { IsIn, IsOptional, Matches } from 'class-validator'
import { DATE_PATTERN } from '../../dto/constants'
import type { SectorType } from '../sector-flow.service'

/** 查询板块资金流的查询参数 */
export class GetSectorFlowDto {
  /** 数据所属交易日；不传则返回最近一批 */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: '查询日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  date?: string

  /** 板块类型过滤（仅在传 date 时生效） */
  @IsOptional()
  @IsIn(['industry', 'concept', 'region'], {
    message: '板块类型必须是 industry/concept/region',
  })
  sectorType?: SectorType
}
