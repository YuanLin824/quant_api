import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  /** 健康检查：返回服务版本、运行时长和内存使用情况 */
  getHealthInfo() {
    return {
      code: 200,
      message: '服务运行正常',
      data: {
        version: '0.0.1', // 应用版本号（与 package.json 同步）
        uptime: `${Math.floor(process.uptime())}s`, // 进程已运行时长（秒）
        timestamp: new Date().toISOString(), // 当前 UTC 时间戳
        memory: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`, // 常驻内存集
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, // 堆已使用
        },
      },
    }
  }
}
