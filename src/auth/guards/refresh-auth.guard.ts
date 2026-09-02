import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { CONFIG_MODULES } from '../../config/constants'
import { IGlobalConfig } from '../../config/global.config'
import { AuthenticatedRequest, JwtPayload } from '../auth.types'

/**
 * Refresh Token 守卫（RefreshAuthGuard）
 *
 * 用 refresh 专属密钥（JWT_REFRESH_SECRET_KEY）验签——双密钥下验签成功即证明是
 * refresh 令牌；tokenType === 'refresh' 且必带 jti 的校验属纵深防御。
 * jti 白名单校验不在守卫做——轮换必须与"查白名单 → 删旧 → 写新"原子化，
 * 属业务状态管理，放 AuthService；守卫只负责"验签 + 类型判别"（纯认证）。
 */
@Injectable()
export class RefreshAuthGuard implements CanActivate {
  private readonly refreshSecretKey: string

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService
  ) {
    this.refreshSecretKey = configService.get<IGlobalConfig>(
      CONFIG_MODULES.GLOBAL
    )!.refreshSecretKey
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()

    const token = this.extractBearerToken(req)
    if (!token) {
      throw new UnauthorizedException('无效的刷新令牌')
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshSecretKey,
      })
      if (payload.tokenType !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('无效的刷新令牌')
      }
      req.user = payload
      return true
    } catch {
      throw new UnauthorizedException('无效的刷新令牌')
    }
  }

  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return null
    return header.slice('Bearer '.length)
  }
}
