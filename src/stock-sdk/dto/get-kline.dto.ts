import { Transform } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
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

/** 获取K线数据路径参数 DTO */
export class GetKlineParamsDto {
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(Market, { message: '市场类型必须是 cn/hk/us' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 获取历史K线查询参数 DTO */
export class GetKlineQueryDto {
  @IsOptional()
  @IsEnum(KlinePeriod, { message: 'K线周期必须是 daily/weekly/monthly' })
  period?: KlinePeriod

  @IsOptional()
  @IsEnum(AdjustType, { message: '复权类型必须是 qfq/hfq/空字符串' })
  adjust?: AdjustType

  @IsOptional()
  @IsString({ message: '开始日期必须是字符串' })
  startDate?: string

  @IsOptional()
  @IsString({ message: '结束日期必须是字符串' })
  endDate?: string
}

/** 获取分钟K线查询参数 DTO */
export class GetMinuteKlineQueryDto {
  @IsOptional()
  @IsEnum(MinuteKlinePeriod, { message: '分钟K线周期必须是 1/5/15/30/60' })
  period?: MinuteKlinePeriod

  @IsOptional()
  @IsEnum(AdjustType, { message: '复权类型必须是 qfq/hfq/空字符串' })
  adjust?: AdjustType

  @IsOptional()
  @IsString({ message: '开始日期必须是字符串' })
  startDate?: string

  @IsOptional()
  @IsString({ message: '结束日期必须是字符串' })
  endDate?: string
}
