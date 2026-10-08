import { Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator'
import {
  STOCK_KLINE_CATEGORIES,
  STOCK_KLINE_QUERY_MAX_PAGE_SIZE,
  type StockKlineCategory,
} from '../stock-kline.constants'

/**
 * K 线查询参数
 *
 * 注意：全局 ValidationPipe 未开启 `enableImplicitConversion`，query 参数进到本类时
 * 一律是字符串，数字字段必须显式转换，否则校验必然失败。
 */
export class StockKlineQueryDto {
  /** 标的 thscode（如 600519.SH） */
  @IsString({ message: '标的代码必须是字符串' })
  @IsNotEmpty({ message: '标的代码不能为空' })
  thscode!: string

  /** K 线周期，默认 day（日 K） */
  @IsOptional()
  @IsIn(STOCK_KLINE_CATEGORIES, { message: 'K 线周期不在支持范围内' })
  category?: StockKlineCategory

  /** 起始日期（yyyyMMdd，含端点）；省略则不过滤该侧 */
  @IsOptional()
  @Matches(/^\d{8}$/, { message: '起始日期必须是 yyyyMMdd 格式' })
  start?: string

  /** 结束日期（yyyyMMdd，含端点）；省略则不过滤该侧 */
  @IsOptional()
  @Matches(/^\d{8}$/, { message: '结束日期必须是 yyyyMMdd 格式' })
  end?: string

  /** 页码，从 1 开始 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为 1' })
  page?: number

  /** 每页条数（默认 500，上限 2000） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页条数必须是整数' })
  @Min(1, { message: '每页条数至少为 1' })
  @Max(STOCK_KLINE_QUERY_MAX_PAGE_SIZE, {
    message: `每页条数不能超过 ${STOCK_KLINE_QUERY_MAX_PAGE_SIZE}`,
  })
  pageSize?: number
}
