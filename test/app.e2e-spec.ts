import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { configureApp } from './../src/app.setup'

describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    // 与 main.ts 共用同一套装配（Helmet / 全局前缀 / ValidationPipe），避免测试与线上配置漂移
    configureApp(app)
    await app.init()
  })

  it('/api/health (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200)

    expect(res.body).toMatchObject({ code: 200, message: '服务运行正常' })
    expect(res.body.data).toMatchObject({
      version: expect.any(String),
      uptime: expect.any(String),
    })
  })

  it('未加全局前缀的路径返回 404', () => {
    return request(app.getHttpServer()).get('/health').expect(404)
  })

  afterEach(async () => {
    await app.close()
  })
})
