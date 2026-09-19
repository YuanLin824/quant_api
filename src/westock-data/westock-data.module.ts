import { Module } from '@nestjs/common'
import { WestockDataService } from './westock-data.service'

/**
 * `westock-data-clawhub` 模块（搜索与分时）
 *
 * 通过子进程调用仓库 `src/scripts/` 下的单文件 bundle 提供证券搜索与分时能力。
 *
 * **不对外暴露 HTTP 接口**——本模块只作为内部数据源供其他模块注入使用。
 * bundle 不入库，由 `src/scripts/setup.*` 获取。
 */
@Module({
  providers: [WestockDataService],
  exports: [WestockDataService],
})
export class WestockDataModule {}
