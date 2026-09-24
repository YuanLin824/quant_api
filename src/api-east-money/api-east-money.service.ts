import { Injectable } from '@nestjs/common'

/**
 * 东方财富行情数据服务
 *
 * 数据源：东方财富。接入方式待定（其行情接口按数据类型分散在多个域名下），
 * 确定后再补充契约说明与实现。
 *
 * TODO: 仓库内 `API_EAST_MONEY.md` 目前为空文件，实现前需先补全契约文档
 * （参照 API_TENCENT.md / API_THS.md 的组织方式）。
 *
 * 当前为空骨架，具体数据接口待接入时按需补充。
 */
@Injectable()
export class ApiEastMoneyService {}
