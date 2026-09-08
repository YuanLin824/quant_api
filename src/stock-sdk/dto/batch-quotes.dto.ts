import { Transform, Type } from 'class-transformer'
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Market } from '../stock-sdk.types'

/** 获取全部行情路径参数 DTO */
export class GetAllQuotesParamsDto {
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(Market, { message: '市场类型必须是 cn/hk/us' })
  market!: Market
}

/** 获取全部行情查询参数 DTO */
export class GetAllQuotesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'batchSize 必须是整数' })
  @Min(1, { message: 'batchSize 最小为 1' })
  @Max(1000, { message: 'batchSize 最大为 1000' })
  batchSize?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'concurrency 必须是整数' })
  @Min(1, { message: 'concurrency 最小为 1' })
  @Max(20, { message: 'concurrency 最大为 20' })
  concurrency?: number
}

/** 按代码批量获取行情 DTO */
export class BatchByCodesDto {
  @IsArray({ message: '股票代码必须是数组' })
  @IsString({ each: true, message: '股票代码必须是字符串' })
  codes!: string[]

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'batchSize 必须是整数' })
  @Min(1, { message: 'batchSize 最小为 1' })
  @Max(1000, { message: 'batchSize 最大为 1000' })
  batchSize?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'concurrency 必须是整数' })
  @Min(1, { message: 'concurrency 最小为 1' })
  @Max(20, { message: 'concurrency 最大为 20' })
  concurrency?: number
}
