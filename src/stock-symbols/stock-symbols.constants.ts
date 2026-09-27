import type { ThsAssetType } from '../api-ths/api-ths.constants'

/**
 * 标的同步的 cron 表达式：每周一至周五 17:30
 *
 * 收盘后执行——代码表在当日交易结束后已定型。周末两天上游不更新，故限定 1-5；
 * 法定节假日会空跑一次，同步结果不变，无副作用。
 *
 * ⚠️ cron 表达式与时区必须是**模块常量**，不可改为读 `process.env`：
 * `@Cron` 在装饰器求值期（模块 import 时）取参，而 `.env` 要到 `ConfigModule.forRoot()`
 * 执行时才写入 `process.env`，用 `process.env.XXX` 会静默拿到 `undefined`。
 */
export const STOCK_SYMBOLS_SYNC_CRON = '0 30 17 * * 1-5'

/** 标的同步时区（cron 按此时区解释） */
export const STOCK_SYMBOLS_SYNC_TIMEZONE = 'Asia/Shanghai'

/**
 * 需要同步的资产类型
 *
 * 个股 + 指数/板块：同花顺的类型枚举里没有独立的「板块」类型，
 * 各类板块（行业板块、概念板块、同花顺特色指数）都归在 `a-share-index` 下。
 */
export const STOCK_SYMBOLS_ASSET_TYPES: ThsAssetType[] = ['a-share', 'a-share-index']

/**
 * 批量 upsert 的分片大小
 *
 * TypeORM 的 `EntityManager.upsert` 内部**不自动分片**——它把整个数组拼成一条多行
 * `INSERT ... ON CONFLICT`，故分片是应用层责任。
 * 一次提交全部约 7000 行会超出 PostgreSQL 的绑定参数上限（每行 12 列 × 7000 ≈ 84000，上限 65535），
 * 按 1000 行一批提交（12000 个参数）留出余量。
 */
export const STOCK_SYMBOLS_UPSERT_CHUNK_SIZE = 1000

/**
 * 消失标记的保护阈值
 *
 * 仅当上游返回量 ≥「存量活跃标的数 × 该比例」时才把未返回的标的标记为已消失。
 * 若上游因口径调整或分页异常导致返回量骤降，直接标记会把数千个正常标的误判为退市，
 * 此时改为**只写入、不标记**并记 warn。代价是真实的批量退市会延后一轮反映。
 */
export const STOCK_SYMBOLS_MIN_KEEP_RATIO = 0.5

/** 查询接口默认每页条数 */
export const STOCK_SYMBOLS_QUERY_DEFAULT_PAGE_SIZE = 20

/** 查询接口每页条数上限 */
export const STOCK_SYMBOLS_QUERY_MAX_PAGE_SIZE = 100
