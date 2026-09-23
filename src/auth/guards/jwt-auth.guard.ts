import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { JwtPayload } from '../auth.types'
import { BaseJwtGuard } from './base-jwt.guard'

/**
 * Access Token 守卫（JwtAuthGuard）
 *
 * 用 access 专属密钥（JWT_ACCESS_SECRET_KEY）验签——双密钥下验签成功即证明是
 * access 令牌；tokenType === 'access' 的校验属纵深防御（两密钥误配相同时兜底）。
 * 通用流程见 BaseJwtGuard。
 */
@Injectable()
export class JwtAuthGuard extends BaseJwtGuard {
  constructor(jwtService: JwtService, configService: ConfigService) {
    super(jwtService, configService, {
      selectSecret: (config) => config.accessSecretKey,
      errorMessage: '访问令牌无效或已过期',
    })
  }

  protected isPayloadValid(payload: JwtPayload): boolean {
    return payload.tokenType === 'access'
  }
}
