import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator'
import {
  THS_ADJUST_TYPES,
  THS_KLINE_INTERVALS,
  type ThsAdjustType,
  type ThsKlineInterval,
} from '../api-ths.constants'

/**
 * 历史 K 线查询参数
 *
 * 上游接口层强约束：**每次请求仅一个 thscode**（不接受逗号），且 `start` / `end` 均为必填毫秒时间戳。
 */
export class HistoricalKlineQueryDto {
  /** 标的 thscode，单只（如 `600519.SH`） */
  @IsString({ message: '标的代码必须是字符串' })
  @IsNotEmpty({ message: '标的代码不能为空' })
  @Matches(/^[^,]+$/, { message: '标的代码只能是单只，不能含逗号' })
  thscode!: string

  /** 起始时间（毫秒 Unix 时间戳） */
  @IsInt({ message: '起始时间必须是毫秒时间戳' })
  @Min(0, { message: '起始时间不能为负数' })
  start!: number

  /** 结束时间（毫秒 Unix 时间戳） */
  @IsInt({ message: '结束时间必须是毫秒时间戳' })
  @Min(0, { message: '结束时间不能为负数' })
  end!: number

  /** K 线周期（上游当前仅支持 `1d`） */
  @IsOptional()
  @IsIn(THS_KLINE_INTERVALS, { message: 'K 线周期不在支持范围内' })
  interval?: ThsKlineInterval

  /** 复权方式，默认 `none`（不复权，取原始价格） */
  @IsOptional()
  @IsIn(THS_ADJUST_TYPES, { message: '复权方式不在支持范围内' })
  adjust?: ThsAdjustType
}
