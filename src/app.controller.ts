import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

/**
 * 应用根控制器
 *
 * GET /health — 健康检查端点，返回服务状态、版本号、运行时长及内存使用情况。
 * 可用于 k8s liveness/readiness probe 或负载均衡健康检测。
 */
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  health() {
    return this.appService.getHealthInfo()
  }
}
