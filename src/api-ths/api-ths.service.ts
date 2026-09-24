import { Injectable } from '@nestjs/common'

/**
 * 同花顺金融数据服务
 *
 * 数据源契约（详见 API_THS.md / API_THS_FULL.md）：
 * - Base URL `https://fuyao.aicubes.cn`，请求头 `X-api-key` 鉴权
 * - 响应统一为 `{ code, message, request_id, data }` 信封，`code !== 0` 即业务错误
 * - 时间戳字段为毫秒级 Unix 时间戳（Asia/Shanghai）
 *
 * 当前为空骨架，具体数据接口待接入时按需补充。
 */
@Injectable()
export class ApiThsService {}
