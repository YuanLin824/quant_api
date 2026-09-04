import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { resolve } from 'path'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { AllExceptionsFilter } from './common/filters/all-exception.filter'
import { LoggerMiddleware } from './common/middlewares/logger.middleware'
import { IS_PROD } from './config/constants'
import { GLOBAL_CONFIG } from './config/global.config'
import { PostgresModule } from './database/postgres.module'
import { RedisModule } from './database/redis.module'
import { RedisService } from './database/redis.service'
import { StockApiModule } from './stock-api/stock-api.module'
import { StockSdkModule } from './stock-sdk/stock-sdk.module'

// @Global() 使本模块的 providers/exports 在所有子模块中可直接注入，无需重复 import
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      // 使用绝对路径, 避免 CWD 不一致导致 .env 文件找不到 (静默失败不报错)
      envFilePath: [
        resolve(__dirname, '..', IS_PROD ? '.env.production.local' : '.env.development.local'),
        resolve(__dirname, '..', IS_PROD ? '.env.production' : '.env.development'),
        resolve(__dirname, '..', '.env.local'),
        resolve(__dirname, '..', '.env'),
      ],
      // 仅注册全局通用配置, 数据库/Redis 配置由各模块自行 forFeature 注册
      load: [GLOBAL_CONFIG],
    }),
    // 全局限流：每个 IP 在 60 秒内最多 100 次请求
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 秒
        limit: 100, // 最多 100 次请求
      },
    ]),
    PostgresModule,
    RedisModule,
    AuthModule,
    StockApiModule,
    StockSdkModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    RedisService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],

  // 全局导出 Redis 服务；TypeORM 的 DataSource 由 @Global() 的 TypeOrmCoreModule 提供，无需模块级导出
  exports: [RedisService],
})
export class AppModule implements NestModule {
  /** 注册请求日志中间件（排除登录接口，避免密码明文入日志） */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).exclude('auth/login').forRoutes('*path')
  }
}
