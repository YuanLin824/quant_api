/** 定时同步标的代码任务的 cron 表达式（6 字段含秒）：每天 09:00:00（开盘前） */
export const STOCK_SYMBOL_SYNC_CRON = '0 0 9 * * *'

/** 定时任务名称 */
export const STOCK_SYMBOL_SYNC_JOB_NAME = 'stock-symbol-sync'

/**
 * 定时任务时区——不可省：容器多为 UTC，
 * 不指定会与北京时间的「早上 9 点」相差 8 小时
 */
export const STOCK_SYMBOL_TIMEZONE = 'Asia/Shanghai'

/**
 * 单次批量插入的行数
 *
 * PostgreSQL 单语句参数上限为 65535，每行仅 2 个参数，1000 行远低于上限；
 * 分批同时也避免单条 SQL 过大。
 */
export const INSERT_BATCH_SIZE = 1000
