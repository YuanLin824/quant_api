import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { GetMinuteQueryDto, GetSearchQueryDto } from './dto'
import { WestockService } from './westock.service'

/**
 * WeStock 数据控制器
 *
 * 通过子进程调用 `scripts/westock-data-clawhub.mjs` 获取证券数据。
 * 所有接口需要 JWT 认证。
 *
 * 与 TdxController 不同，这里**不豁免限流**：每次请求会 fork 一个子进程
 * 并请求第三方上游，而非复用长连接。
 */
@Controller('westock')
@UseGuards(JwtAuthGuard)
export class WestockController {
  constructor(private readonly westockService: WestockService) {}

  /**
   * 证券搜索
   * GET /api/westock/search?keyword=腾讯&scope=stock
   */
  @Get('search')
  async search(@Query() query: GetSearchQueryDto) {
    const data = await this.westockService.search(query.keyword, query.scope)
    return { code: 200, message: '获取成功', data }
  }

  /**
   * 分时数据（days=1 当日，2~5 五日）
   * GET /api/westock/minute?code=sh600519&days=5
   */
  @Get('minute')
  async minute(@Query() query: GetMinuteQueryDto) {
    const data = await this.westockService.minute(query.code, { days: query.days })
    return { code: 200, message: '获取成功', data }
  }
}
