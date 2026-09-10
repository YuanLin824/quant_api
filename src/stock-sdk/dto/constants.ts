/**
 * stock-sdk DTO 共享的枚举与常量
 *
 * 独立成文件而非留在 get-kline.dto.ts：validators.ts 的组合装饰器需要引用这些定义，
 * 若仍留在 DTO 文件内会与「导入装饰器的 DTO」形成循环依赖。
 */

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
