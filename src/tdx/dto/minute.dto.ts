import { IsNotEmpty, IsString, Matches } from 'class-validator'

/** 分时接口的路径参数 */
export class GetMinuteParamsDto {
  /** 股票代码，如 600036 或 sh600036 */
  @IsString({ message: '股票代码必须是字符串' })
  @IsNotEmpty({ message: '股票代码不能为空' })
  code!: string
}

/** 历史分时的查询参数 */
export class GetHistoryMinuteQueryDto {
  /** 交易日期，格式 YYYYMMDD */
  @Matches(/^\d{8}$/, { message: '日期必须是 YYYYMMDD 格式' })
  date!: string
}
