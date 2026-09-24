import { Injectable } from '@nestjs/common'

/**
 * 腾讯财经行情数据服务
 *
 * 数据源契约（详见 API_TENCENT.md）：
 * - 无需注册与 API Key，HTTP GET 直连；域名按数据类型分散：
 *   `qt.gtimg.cn`（实时行情/盘口/简要信息/指数）、`web.ifzq.gtimg.cn` 与 `ifzq.gtimg.cn`（分时/K 线）、
 *   `proxy.finance.qq.com`（板块排名）、`smartbox.gtimg.cn`（股票搜索）
 * - `qt.gtimg.cn` 系列返回 **GBK** 文本（须按 gbk/gb2312 解码），字段以 `~` 分隔、按固定下标取值；
 *   其余接口返回 JSON
 * - 部分请求需带 `User-Agent` 与 `Referer: https://finance.qq.com`
 * - 建议单次不超过 20 个代码、间隔 100ms 以上，避免 IP 被封
 *
 * 注意：以上均为腾讯网页端内部接口，非官方文档化 API，可能随时调整或限制。
 *
 * 当前为空骨架，具体数据接口待接入时按需补充。
 */
@Injectable()
export class ApiTencentService {}
