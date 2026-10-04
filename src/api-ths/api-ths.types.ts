/**
 * 同花顺 API 统一响应信封
 *
 * 业务响应（含业务错误）通常返回 HTTP 200，业务结果由 `code` 字段表达。
 */
export interface ThsApiEnvelope<T> {
  /** 业务结果码，0 表示成功，非 0 表示业务错误 */
  code: number
  /** 结果描述 */
  message: string
  /** 请求追踪 ID */
  request_id: string
  /** 业务数据容器，错误时可能为 null */
  data: T | null
}

/** 标的列表接口的 data 载荷 */
export interface ThsTickerListData {
  /** 数据就绪时间（毫秒），为当前代码表快照的上游加载时间 */
  timestamp: number
  /** 标的列表 */
  item: ThsTickerItem[]
}

/** 历史 K 线接口的 data 载荷 */
export interface ThsKlineData {
  /** 数据就绪时间（毫秒），为序列中最新一根 K 线的上游有效时间 */
  timestamp: number
  /** K 线列表 */
  item: ThsPriceBar[]
}

/** 单根 K 线（`item[]` 元素） */
export interface ThsPriceBar {
  /** K 线日期（毫秒 Unix 时间戳） */
  date_ms: number
  /** 开盘价 */
  open_price: number
  /** 最高价 */
  high_price: number
  /** 最低价 */
  low_price: number
  /** 收盘价 */
  close_price: number
  /** 成交量（股） */
  volume: number
  /** 成交额（原始货币） */
  turnover: number
}

/** 单条标的信息（`item[]` 元素） */
export interface ThsTickerItem {
  /** 完整 thscode，如 `600519.SH` */
  thscode: string
  /** 纯代码，如 `600519` */
  ticker: string
  /** 展示名称 */
  name: string
  /** 交易所后缀（`SH` / `SZ` / `BJ`）；场外基金为 null */
  exchange: string | null
  /** 规范化资产类型，每条记录仅返回一个叶子类型 */
  asset_type: string
  /** 币种代码，当前基金统一为 `CNY` */
  currency: string
  /** 上市日期，格式 `yyyy-MM-dd` */
  list_date: string | null
  /** 合约到期日，格式 `yyyy-MM-dd` */
  end_date: string | null
  /** 最后交易日，格式 `yyyy-MM-dd` */
  last_trade_date: string | null
  /** 最后交割日，格式 `yyyy-MM-dd` */
  last_delivery_date: string | null
}
