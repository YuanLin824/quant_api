import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { Users } from './entities/users.entity'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RefreshAuthGuard } from './guards/refresh-auth.guard'

/**
 * 认证模块
 *
 * 双密钥方案：access 用 JWT_SECRET_KEY、refresh 用 JWT_REFRESH_SECRET_KEY。
 * JwtModule 不注册默认 secret——service 签发与 guard 验签均显式传入各自密钥，
 * 避免误用（如用 access 密钥签发 refresh）。JwtService 注册为 global 供全局注入；
 * 但使用 JwtAuthGuard / RefreshAuthGuard 仍需 import AuthModule（守卫要在
 * 使用方模块作用域内可解析），故守卫一并导出。
 */
@Module({
  imports: [TypeOrmModule.forFeature([Users]), JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RefreshAuthGuard],
  exports: [AuthService, JwtAuthGuard, RefreshAuthGuard],
})
export class AuthModule {}
