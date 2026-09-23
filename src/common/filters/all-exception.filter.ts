import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import requestIp from 'request-ip'
import { QueryFailedError } from 'typeorm'

const FALLBACK_DB_CODE = '__fallback__'

/**
 * PostgreSQL 错误码 → HTTP 状态码 & 中文消息
 *
 * Postgres 错误码分类：
 *   Class 23 — 完整性约束（唯一、外键、非空、检查）
 *   Class 22 — 数据异常（值超长、类型不匹配）
 *   Class 40 — 事务/死锁
 *
 * 将数据库底层错误翻译为前端可读的中文消息，避免暴露数据库细节
 */
const DB_ERROR_MAP: Record<string, { status: number; message: string }> = {
  // 完整性约束 (Class 23)
  '23505': { status: HttpStatus.CONFLICT, message: '数据已存在, 违反唯一约束' },
  '23503': { status: HttpStatus.BAD_REQUEST, message: '数据关联异常, 违反外键约束' },
  '23502': { status: HttpStatus.BAD_REQUEST, message: '必填字段缺失, 违反非空约束' },
  '23514': { status: HttpStatus.BAD_REQUEST, message: '数据校验失败, 违反检查约束' },
  '23506': { status: HttpStatus.CONFLICT, message: '违反排他约束' },
  // 数据异常 (Class 22)
  '22001': { status: HttpStatus.BAD_REQUEST, message: '字段值超出最大长度限制' },
  '22P02': { status: HttpStatus.BAD_REQUEST, message: '字段类型不匹配, 数据格式无效' },
  // 死锁 (Class 40)
  '40P01': { status: HttpStatus.CONFLICT, message: '检测到死锁, 请重试' },
  // 兜底
  [FALLBACK_DB_CODE]: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: '数据库操作异常' },
} as const

/**
 * 全局异常过滤器
 *
 * 统一处理三类异常：
 * 1. HttpException — NestJS 内置及自定义业务异常，直接提取状态码与消息
 * 2. QueryFailedError — TypeORM 数据库异常，通过 Postgres 错误码映射为友好中文提示
 * 3. 其他未知异常 — 兜底返回 500
 *
 * 所有异常均记录结构化日志（含客户端 IP、路径、方法、堆栈），
 * 响应格式统一为 { code, data, message }，失败时 data 恒为 null
 * （具体错误信息一律由 message 承载，不再嵌套进 data）
 */
@Catch()
export class AllExceptionsFilter<T> implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: T, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()
    const clientIp = requestIp.getClientIp(req)

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal Server Error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      message = this.extractMessage(exception)
    }

    // 将 Postgres 错误码翻译为可读的中文消息
    if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as {
        code?: string
        detail?: string
        table?: string
      }
      const pgCode = driverError?.code ?? FALLBACK_DB_CODE
      const mapping = DB_ERROR_MAP[pgCode] ?? DB_ERROR_MAP[FALLBACK_DB_CODE]
      status = mapping?.status
      message = mapping?.message
    }

    this.logger.error({
      clientIp,
      method: httpAdapter.getRequestMethod(req),
      path: httpAdapter.getRequestUrl(req),
      code: status,
      message: message,
      stack: exception,
      timestamp: new Date().toISOString(),
    })

    httpAdapter.reply(res, { code: status, data: null, message }, status)
  }

  /**
   * 提取异常消息
   *
   * ValidationPipe 抛出的 BadRequestException，其 response 形如
   * `{ message: ['字段错误1', ...], error, statusCode }`，而 `exception.message`
   * 只有固定的 `Bad Request Exception`。此处优先取 response.message 中的具体
   * 校验错误并拼接，保证调用方能定位到具体参数问题。
   */
  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse()

    if (typeof response === 'object' && response !== null) {
      const message = (response as { message?: unknown }).message
      if (Array.isArray(message) && message.length > 0) {
        return message.join('; ')
      }
    }

    return exception.message
  }
}
