import { Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import {
  TDX_KLINE_CATEGORIES,
  TDX_KLINE_MAX_COUNT,
  type TdxKlineCategory,
} from '../api-tdx.constants'

/**
 * K 线查询参数
 *
 * 注意：本模块无 controller，DTO 不会被全局 ValidationPipe 自动校验，
 * 由 `ApiTdxService` 在入口显式触发（见其 `assertValidDto`）。
 */
export class TdxKlineQueryDto {
  /** 标的 thscode，单只（如 `600519.SH`） */
  @IsString({ message: '标的代码必须是字符串' })
  @IsNotEmpty({ message: '标的代码不能为空' })
  thscode!: string

  /** K 线周期，默认 `day`（日线） */
  @IsOptional()
  @IsIn(TDX_KLINE_CATEGORIES, { message: 'K 线周期不在支持范围内' })
  category?: TdxKlineCategory

  /** 取最近的 N 根（默认 100，上限 800） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'K 线根数必须是整数' })
  @Min(1, { message: 'K 线根数至少为 1' })
  @Max(TDX_KLINE_MAX_COUNT, { message: `K 线根数不能超过 ${TDX_KLINE_MAX_COUNT}` })
  count?: number
}
