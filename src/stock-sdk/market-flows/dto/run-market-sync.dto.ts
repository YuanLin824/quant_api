import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'

/**
 * 手动触发大盘资金流采集的请求体
 *
 * 无需指定日期——上游返回的是按日历史序列，日期取自数据本身。
 */
export class RunMarketSyncDto {
  /** 只取数不落库 */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'dryRun 必须是布尔值' })
  dryRun?: boolean
}
