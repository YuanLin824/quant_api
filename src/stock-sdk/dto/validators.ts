import { applyDecorators } from '@nestjs/common'
import { Transform, Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Matches, Max, Min } from 'class-validator'
import { CodesMarket, Market } from '../stock-sdk.types'
import { AdjustType, DATE_PATTERN } from './constants'

/**
 * stock-sdk DTO 的组合校验装饰器
 *
 * 把多个 DTO 中重复出现的校验组合收口到一个具名装饰器，
 * 避免「大小写归一化」「可选日期格式」等约束在各处写法漂移。
 * 错误消息与原实现逐字一致，故 API 行为不变。
 */

/** 市场路径参数（cn/hk/us），大小写不敏感并统一归一化为小写 */
export function IsSdkMarket() {
  return applyDecorators(
    Transform(({ value }) => value?.toLowerCase()),
    IsEnum(Market, { message: '市场类型必须是 cn/hk/us' })
  )
}

/** 代码列表市场路径参数（cn/hk/us/fund），大小写不敏感并统一归一化为小写 */
export function IsCodesMarket() {
  return applyDecorators(
    Transform(({ value }) => value?.toLowerCase()),
    IsEnum(CodesMarket, { message: '市场类型必须是 cn/hk/us/fund' })
  )
}

/** 复权类型（可选）：qfq 前复权 / hfq 后复权 / 空字符串不复权 */
export function IsAdjustType() {
  return applyDecorators(
    IsOptional(),
    IsEnum(AdjustType, { message: '复权类型必须是 qfq/hfq/空字符串' })
  )
}

/** K线日期参数（可选）：YYYYMMDD 或 YYYY-MM-DD */
export function IsKlineDate(label: '开始日期' | '结束日期') {
  return applyDecorators(
    IsOptional(),
    Matches(DATE_PATTERN, { message: `${label}必须是 YYYYMMDD 或 YYYY-MM-DD 格式` })
  )
}

/** 单次请求的股票数量（可选，1-1000） */
export function IsBatchSize() {
  return applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsInt({ message: 'batchSize 必须是整数' }),
    Min(1, { message: 'batchSize 最小为 1' }),
    Max(1000, { message: 'batchSize 最大为 1000' })
  )
}

/** 最大并发请求数（可选，1-20） */
export function IsConcurrency() {
  return applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsInt({ message: 'concurrency 必须是整数' }),
    Min(1, { message: 'concurrency 最小为 1' }),
    Max(20, { message: 'concurrency 最大为 20' })
  )
}
