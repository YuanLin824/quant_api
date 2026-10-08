/**
 * 交易日历同步的 cron 表达式：每天凌晨 3 点
 *
 * 选此刻是因为上游日历此时已更新完毕，且系统负载最低。
 * 日历是「每天最多新增一天」的数据，所以每天同步一次绰绰有余，无需限定工作日
 * （非交易日同步结果不变，无副作用）。
 *
 * ⚠️ cron 表达式与时区必须是**模块常量**，不可改为读 `process.env`：
 * `@Cron` 在装饰器求值期（模块 import 时）取参，而 `.env` 要到 `ConfigModule.forRoot()`
 * 执行时才写入 `process.env`，用 `process.env.XXX` 会静默拿到 `undefined`。
 */
export const STOCK_TRADING_DAYS_SYNC_CRON = '0 3 * * *'

/** 交易日历同步时区（cron 按此时区解释） */
export const STOCK_TRADING_DAYS_SYNC_TIMEZONE = 'Asia/Shanghai'
