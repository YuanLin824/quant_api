/**
 * 根据 process.env.NODE_ENV 环境变量判断是否为生产环境
 */
export const IS_PROD = process.env.NODE_ENV === 'prod'

/** 配置命名空间键名，与各 config 文件的 registerAs 第一个参数对应 */
export const CONFIG_MODULES = {
  GLOBAL: Symbol('global'),
  PG: Symbol('postgres'),
  REDIS: Symbol('redis'),
} as const

/** 所有环境变量名集中管理，避免散落各处的魔法字符串 */
export const ENV_KEYS = {
  NODE_ENV: 'NODE_ENV',

  // Api
  PORT: 'PORT',
  API_PREFIX: 'API_PREFIX',
  ALLOWED_ORIGINS: 'ALLOWED_ORIGINS',

  // JWT
  JWT_ACCESS_SECRET_KEY: 'JWT_ACCESS_SECRET_KEY',
  JWT_ACCESS_EXPIRES_IN: 'JWT_ACCESS_EXPIRES_IN',
  JWT_REFRESH_SECRET_KEY: 'JWT_REFRESH_SECRET_KEY',
  JWT_REFRESH_EXPIRES_IN: 'JWT_REFRESH_EXPIRES_IN',

  // Auth - 多设备控制
  AUTH_MAX_DEVICES: 'AUTH_MAX_DEVICES',

  // PostgreSQL - TypeORM
  // 统一连接串 postgres://[user]:[pass]@host:port/db
  PG_URL: 'PG_URL',

  // Redis - ioredis
  // 统一连接串 redis://[user]:[pass]@host:port[/db]
  REDIS_URL: 'REDIS_URL',
  REDIS_KEY_PREFIX: 'REDIS_KEY_PREFIX',

  CRYPTO_PROXY: 'CRYPTO_PROXY',
} as const
