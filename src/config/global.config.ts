import { registerAs } from '@nestjs/config'
import { CONFIG_MODULES, ENV_KEYS } from './constants'

/**
 * 解析环境变量中的时间字符串（如 "15m", "7d"）为秒数
 *
 * JWT 库的 expiresIn 接受 number（秒），而环境变量更适合用人类可读格式。
 * 此函数在配置加载时将 "15m" → 900, "7d" → 604800。
 */
function parseSeconds(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/)
  if (!match) throw new Error(`无法解析时间: ${value}`)
  const num = parseInt(match[1], 10)
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return num * multipliers[match[2]]!
}

interface IJwtConfig {
  accessExpiresIn: number
  accessSecretKey: string
  refreshExpiresIn: number
  refreshSecretKey: string
  maxDevices: number
}

export interface IGlobalConfig extends IJwtConfig {
  port: number
  apiPrefix: string
}

/** JWT 配置 (registerAs 命名空间) */
export const GLOBAL_CONFIG = registerAs(CONFIG_MODULES.GLOBAL, (): IGlobalConfig => {
  const accessSecretKey = process.env[ENV_KEYS.JWT_ACCESS_SECRET_KEY]
  const refreshSecretKey = process.env[ENV_KEYS.JWT_REFRESH_SECRET_KEY]

  // 启动时验证必需的环境变量
  if (!accessSecretKey) {
    throw new Error('缺少必需的环境变量: JWT_SECRET_KEY')
  }
  if (!refreshSecretKey) {
    throw new Error('缺少必需的环境变量: JWT_REFRESH_SECRET_KEY')
  }
  if (accessSecretKey === refreshSecretKey) {
    throw new Error('JWT_SECRET_KEY 与 JWT_REFRESH_SECRET_KEY 不能相同')
  }
  if (accessSecretKey.length < 32 || refreshSecretKey.length < 32) {
    throw new Error('JWT 密钥长度必须至少 32 个字符')
  }

  return {
    port: parseInt(process.env[ENV_KEYS.PORT] ?? '3000', 10),
    apiPrefix: process.env[ENV_KEYS.API_PREFIX] ?? '/api',

    accessSecretKey,
    accessExpiresIn: parseSeconds(process.env[ENV_KEYS.JWT_ACCESS_EXPIRES_IN] ?? '15m'),
    refreshSecretKey,
    refreshExpiresIn: parseSeconds(process.env[ENV_KEYS.JWT_REFRESH_EXPIRES_IN] ?? '7d'),
    maxDevices: parseInt(process.env[ENV_KEYS.AUTH_MAX_DEVICES] ?? '5', 10),
  }
})
