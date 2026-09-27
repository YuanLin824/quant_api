import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { THS_CONFIG } from './api-ths.config'
import { ApiThsService } from './api-ths.service'

/**
 * 同花顺数据模块
 *
 * 纯服务层，不对外暴露 HTTP 接口（无 controller），供其他模块注入 ApiThsService 使用。
 * 配置随模块自带（`ConfigModule.forFeature`），与 PostgresModule / RedisModule 同一范式。
 */
@Module({
  imports: [ConfigModule.forFeature(THS_CONFIG)],
  providers: [ApiThsService],
  exports: [ApiThsService],
})
export class ApiThsModule {}
