import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { configureApp } from './../src/app.setup'

/**
 * 依赖外部服务（云端 PostgreSQL / Redis）——仅建立 PG 连接就约 3 秒
 * （TLS 握手 + 云端往返），加上 TypeORM 加载表结构与 AuthInitService 创建默认账户，
 * 远超 jest 默认的 5 秒超时。
 */
jest.setTimeout(60_000)

describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  // 用 beforeAll 而非 beforeEach：应用启动要连数据库并创建默认账户，成本高，
  // 每个用例重建一次会让耗时成倍增长
  beforeAll(async () => {
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

  afterAll(async () => {
    // 判空：启动失败时 app 未赋值，避免二次报错掩盖真实原因
    await app?.close()
  })
})
