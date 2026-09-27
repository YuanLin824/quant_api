import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'
import { THS_ASSET_TYPES, THS_TICKER_LIST_MAX_LIMIT, type ThsAssetType } from '../api-ths.constants'

/** 标的列表查询参数 */
export class TickerListQueryDto {
  /** 规范化资产类型，支持单值或数组（数组在 service 内拼成上游要求的逗号分隔格式）；省略时返回全部类型 */
  @IsOptional()
  @IsIn(THS_ASSET_TYPES, { each: true, message: '资产类型不在支持范围内' })
  assetType?: ThsAssetType | ThsAssetType[]

  /** 单页条数（默认 1000，上限 10000） */
  @IsOptional()
  @IsInt({ message: '单页条数必须是整数' })
  @Min(1, { message: '单页条数至少为 1' })
  @Max(THS_TICKER_LIST_MAX_LIMIT, { message: `单页条数不能超过 ${THS_TICKER_LIST_MAX_LIMIT}` })
  limit?: number

  /** 分页偏移（默认 0） */
  @IsOptional()
  @IsInt({ message: '分页偏移必须是整数' })
  @Min(0, { message: '分页偏移不能为负数' })
  offset?: number
}
