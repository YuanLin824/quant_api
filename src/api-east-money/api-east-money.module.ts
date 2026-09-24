import { Module } from '@nestjs/common'
import { ApiEastMoneyService } from './api-east-money.service'

/**
 * 东方财富数据模块
 *
 * 纯服务层，不对外暴露 HTTP 接口（无 controller），供其他模块注入 ApiEastMoneyService 使用。
 */
@Module({
  providers: [ApiEastMoneyService],
  exports: [ApiEastMoneyService],
})
export class ApiEastMoneyModule {}
