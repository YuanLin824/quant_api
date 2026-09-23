import { CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { CONFIG_MODULES } from '../../config/constants'
import { IGlobalConfig } from '../../config/global.config'
import { AuthenticatedRequest, JwtPayload } from '../auth.types'

/** 子类需提供的守卫参数 */
interface JwtGuardOptions {
  /** 从全局配置中选取本守卫使用的密钥（access / refresh 各取其一） */
  selectSecret: (config: IGlobalConfig) => string
  /** 校验失败时的统一消息（两个守卫文案不同，避免调用方混淆令牌用途） */
  errorMessage: string
}

/**
 * JWT 守卫基类
 *
 * 收口 access / refresh 两个守卫的共同流程：
 * 提取 Bearer 令牌 → 用本守卫专属密钥验签 → 校验载荷 → 挂载 req.user。
 * 双密钥方案下，验签成功本身即证明令牌类型（密钥不同）；子类的载荷校验属纵深防御，
 * 在两密钥被误配为相同值时兜底。
 *
 * 子类通过 super() 传入密钥选择器与错误消息——在构造期解析并缓存，避免每请求重复读配置；
 * 用选择器函数而非子类属性，是因为构造函数执行时子类字段尚未初始化。
 *
 * 安全约定：校验失败统一抛 401 且**不区分**过期/伪造/类型错误，避免向调用方泄露细节。
 */
export abstract class BaseJwtGuard implements CanActivate {
  /** 本守卫的验签密钥（构造期解析一次） */
  protected readonly secretKey: string

  /** 校验失败时的统一消息 */
  protected readonly errorMessage: string

  constructor(
    protected readonly jwtService: JwtService,
    configService: ConfigService,
    options: JwtGuardOptions
  ) {
    const config = configService.get<IGlobalConfig>(CONFIG_MODULES.GLOBAL)!
    this.secretKey = options.selectSecret(config)
    this.errorMessage = options.errorMessage
  }

  /** 载荷校验：令牌类型（+ 附加字段）是否满足本守卫要求 */
  protected abstract isPayloadValid(payload: JwtPayload): boolean

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()

    const token = this.extractBearerToken(req)
    if (!token) {
      throw new UnauthorizedException(this.errorMessage)
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.secretKey,
      })
      if (!this.isPayloadValid(payload)) {
        throw new UnauthorizedException(this.errorMessage)
      }
      req.user = payload
      return true
    } catch {
      throw new UnauthorizedException(this.errorMessage)
    }
  }

  /** 从 Authorization: Bearer <token> 提取令牌，格式不符返回 null */
  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return null
    return header.slice('Bearer '.length)
  }
}
