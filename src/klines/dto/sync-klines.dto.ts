import { IsIn, IsOptional } from 'class-validator'
import type { KlineSyncMode } from '../klines.service'

/** 可选的同步模式 */
export const KLINE_SYNC_MODES = ['full', 'incremental'] as const

/** 手动触发日 K 线同步的请求体 */
export class SyncKlinesBodyDto {
  /**
   * 同步模式
   *
   * - `full`：回补近两年
   * - `incremental`：只补最新几根
   * - **不传**：表为空则全量，否则增量
   */
  @IsOptional()
  @IsIn(KLINE_SYNC_MODES, { message: `mode 必须是 ${KLINE_SYNC_MODES.join('/')}` })
  mode?: KlineSyncMode
}
