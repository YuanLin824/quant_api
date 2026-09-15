/** 定时采集个股资金流排名的 cron 表达式（6 字段含秒）：每天 16:00:00（A 股收盘后） */
export const STOCK_FUND_FLOW_SYNC_CRON = '0 0 16 * * *'

/** 定时任务名称 */
export const STOCK_FUND_FLOW_SYNC_JOB_NAME = 'stock-fund-flow-sync'

/**
 * 定时任务时区——不可省：容器多为 UTC，
 * 不指定会与北京时间的「下午 4 点」相差 8 小时
 */
export const STOCK_FUND_FLOW_TIMEZONE = 'Asia/Shanghai'

/** 默认排名周期（当日资金流） */
export const DEFAULT_INDICATOR = 'today'

/** 数据保留天数（按数据所属交易日计） */
export const RETENTION_DAYS = 30

/**
 * 批量插入的分片大小
 *
 * 本任务单日数据量为全市场个股（数千条），逐条 save 会生成数千次 SQL，
 * 故用 insert 分批写入。每行约 19 个参数，1000 行远低于 PG 的 65535 参数上限。
 */
export const INSERT_BATCH_SIZE = 1000
