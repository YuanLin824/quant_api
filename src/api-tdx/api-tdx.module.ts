import { Inject, Logger, Module, type OnModuleDestroy } from '@nestjs/common'
import { TdxClient } from 'node-tdx-market'
import { TDX_CLIENT } from './api-tdx.constants'
import { ApiTdxService } from './api-tdx.service'

const logger = new Logger('ApiTdxModule')

/**
 * 创建通达信客户端
 *
 * 刻意**不在启动时连接**——连接由 `ApiTdxService` 在首次调用时懒触发，
 * 这样行情服务器不可用不会影响应用启动。
 */
function createTdxClient(): TdxClient {
  const client = new TdxClient({ autoReconnect: true })

  // 库文档明确：没有 'error' 监听者时 socket 异常会让进程崩溃，必须监听
  client.on('error', (err: unknown) => {
    logger.error({ message: '通达信客户端错误', error: err })
  })
  client.on('connected', (address: string) => {
    logger.log({ message: '通达信行情服务器已连接', address })
  })

  return client
}

/**
 * 通达信数据模块
 *
 * 纯服务层，不对外暴露 HTTP 接口（无 controller），供其他模块注入 ApiTdxService 使用。
 *
 * 连接的所有权在此（与 `RedisModule` 同范式）：工厂负责创建并挂事件监听，模块销毁时断开。
 * `main.ts` 已调用 `app.enableShutdownHooks()`，故 SIGTERM / SIGINT（容器停止、Ctrl+C）同样会触发断开。
 */
@Module({
  providers: [{ provide: TDX_CLIENT, useFactory: createTdxClient }, ApiTdxService],
  exports: [ApiTdxService],
})
export class ApiTdxModule implements OnModuleDestroy {
  constructor(@Inject(TDX_CLIENT) private readonly client: TdxClient) {}

  /** 模块销毁时断开 TCP 连接 */
  onModuleDestroy() {
    this.client.disconnect()
    logger.log('通达信连接已断开...')
  }
}
