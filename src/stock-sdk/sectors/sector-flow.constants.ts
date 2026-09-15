/** 定时采集板块资金流的 cron 表达式（6 字段含秒）：每天 17:00:00（A 股收盘后） */
export const SECTOR_FLOW_SYNC_CRON = '0 0 17 * * *'

/** 定时任务名称 */
export const SECTOR_FLOW_SYNC_JOB_NAME = 'sector-fund-flow-sync'

/**
 * 定时任务时区——不可省：容器多为 UTC，
 * 不指定会与北京时间的「下午 5 点」相差 8 小时
 */
export const SECTOR_FLOW_TIMEZONE = 'Asia/Shanghai'

/** 默认采集的板块类型（行业板块） */
export const DEFAULT_SECTOR_TYPE = 'industry'

/** 默认排名周期（当日资金流） */
export const DEFAULT_INDICATOR = 'today'

/** 数据保留天数（按数据所属交易日计） */
export const RETENTION_DAYS = 30
