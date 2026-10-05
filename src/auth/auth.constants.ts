/** 内置超级管理员用户名（AuthInitService 启动时自动创建） */
export const ADMIN_USERNAME = 'QuantAdmin'

/**
 * 超级管理员的 access token 有效期（秒）：24 小时
 *
 * **刻意偏离**普通用户的 `JWT_ACCESS_EXPIRES_IN` 配置（默认 15 分钟）：
 * 内置管理员多用于运维/调试场景，频繁续期不便。代价是 token 泄露后的可用窗口显著变长，
 * 故**只对这一个内置账户**生效，普通用户仍走短 access + 长 refresh 的标准策略。
 *
 * 写成常量而非环境变量：它是**单个内置账户的例外**，与面向所有用户的 `JWT_ACCESS_EXPIRES_IN`
 * 属不同层次，混在一起配置会让「为什么管理员不一样」变得难以追溯。
 */
export const ADMIN_ACCESS_EXPIRES_IN = 24 * 60 * 60
