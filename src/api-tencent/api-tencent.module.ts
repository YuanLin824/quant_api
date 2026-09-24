import { Module } from '@nestjs/common'
import { ApiTencentService } from './api-tencent.service'

/**
 * 腾讯行情数据模块
 *
 * 纯服务层，不对外暴露 HTTP 接口（无 controller），供其他模块注入 ApiTencentService 使用。
 */
@Module({
  providers: [ApiTencentService],
  exports: [ApiTencentService],
})
export class ApiTencentModule {}
