import { utilities, WinstonModule } from 'nest-winston'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { IS_PROD } from './constants'

/** 生产环境：按小时轮转的日志文件，压缩归档，自动清理 14 天前的日志 */
const PROD_OPTS = {
  dirname: 'logger_prod',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    utilities.format.nestLike('NestApp', { prettyPrint: true, colors: false })
  ),
} as const

/** 开发环境：彩色控制台输出 */
const DEV_OPTS = {
  format: winston.format.combine(winston.format.timestamp(), utilities.format.nestLike(undefined)),
} as const

// winston 日志等级
// {
//   error: 0,
//   warn: 1,
//   info: 2,
//   http: 3,
//   verbose: 4,
//   debug: 5,
//   silly: 6
// }

/**
 * 创建 NestJS 兼容的 Winston Logger 实例
 *
 * 供 NestFactory.create 使用，替换 NestJS 默认的控制台 Logger。
 * 生产环境按等级分别输出到 info/warn/error 三个文件（均按小时轮转），
 * 开发环境输出到控制台（level: warn）。
 */
export const WINSTON_LOGGER = WinstonModule.createLogger({
  transports: IS_PROD
    ? [
        new DailyRotateFile({ level: 'info', filename: '%DATE%.info.log', ...PROD_OPTS }),
        new DailyRotateFile({ level: 'warn', filename: '%DATE%.warn.log', ...PROD_OPTS }),
        new DailyRotateFile({ level: 'error', filename: '%DATE%.error.log', ...PROD_OPTS }),
      ]
    : [new winston.transports.Console({ level: 'info', ...DEV_OPTS })],
})
