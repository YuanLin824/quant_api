import { Module } from '@nestjs/common'
import { WestockCliService } from './westock-cli.service'

/**
 * 腾讯 Go CLI 模块（K 线与统一搜索）
 *
 * 通过子进程调用 `src/scripts/westock.exe` 提供 K 线与搜索能力。
 *
 * **不对外暴露 HTTP 接口**——本模块只作为内部数据源供其他模块注入使用。
 */
@Module({
  providers: [WestockCliService],
  exports: [WestockCliService],
})
export class WestockCliModule {}
