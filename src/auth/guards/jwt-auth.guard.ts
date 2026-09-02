import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { CONFIG_MODULES } from '../../config/constants'
import { IGlobalConfig } from '../../config/global.config'
import { AuthenticatedRequest, JwtPayload } from '../auth.types'

/**
 * Access Token 守卫（JwtAuthGuard）
 *
 * 从 Authorization: Bearer <token> 提取令牌，用 access 专属密钥（JWT_SECRET_KEY）
 * 验签——双密钥下验签成功即证明是 access 令牌；tokenType === 'access' 的校验
 * 属纵深防御（两密钥误配相同时兜底）。
 * 通过后把 payload 挂到 req.user，供控制器/服务取用。
 *
 * 校验失败统一返回 401（不区分过期/伪造/类型错误，避免泄露细节）。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecretKey: string

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService
  ) {
    this.accessSecretKey = configService.get<IGlobalConfig>(CONFIG_MODULES.GLOBAL)!.accessSecretKey
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()

    const token = this.extractBearerToken(req)
    if (!token) {
      throw new UnauthorizedException('访问令牌无效或已过期')
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.accessSecretKey,
      })
      if (payload.tokenType !== 'access') {
        throw new UnauthorizedException('访问令牌无效或已过期')
      }
      req.user = payload
      return true
    } catch {
      throw new UnauthorizedException('访问令牌无效或已过期')
    }
  }

  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return null
    return header.slice('Bearer '.length)
  }
}
