import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import requestIp from 'request-ip'
import { AuthService } from './auth.service'
import type { AuthenticatedRequest } from './auth.types'
import { ChangePasswordDto } from './dto/change-password.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { RegisterDto } from './dto/register.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RefreshAuthGuard } from './guards/refresh-auth.guard'

/**
 * 认证控制器
 *
 * 响应统一 { code, data, message } 包络（与 AppController 一致）。
 * refresh 的令牌经 RefreshAuthGuard 从 Authorization: Bearer 提取并验签，
 * 请求体无需再携带；logout 用 decode() 不验签，仅需 body 的 refreshToken。
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 每小时最多 5 次注册
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto)
    return { code: 201, message: '注册成功', data }
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 600000 } }) // 每 10 分钟最多 10 次登录
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const data = await this.authService.login(dto, this.extractDevice(req))
    return { code: 200, message: '登录成功', data }
  }

  @Post('refresh')
  @UseGuards(RefreshAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 600000 } }) // 每 10 分钟最多 20 次刷新
  async refresh(@Req() req: AuthenticatedRequest) {
    const data = await this.authService.refresh(req.user, this.extractDevice(req))
    return { code: 200, message: '刷新成功', data }
  }

  @Post('logout')
  @SkipThrottle() // 登出操作不限流
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken)
    return { code: 200, message: '登出成功', data: null }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@Req() req: AuthenticatedRequest) {
    const data = await this.authService.getProfile(req.user.sub)
    return { code: 200, message: '获取成功', data }
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 每小时最多 5 次修改密码
  async changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(req.user.sub, dto.oldPassword, dto.newPassword)
    return { code: 200, message: '密码修改成功，请重新登录', data: null }
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // 登出操作不限流
  async logoutAll(@Req() req: AuthenticatedRequest) {
    await this.authService.logoutAll(req.user.sub)
    return { code: 200, message: '已登出所有设备', data: null }
  }

  /** 提取设备信息（IP 来源与全局过滤器/日志中间件一致） */
  private extractDevice(req: Request) {
    return {
      userAgent: req.headers['user-agent'] ?? '',
      ip: requestIp.getClientIp(req) ?? '',
    }
  }
}
