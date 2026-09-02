import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import { CONFIG_MODULES, ENV_KEYS } from './config/constants'
import { IGlobalConfig } from './config/global.config'

/**
 * 应用公共配置：安全中间件 / CORS / 全局前缀 / 校验管道 / 请求日志 hook
 *
 * 独立成函数供 main.ts 与 e2e 测试共用，保证测试环境与真实运行配置一致
 * （否则测试中无前缀、无管道校验，行为与线上漂移）。
 * 独立文件而非放在 main.ts：避免测试 import 时触发 main.ts 的 bootstrap() 副作用。
 */
export function configureApp(app: INestApplication): void {
  const globalConfig = app.get(ConfigService).get<IGlobalConfig>(CONFIG_MODULES.GLOBAL)!

  // 安全中间件：设置安全 HTTP 头（CSP、HSTS、XSS 保护等）
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 年
        includeSubDomains: true,
        preload: true,
      },
      xssFilter: true,
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  )

  // CORS 配置：生产环境严格限制，开发环境宽松
  const allowedOrigins =
    process.env.NODE_ENV === 'prod'
      ? (() => {
          const origins = process.env[ENV_KEYS.ALLOWED_ORIGINS]
          if (!origins) {
            throw new Error('生产环境必须配置 ALLOWED_ORIGINS 环境变量')
          }
          return origins.split(',').map((o) => o.trim())
        })()
      : true

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 预检请求缓存 24 小时
  })

  // 全局路由前缀 — 所有接口统一加 /api/dev 或 /api/prod 前缀
  app.setGlobalPrefix(globalConfig.apiPrefix)

  // 全局校验管道 — 配合 class-validator 自动校验 DTO
  // whitelist: 自动剔除 DTO 中未声明的字段
  // forbidNonWhitelisted: 遇到未声明字段直接报错（而非静默丢弃）
  // transform: 请求参数自动转换为 DTO 声明的类型（如 string → number）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )
}
