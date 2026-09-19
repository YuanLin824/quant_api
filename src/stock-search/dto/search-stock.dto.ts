import { Transform, Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import {
  SEARCH_MARKETS,
  SEARCH_MAX_LIMIT,
  SEARCH_TYPES,
  type SearchMarket,
  type SearchType,
} from '../../westock-cli/westock-cli.constants'

/** 搜索证券的查询参数 */
export class SearchStockQueryDto {
  /** 搜索关键词 */
  @IsString({ message: '关键词必须是字符串' })
  @IsNotEmpty({ message: '关键词不能为空' })
  @MaxLength(50, { message: '关键词最长 50 个字符' })
  keyword!: string

  /**
   * 证券类型，**多个用逗号分隔**（如 `stock,bond`），不传则仅搜股票
   *
   * 多类型时上游**按类型分段**返回，故响应体是 `sections` 数组而非扁平行。
   */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' || Array.isArray(value)
      ? String(value)
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item !== '')
      : value
  )
  @IsIn(SEARCH_TYPES, {
    each: true,
    message: `type 必须是 ${SEARCH_TYPES.join('/')} 之一，多个用逗号分隔`,
  })
  type?: SearchType[]

  /**
   * 市场，不传则不限
   *
   * ⚠️ `jp`/`kr` 走的是**日韩股专用接口**，其输出形态与其余类型不同
   * （段标题与列都不一样），但与 `type` **组合时不会报错**——上游的 help 里写的
   * 「互斥」实测未被强制执行，故这里也不做互斥校验。
   */
  @IsOptional()
  @IsIn(SEARCH_MARKETS, { message: `market 必须是 ${SEARCH_MARKETS.join('/')} 之一` })
  market?: SearchMarket

  /** 返回条数，默认 10（上游默认） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 最小为 1' })
  @Max(SEARCH_MAX_LIMIT, { message: `limit 最大为 ${SEARCH_MAX_LIMIT}` })
  limit?: number

  /** 偏移量，用于翻页 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset 必须是整数' })
  @Min(0, { message: 'offset 不能为负' })
  offset?: number
}
