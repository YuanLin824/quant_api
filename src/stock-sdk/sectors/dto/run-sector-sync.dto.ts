import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, Matches } from 'class-validator'
import { DATE_PATTERN } from '../../dto/constants'
import type { RankIndicator, SectorType } from '../sector-flow.service'

/** 手动触发板块资金流采集的请求体 */
export class RunSectorSyncDto {
  /** 数据所属交易日；不传则取最近一个已完成交易日 */
  @IsOptional()
  @Matches(DATE_PATTERN, { message: '数据日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  tradeDate?: string

  /** 板块类型，默认 industry */
  @IsOptional()
  @IsIn(['industry', 'concept', 'region'], {
    message: '板块类型必须是 industry/concept/region',
  })
  sectorType?: SectorType

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
