import { Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common'
import { ConfigModule, ConfigService, registerAs } from '@nestjs/config'
import type { RedisOptions } from 'ioredis'
import Redis from 'ioredis'
import { CONFIG_MODULES, ENV_KEYS } from '../config/constants'

type IRedisConfig = RedisOptions & {
  url: string
}

/**
 * Redis 配置（registerAs 命名空间）
 *
 * url: 统一连接串，格式 redis[s]://[user]:[pass]@host:port[/db]
 * keyPrefix: 所有 key 自动添加此前缀，用于多项目共享同一 Redis 实例时隔离 key
 * enableReadyCheck: 确认 Redis 已就绪才接受请求，避免缓存击穿
 */
const REDIS_CONFIG = registerAs(CONFIG_MODULES.REDIS, (): IRedisConfig => {
  const redisUrl = process.env[ENV_KEYS.REDIS_URL]
  if (!redisUrl) {
    throw new Error('缺少必需的环境变量: REDIS_URL')
  }

  return {
    url: redisUrl,
    keyPrefix: process.env[ENV_KEYS.REDIS_KEY_PREFIX] ?? '',
    enableReadyCheck: true,

    retryStrategy: (times) => {
      // 指数退避：1s → 2s → 4s → ... 封顶 30s；无限重试保证恢复后自动重连
      const delay = Math.min(1000 * 2 ** (times - 1), 30000)
      // 日志降噪：仅首次与每 10 次打印警告
      if (times === 1 || times % 10 === 0) {
        logger.warn(`Redis 连接断开, 第 ${times} 次重试, ${delay}ms 后重连...`)
      }
      return delay
    },
  }
})

export type IRedisClient = Redis

/** Redis 客户端注入令牌——使用 Symbol 避免命名冲突 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT')
const logger = new Logger('RedisModule')

/**
 * Redis 连接模块
 *
 * 基于 ioredis 创建 Redis 客户端实例：
 * - 连接失败无限重试 + 指数退避（1s 起，2 倍递增，封顶 30s）——
 *   Redis 抖动/重启后自动恢复，不依赖进程重启（与 TypeORM 启动即连库的强依赖不同）
 * - 通过 REDIS_CLIENT Symbol 令牌暴露 RedisClient 给 RedisService
 * - OnModuleDestroy 时优雅关闭连接
 *
 * 注意：本模块不标记 @Global()，如需在其他模块中使用 RedisService，
 * 需由 AppModule（@Global()）重新导出。
 */
@Module({
  imports: [ConfigModule.forFeature(REDIS_CONFIG)],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): IRedisClient => {
        const { url, ...options } = configService.get<IRedisConfig>(CONFIG_MODULES.REDIS)!

        const client = new Redis(url, { ...options })

        client.on('error', (err) => {
          logger.error({ message: 'Redis 连接错误', error: err })
        })

        client.on('connect', () => {
          logger.log('Redis 连接成功...')
        })

        return client
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: IRedisClient) {}

  /** 模块销毁时优雅关闭 Redis 连接 */
  async onModuleDestroy() {
    await this.redisClient.quit()
    logger.log('Redis 连接已关闭...')
  }
}
