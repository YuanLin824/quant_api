import { Injectable } from '@nestjs/common'

/**
 * 通达信（TDX）行情数据服务
 *
 * 数据源：通达信。接入方式待定，常见形态有本地行情文件（`vipdoc/` 下的 `.day` 二进制）、
 * 行情主站 TCP 协议、第三方 HTTP 封装三种，差异较大 —— 确定后再补充契约说明与实现。
 *
 * TODO: `API_TDX.md` 目前为空文件，实现前需先补全契约（参照 API_TENCENT.md / API_THS.md 的组织方式）。
 *
 * 当前为空骨架，具体数据接口待接入时按需补充。
 */
@Injectable()
export class ApiTdxService {}
