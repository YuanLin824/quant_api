import { Module } from '@nestjs/common'
import { WestockController } from './westock.controller'
import { WestockService } from './westock.service'

/**
 * WeStock 数据模块
 *
 * 通过子进程调用仓库 `scripts/` 下的 westock CLI（Go 二进制），当前提供证券搜索。
 * 二进制不入库，由 `scripts/setup.*` 获取，并被 npm 的 `pre` 钩子在启动/构建前自动确保存在。
 */
@Module({
  controllers: [WestockController],
  providers: [WestockService],
  exports: [WestockService],
})
export class WestockModule {}
