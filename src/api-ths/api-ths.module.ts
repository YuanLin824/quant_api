import { Module } from '@nestjs/common'
import { ApiThsService } from './api-ths.service'

/**
 * 同花顺数据模块
 *
 * 纯服务层，不对外暴露 HTTP 接口（无 controller），供其他模块注入 ApiThsService 使用。
 */
@Module({
  providers: [ApiThsService],
  exports: [ApiThsService],
})
export class ApiThsModule {}
