import { Module } from '@nestjs/common'
import { ApiTdxService } from './api-tdx.service'

/**
 * 通达信数据模块
 *
 * 纯服务层，不对外暴露 HTTP 接口（无 controller），供其他模块注入 ApiTdxService 使用。
 */
@Module({
  providers: [ApiTdxService],
  exports: [ApiTdxService],
})
export class ApiTdxModule {}
