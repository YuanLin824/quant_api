import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import express from 'express'
import { AppModule } from './app.module'
import { configureApp } from './app.setup'
import { CONFIG_MODULES, ENV_KEYS } from './config/constants'
import { IGlobalConfig } from './config/global.config'
import { WINSTON_LOGGER } from './config/winston'

async function bootstrap() {
  // 使用 Winston 日志替代默认 Logger，确保启动阶段的日志也能输出到文件
  const app = await NestFactory.create<INestApplication>(AppModule, {
    logger: WINSTON_LOGGER,
  })

  // 请求体大小限制（防止大负载 DoS 攻击）
  app.use(express.json({ limit: '10kb' }))
  app.use(express.urlencoded({ extended: true, limit: '10kb' }))

  configureApp(app)

  const globalConfig = app.get(ConfigService).get<IGlobalConfig>(CONFIG_MODULES.GLOBAL)!
  await app.listen(globalConfig.port)
}

bootstrap()
  .then(() => {
    const port = process.env[ENV_KEYS.PORT]
    const prefix = process.env[ENV_KEYS.API_PREFIX]
    console.log(`应用启动成功! 接口 URL:`, `http://localhost:${port}${prefix}`)
  })
  .catch((err) => {
    console.error('应用启动失败:', err)
    process.exit(1)
  })
