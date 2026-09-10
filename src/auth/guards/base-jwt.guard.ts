import { CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { CONFIG_MODULES } from '../../config/constants'
import { IGlobalConfig } from '../../config/global.config'
import { AuthenticatedRequest, JwtPayload } from '../auth.types'

/**
 * JWT 守卫基类
 *
 * 收口 access / refresh 两个守卫的共同流程：
 * 提取 Bearer 令牌 → 用本守卫专属密钥验签 → 校验载荷 → 挂载 req.user。
 * 双密钥方案下，验签成功本身即证明令牌类型（密钥不同）；子类的载荷校验属纵深防御，
 * 在两密钥被误配为相同值时兜底。
 *
 * 子类只需提供三件事：密钥来源、错误消息、载荷校验规则。
 *
 * 安全约定：校验失败统一抛 401 且**不区分**过期/伪造/类型错误，避免向调用方泄露细节。
 */
export abstract class BaseJwtGuard implements CanActivate {
  constructor(
    protected readonly jwtService: JwtService,
    protected readonly configService: ConfigService
  ) {}

  /** 本守卫使用的验签密钥（access / refresh 各取其一） */
  protected abstract getSecretKey(config: IGlobalConfig): string

  /** 校验失败时的统一消息（两个守卫文案不同，避免调用方混淆令牌用途） */
  protected abstract getErrorMessage(): string

  /** 载荷校验：令牌类型（+ 附加字段）是否满足本守卫要求 */
  protected abstract isPayloadValid(payload: JwtPayload): boolean

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const message = this.getErrorMessage()

    const token = this.extractBearerToken(req)
    if (!token) {
      throw new UnauthorizedException(message)
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getSecretKey(this.configService.get<IGlobalConfig>(CONFIG_MODULES.GLOBAL)!),
      })
      if (!this.isPayloadValid(payload)) {
        throw new UnauthorizedException(message)
      }
      req.user = payload
      return true
    } catch {
      throw new UnauthorizedException(message)
    }
  }

  /** 从 Authorization: Bearer <token> 提取令牌，格式不符返回 null */
  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return null
    return header.slice('Bearer '.length)
  }
}
