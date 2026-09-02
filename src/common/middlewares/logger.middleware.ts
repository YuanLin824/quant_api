import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { NextFunction, Request, Response } from 'express'
import requestIp from 'request-ip'

/** 敏感字段名单：日志中打码，避免密码/令牌等凭证明文落盘 */
const SENSITIVE_FIELDS = ['password', 'oldPassword', 'newPassword', 'refreshToken']

/** 递归脱敏：敏感字段替换为 '***'（数组/嵌套对象一并处理） */
function sanitize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sanitize)
  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_FIELDS.includes(key) ? '***' : sanitize(val)
  }
  return sanitized
}

/**
 * API 请求日志中间件
 *
 * 记录所有 API 请求的入参（IP、方法、路径、Body、Params、Query），
 * 用于安全审计和问题排查。Body 中的密码字段（password/oldPassword/newPassword）
 * 统一打码，防止 change-password 等接口的凭证明文进入日志文件。
 *
 * 关键设计：日志写入采用“发射后不管”（fire-and-forget）策略——
 * 不等待日志落盘完成，失败仅 log.error，不阻塞请求响应。
 * 这是为了避免日志写入（文件/控制台 I/O）延迟影响 API 响应时间。
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const { httpAdapter } = this.httpAdapterHost

    // 异步写入日志，不 await——即使日志写入失败也不影响正常请求
    this.logger.log({
      clientIp: requestIp.getClientIp(req) ?? 'unknown',
      method: httpAdapter.getRequestMethod(req).toLocaleUpperCase(),
      path: httpAdapter.getRequestUrl(req),
      body: sanitize(req.body ?? {}),
      params: sanitize(req.params ?? {}),
      query: sanitize(req.query ?? {}),
    })

    next()
  }
}
