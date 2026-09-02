import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { RedisService } from '../../database/redis.service'

/** 速率限制装饰器元数据键 */
export const RATE_LIMIT_KEY = 'rateLimit'

/** 速率限制选项 */
export interface RateLimitOptions {
  /** 时间窗口（秒） */
  ttl: number
  /** 窗口内最大请求次数 */
  limit: number
  /** 自定义限流键生成器（默认使用 IP） */
  keyGenerator?: (req: Request) => string
}

/** 速率限制装饰器 */
export const RateLimit = (options: RateLimitOptions) => Reflect.metadata(RATE_LIMIT_KEY, options)

/**
 * 速率限制守卫：基于 Redis 计数器实现滑动窗口限流
 *
 * 使用示例：
 * @RateLimit({ ttl: 900, limit: 5 }) // 15分钟内最多5次
 * @Post('login')
 * async login() { ... }
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler())

    if (!options) {
      return true // 无限流配置，直接放行
    }

    const request = context.switchToHttp().getRequest<Request>()
    const key = options.keyGenerator ? options.keyGenerator(request) : this.getDefaultKey(request)

    const redisKey = `rate_limit:${key}`
    const client = this.redisService.getClient()

    // 使用 Redis INCR + EXPIRE 实现计数器
    const count = await client.incr(redisKey)

    if (count === 1) {
      // 首次请求，设置过期时间
      await client.expire(redisKey, options.ttl)
    }

    if (count > options.limit) {
      const ttl = await client.ttl(redisKey)
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `请求过于频繁，请在 ${ttl} 秒后重试`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS
      )
    }

    return true
  }

  /** 默认限流键：IP + 路由路径 */
  private getDefaultKey(req: Request): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const path = req.route?.path || req.path
    return `${ip}:${path}`
  }
}
