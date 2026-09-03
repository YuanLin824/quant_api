import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

/** 股票市场类型 */
export enum Market {
  /** 上海交易所 */
  SH = 'SH',
  /** 深圳交易所 */
  SZ = 'SZ',
  /** 香港市场 */
  HK = 'HK',
  /** 美国市场 */
  US = 'US',
}

/** K线周期 */
export enum KlinePeriod {
  /** 日K */
  DAY = 'day',
  /** 周K */
  WEEK = 'week',
  /** 月K */
  MONTH = 'month',
}

/** 获取股票行情 DTO */
export class GetStockDto {
  @IsEnum(Market, { message: '市场类型必须是 SH/SZ/HK/US' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 批量获取股票行情 DTO */
export class GetStocksDto {
  @IsString({ each: true, message: '股票代码必须是字符串数组' })
  @IsNotEmpty({ each: true, message: '股票代码不能为空' })
  codes!: string[]
}

/** 获取K线数据 DTO */
export class GetKlinesDto {
  @IsEnum(Market, { message: '市场类型必须是 SH/SZ/HK/US' })
  market!: Market

  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string

  @IsOptional()
  @IsEnum(KlinePeriod, { message: 'K线周期必须是 day/week/month' })
  period?: KlinePeriod

  @IsOptional()
  count?: number
}

/** 搜索股票 DTO */
export class SearchStocksDto {
  @IsString({ message: '关键词必须是字符串' })
  @IsNotEmpty({ message: '关键词不能为空' })
  keyword!: string
}

/** 股票行情响应 */
export interface StockQuote {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 当前价格 */
  now: number
  /** 涨跌幅 (0.01 = 1%) */
  percent: number
  /** 最低价 */
  low: number
  /** 最高价 */
  high: number
  /** 昨收价 */
  yesterday: number
  /** 数据源 */
  source?: string
}

/** K线数据响应 */
export interface KlineData {
  /** 日期 */
  date: string
  /** 开盘价 */
  open: number
  /** 收盘价 */
  close: number
  /** 最高价 */
  high: number
  /** 最低价 */
  low: number
  /** 成交量 */
  volume?: number
  /** 数据源 */
  source?: string
}
