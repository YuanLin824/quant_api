/**
 * 日期工具
 *
 * 定时任务普遍需要「取上海时区当天日期」与「日期偏移」——容器时区多为 UTC，
 * 直接用本地时间会差一天。集中在此，避免各模块重复实现（时区问题隐蔽，
 * 分散实现容易只改一处）。
 */

/** 上海时区的当前日期 YYYY-MM-DD */
export function shanghaiDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(now)
}

/** 日期偏移 N 天（按 UTC 计算，避免时区干扰） */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 归一化 YYYYMMDD / YYYY-MM-DD → YYYY-MM-DD */
export function normalizeDate(value: string): string {
  const d = value.replace(/-/g, '')
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}
