import type { Request } from 'express'

/**
 * JWT payload 结构
 *
 * 双密钥方案下，验签密钥（JWT_SECRET_KEY / JWT_REFRESH_SECRET_KEY）本身即区分令牌类型，
 * tokenType 保留作纵深防御：两密钥误配为相同值时它是唯一防线，兼 payload 自文档化。
 * access 无 jti（无状态），refresh 必带 jti（服务端白名单吊销依据）。
 */
export interface JwtPayload {
  /** 用户 ID（User.id） */
  sub: string
  username: string
  tokenType: 'access' | 'refresh'
  /** refresh token 唯一标识（设备会话 ID），仅 refresh 携带 */
  jti?: string
}

/**
 * 携带 JWT 载荷的请求：守卫验签通过后挂载 req.user
 *
 * 供守卫与控制器统一标注类型，避免各处重复写 Request & { user: JwtPayload }。
 */
export type AuthenticatedRequest = Request & { user: JwtPayload }

/** 设备信息：多设备控制时随会话记录，用于展示与淘汰策略 */
export interface DeviceInfo {
  userAgent: string
  ip: string
  loginAt: number
  /** 会话过期时间（毫秒时间戳），惰性清理依据 */
  expiresAt: number
}

/** auth 相关接口的返回体 */
export interface TokenResult {
  accessToken: string
  refreshToken: string
}
