import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator'
import type { IndicatorOptions } from 'stock-sdk'
import { Market } from '../stock-sdk.types'

/** K线周期 */
export enum KlinePeriod {
  /** 日K */
  DAILY = 'daily',
  /** 周K */
  WEEKLY = 'weekly',
  /** 月K */
  MONTHLY = 'monthly',
}

/** 分钟K线周期 */
export enum MinuteKlinePeriod {
  /** 1分钟 */
  M1 = '1',
  /** 5分钟 */
  M5 = '5',
  /** 15分钟 */
  M15 = '15',
  /** 30分钟 */
  M30 = '30',
  /** 60分钟 */
  M60 = '60',
}

/** 复权类型 */
export enum AdjustType {
  /** 前复权 */
  QFQ = 'qfq',
  /** 后复权 */
  HFQ = 'hfq',
  /** 不复权 */
  NONE = '',
}

/** K线周期枚举值集合（历史K线 + 分钟K线） */
export const KLINE_PERIODS = [...Object.values(KlinePeriod), ...Object.values(MinuteKlinePeriod)]

/** 日期格式正则：YYYYMMDD 或 YYYY-MM-DD */
export const DATE_PATTERN = /^\d{4}-?\d{2}-?\d{2}$/

/** 获取K线数据路径参数 DTO */
export class GetKlineParamsDto {
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(Market, { message: '市场类型必须是 cn/hk/us' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 获取K线数据查询参数 DTO */
export class GetKlineQueryDto {
  @IsOptional()
  @IsIn(KLINE_PERIODS, {
    message: 'K线周期必须是 daily/weekly/monthly 或 1/5/15/30/60',
  })
  period?: string

  @IsOptional()
  @IsEnum(AdjustType, { message: '复权类型必须是 qfq/hfq/空字符串' })
  adjust?: AdjustType

  @IsOptional()
  @Matches(DATE_PATTERN, { message: '开始日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  startDate?: string

  @IsOptional()
  @Matches(DATE_PATTERN, { message: '结束日期必须是 YYYYMMDD 或 YYYY-MM-DD 格式' })
  endDate?: string

  @IsOptional()
  @IsObject({ message: 'indicators 必须是对象' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return {}
      }
    }
    return value ?? {}
  })
  indicators?: IndicatorOptions
}
