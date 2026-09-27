import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import type { ThsAssetType } from '../../api-ths/api-ths.constants'
import {
  STOCK_SYMBOLS_ASSET_TYPES,
  STOCK_SYMBOLS_QUERY_MAX_PAGE_SIZE,
} from '../stock-symbols.constants'

/**
 * 标的代码表查询参数
 *
 * 注意：全局 ValidationPipe 未开启 `enableImplicitConversion`，query 参数进到本类时
 * 一律是字符串，数字与布尔字段必须显式转换，否则校验必然失败。
 */
export class StockSymbolQueryDto {
  /** 资产类型过滤，省略时返回全部类型 */
  @IsOptional()
  @IsIn(STOCK_SYMBOLS_ASSET_TYPES, { message: '资产类型不在支持范围内' })
  assetType?: ThsAssetType

  /** 关键词，对 thscode 或 name 模糊匹配 */
  @IsOptional()
  @IsString({ message: '关键词必须是字符串' })
  @MaxLength(32, { message: '关键词长度不能超过 32 位' })
  keyword?: string

  /**
   * 是否包含已退市标的（默认 false）
   *
   * 这里**不能**用 `@Type(() => Boolean)`：非空字符串恒为 truthy，
   * `?includeDelisted=false` 会被转成 `true`。改为显式映射，非法值原样返回交给 `@IsBoolean` 报错。
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return value
  })
  @IsBoolean({ message: '是否包含已退市必须是布尔值' })
  includeDelisted?: boolean

  /** 页码，从 1 开始 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为 1' })
  page?: number

  /** 每页条数（默认 20，上限 100） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页条数必须是整数' })
  @Min(1, { message: '每页条数至少为 1' })
  @Max(STOCK_SYMBOLS_QUERY_MAX_PAGE_SIZE, {
    message: `每页条数不能超过 ${STOCK_SYMBOLS_QUERY_MAX_PAGE_SIZE}`,
  })
  pageSize?: number
}
