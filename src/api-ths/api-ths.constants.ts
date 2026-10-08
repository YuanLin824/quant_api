/** 同花顺金融数据 API 基地址 */
export const THS_BASE_URL = 'https://fuyao.aicubes.cn'

/** 上游请求超时（毫秒） */
export const THS_REQUEST_TIMEOUT_MS = 10_000

/** 标的列表端点路径 */
export const THS_TICKER_LIST_PATH = '/api/meta/tickers/list'

/** 交易日历端点路径（无入参，固定返回近一年） */
export const THS_TRADING_DAYS_PATH = '/api/a-share/calendar/trading-days'

/**
 * 交易日历的内存缓存时长（毫秒）
 *
 * 该接口无入参、固定返回「今日 - 1 年 ~ 今日」的窗口，一天最多变一次，非常适合缓存——
 * 否则每次判断「今天是不是交易日」都要打一次上游。
 */
export const THS_CALENDAR_CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** 标的列表单页条数上限（上游限制，超出上游返回 code=1003） */
export const THS_TICKER_LIST_MAX_LIMIT = 10_000

/** 标的列表单页条数默认值（与上游默认值一致） */
export const THS_TICKER_LIST_DEFAULT_LIMIT = 1000

/**
 * 自动翻页时的单页条数
 *
 * 取上游允许的最大值：同样的数据量下请求次数最少（全市场一轮 sweep 约 10 次请求），
 * 也就最不容易触发上游限流。
 */
export const THS_TICKER_SWEEP_PAGE_SIZE = THS_TICKER_LIST_MAX_LIMIT

/**
 * 自动翻页的最大轮数兜底
 *
 * 正常终止由「返回条数 < 单页条数」判定；此上限仅为防上游行为异常（如持续返回满页）导致死循环。
 * 配合单页 10000 条即上限 50 万条，远超全市场实际规模。
 */
export const THS_TICKER_SWEEP_MAX_PAGES = 50

/**
 * 规范化资产类型（`asset_type` 查询参数可选值）
 *
 * 传非法值上游返回 code=1003，故在本地先行拦截，避免白打一次请求。
 */
export const THS_ASSET_TYPES = [
  'a-share',
  'a-share-index',
  'fund-otc',
  'fund-etf',
  'fund-lof',
  'fund-reits',
  'forex',
  'futures',
  'futures-commodity-index',
  'options',
] as const

/** 规范化资产类型联合类型 */
export type ThsAssetType = (typeof THS_ASSET_TYPES)[number]

/** 上游业务错误码（`code !== 0` 即业务错误） */
export const THS_CODE = {
  SUCCESS: 0,
  MISSING_PARAM: 1001,
  INVALID_PARAM: 1002,
  OUT_OF_RANGE: 1003,
  PARAM_CONFLICT: 1004,
  UNAUTHENTICATED: 2001,
  FORBIDDEN: 2003,
  /** 该能力未开放外部接入，仅同花顺 AI 客户端可用（实测发现，上游错误码表中未列出） */
  AI_CLIENT_ONLY: 2004,
  TICKER_NOT_FOUND: 3001,
  DATA_NOT_READY: 3002,
  UNSUPPORTED_ASSET_TYPE: 3004,
  RATE_LIMITED: 4001,
  INTERNAL_ERROR: 5001,
  UPSTREAM_TIMEOUT: 5002,
  SOURCE_UNAVAILABLE: 5003,
} as const
