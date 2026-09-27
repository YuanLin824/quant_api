import { registerAs } from '@nestjs/config'
import { CONFIG_MODULES, ENV_KEYS } from '../config/constants'

export interface IThsConfig {
  apiKey: string
}

/**
 * 同花顺数据源配置（模块私有，不导出）
 *
 * 与 `redis.module.ts` / `global.config.ts`「缺环境变量即 throw」的 fail-fast 风格不同，
 * 这里**刻意不校验 apiKey 是否存在**：同花顺是可选外部数据源，缺 Key 不应阻塞整个应用启动
 * （本地只调认证接口、CI 无密钥跑测试都属正常场景）。
 * 缺失的后果延迟到实际发起请求时，由 ApiThsService 抛出明确异常。
 */
export const THS_CONFIG = registerAs(CONFIG_MODULES.THS, (): IThsConfig => {
  return {
    // trim 后为空串即视为未配置，避免 " " 这类空白值绕过服务层的未配置判定
    apiKey: process.env[ENV_KEYS.THS_API_KEY]?.trim() ?? '',
  }
})
