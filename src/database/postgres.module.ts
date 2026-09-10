import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService, registerAs } from '@nestjs/config'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { CONFIG_MODULES, ENV_KEYS, IS_PROD } from '../config/constants'

type IPostgresConfig = TypeOrmModuleOptions

/**
 * Postgres 配置（registerAs 命名空间）
 *
 * url: 统一连接串，格式 postgres://[user]:[pass]@host:5432/database
 * autoLoadEntities: 汇总各模块 forFeature 注册的实体
 * synchronize: 开发环境（!IS_PROD）启动时自动对账表结构，开发期免手动迁移；生产必须为 false，避免误改表结构
 * extra: 连接池上限 10 个连接，连接超时 5s
 */
const POSTGRES_CONFIG = registerAs(CONFIG_MODULES.PG, (): IPostgresConfig => {
  const synchronize = !IS_PROD

  // 双重保险：生产环境禁止启用 synchronize
  if (IS_PROD && synchronize) {
    throw new Error('生产环境禁止启用 TypeORM synchronize')
  }

  const postgresUrl = process.env[ENV_KEYS.PG_URL]
  if (!postgresUrl) {
    throw new Error('缺少必需的环境变量: PG_URL')
  }

  return {
    type: 'postgres',
    url: postgresUrl,
    retryAttempts: 5,
    retryDelay: 10000,
    autoLoadEntities: true,
    logging: false,
    synchronize,
    extra: { max: 10, connectionTimeoutMillis: 5000 },
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  }
})

/**
 * 数据库模块：TypeORM 数据源（postgres 驱动，主数据库，已在 AppModule 挂载）
 *
 * - 实体收集：下方 entities glob（扫描全部 `*.entity.ts`）+ autoLoadEntities（各模块 forFeature 注册的实体）。
 *   新增实体使用 `*.entity.ts` 后缀即可自动收集；抽象基类（如 BaseEntity）无 @Entity 装饰器，会被 TypeORM 忽略
 * - 启动即连库（TypeORM 标准行为）：DB 不可达时启动失败（重试 5 次×1s），与 Redis 无限重试容错不同
 */
@Module({
  imports: [
    ConfigModule.forFeature(POSTGRES_CONFIG),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        ...configService.get<IPostgresConfig>(CONFIG_MODULES.PG),
      }),
    }),
  ],
})
export class PostgresModule {}
