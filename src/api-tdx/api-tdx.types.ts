/**
 * 分时数据点
 *
 * 上游 `node-tdx-market` 的 `MinuteItem` 中价格是「厘」（元 × 1000 的整数），
 * 本类型**已换算为元**——调用方拿到的就是可直接展示的价格。
 */
export interface TdxMinuteTick {
  /** 时间，格式 `HHmm`（如 `'0931'` 表示 9:31） */
  time: string
  /** 价格（元） */
  price: number
  /**
   * 均价（元）
   *
   * ⚠️ **历史分时（`getHistoryMinute`）的这个字段不可靠**：实测上游返回的原始值量级远小于价格，
   * 换算出 1~3 元这种明显失真的值（同一时刻贵州茅台当日均价约 1245 元），且多日稳定复现，
   * 属上游数据问题而非解析错误。当日分时（`getMinute`）的该字段正常。
   * 需要均价时优先用当日分时，或自行按 `price` 与 `volume` 累计计算。
   */
  avgPrice: number
  /** 成交量（原始值，上游未声明单位，故透传不做换算） */
  volume: number
}

/** 分时数据 */
export interface TdxMinuteData {
  /** 数据点数量 */
  count: number
  /** 数据点列表（按时间升序） */
  items: TdxMinuteTick[]
}
