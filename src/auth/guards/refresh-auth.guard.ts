import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { JwtPayload } from '../auth.types'
import { BaseJwtGuard } from './base-jwt.guard'

/**
 * Refresh Token 守卫（RefreshAuthGuard）
 *
 * 用 refresh 专属密钥（JWT_REFRESH_SECRET_KEY）验签——双密钥下验签成功即证明是
 * refresh 令牌；tokenType === 'refresh' 且必带 jti 的校验属纵深防御。
 * jti 白名单校验不在守卫做——轮换必须与"查白名单 → 删旧 → 写新"原子化，
 * 属业务状态管理，放 AuthService；守卫只负责"验签 + 类型判别"（纯认证）。
 */
@Injectable()
export class RefreshAuthGuard extends BaseJwtGuard {
  constructor(jwtService: JwtService, configService: ConfigService) {
    super(jwtService, configService, {
      selectSecret: (config) => config.refreshSecretKey,
      errorMessage: '无效的刷新令牌',
    })
  }

  protected isPayloadValid(payload: JwtPayload): boolean {
    return payload.tokenType === 'refresh' && !!payload.jti
  }
}
