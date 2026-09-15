/** 定时采集大盘资金流的 cron 表达式（6 字段含秒）：每天 16:30:00（A 股收盘后） */
export const MARKET_FUND_FLOW_SYNC_CRON = '0 30 16 * * *'

/** 定时任务名称 */
export const MARKET_FUND_FLOW_SYNC_JOB_NAME = 'market-fund-flow-sync'

/**
 * 定时任务时区——不可省：容器多为 UTC，
 * 不指定会与北京时间的「下午 4 点半」相差 8 小时
 */
export const MARKET_FUND_FLOW_TIMEZONE = 'Asia/Shanghai'

/** 数据保留天数（按数据自带日期计） */
export const RETENTION_DAYS = 30
