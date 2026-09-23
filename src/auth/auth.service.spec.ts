import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { hash } from 'bcryptjs'
import { QueryFailedError, Repository } from 'typeorm'
import { RedisService } from '../database/redis.service'
import { AuthService } from './auth.service'
import { JwtPayload } from './auth.types'
import { Users } from './entities/users.entity'

describe('AuthService', () => {
  let service: AuthService
  const mockRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  }
  const mockRedis = {
    hGet: jest.fn(),
    hSet: jest.fn(),
    hGetAll: jest.fn(),
    hDel: jest.fn(),
    get: jest.fn(),
    incr: jest.fn(),
    del: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      ttl: jest.fn().mockResolvedValue(900),
    }),
  }
  const mockJwt = {
    signAsync: jest.fn(),
    decode: jest.fn(),
  }
  const mockConfigService = {
    get: jest.fn().mockReturnValue({
      accessExpiresIn: 900,
      accessSecretKey: 'access-secret',
      refreshExpiresIn: 604800,
      refreshSecretKey: 'refresh-secret',
      maxDevices: 5,
    }),
  }

  const device = { userAgent: 'jest', ip: '127.0.0.1' }
  const now = Date.now()

  beforeEach(() => {
    jest.clearAllMocks()
    // 默认无既有会话；具体用例再覆盖
    mockRedis.hGetAll.mockResolvedValue({})
    mockRedis.get.mockResolvedValue(null) // 默认无登录失败记录
    mockRedis.incr.mockResolvedValue(1) // 默认首次失败
    // 模拟 TypeORM save 的行为：原地回填数据库生成的 id 到传入实体
    mockRepo.save.mockImplementation(async (user: Users) => {
      user.id = 'u1'
      return user
    })
    service = new AuthService(
      mockRepo as unknown as Repository<Users>,
      mockRedis as unknown as RedisService,
      mockJwt as unknown as JwtService,
      mockConfigService as unknown as ConfigService
    )
  })

  /** 构造唯一约束冲突的 QueryFailedError（PG 23505） */
  function uniqueViolation(): QueryFailedError {
    const driverError = new Error('duplicate key value') as Error & { code?: string }
    driverError.code = '23505'
    return new QueryFailedError('INSERT INTO users', [], driverError)
  }

  describe('register', () => {
    it('注册成功：密码 bcrypt 哈希入库，返回双 token 并登记设备', async () => {
      mockJwt.signAsync.mockImplementation(async (payload) => `token-${payload.tokenType}`)

      const result = await service.register({ username: 'alice123', password: 'secret123' })

      const saved = mockRepo.save.mock.calls[0][0] as Users
      expect(saved.password).toMatch(/^\$2[aby]\$/)
      expect(saved.password).not.toBe('secret123')
      expect(result.accessToken).toBe('token-access')
      expect(result.refreshToken).toBe('token-refresh')
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        'auth:devices:u1',
        expect.any(String),
        expect.any(String)
      )
    })

    it('用户名重复（23505）→ 409 用户名已存在', async () => {
      mockRepo.save.mockRejectedValue(uniqueViolation())

      await expect(
        service.register({ username: 'alice123', password: 'secret123' })
      ).rejects.toBeInstanceOf(ConflictException)
      await expect(
        service.register({ username: 'alice123', password: 'secret123' })
      ).rejects.toThrow('用户名已存在')
    })
  })

  describe('login', () => {
    it('登录成功：密码校验通过，登记设备并返回双 token', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        password: await hash('secret123', 12),
        status: 1,
      } as Users)
      mockJwt.signAsync.mockImplementation(async (payload) => `token-${payload.tokenType}`)

      const result = await service.login({ username: 'alice', password: 'secret123' }, device)

      expect(result.accessToken).toBe('token-access')
      expect(result.refreshToken).toBe('token-refresh')
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        'auth:devices:u1',
        expect.any(String),
        expect.stringContaining('jest')
      )
      // 登录成功后清除失败计数
      expect(mockRedis.del).toHaveBeenCalledWith('auth:fail:alice')
    })

    it('用户不存在与密码错误返回同一消息（防用户名枚举）', async () => {
      mockRepo.findOne.mockResolvedValue(null)
      const missing = service.login({ username: 'ghost', password: 'x12345' }, device)

      mockRepo.findOne.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        password: await hash('other-pass', 12),
        status: 1,
      } as Users)
      const wrongPass = service.login({ username: 'alice', password: 'wrong-pass' }, device)

      await expect(missing).rejects.toBeInstanceOf(UnauthorizedException)
      await expect(missing).rejects.toThrow('用户名或密码错误')
      await expect(wrongPass).rejects.toThrow('用户名或密码错误')
      // 登录失败递增计数
      expect(mockRedis.incr).toHaveBeenCalledWith('auth:fail:ghost', 900)
      expect(mockRedis.incr).toHaveBeenCalledWith('auth:fail:alice', 900)
    })

    it('账号禁用（status=0）→ 403', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        password: await hash('secret123', 12),
        status: 0,
      } as Users)

      await expect(
        service.login({ username: 'alice', password: 'secret123' }, device)
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('账号锁定：连续失败 5 次后锁定 15 分钟', async () => {
      mockRedis.get.mockResolvedValue('5') // 已失败 5 次
      mockRedis.getClient().ttl.mockResolvedValue(600) // 剩余 600 秒

      await expect(
        service.login({ username: 'alice', password: 'secret123' }, device)
      ).rejects.toThrow('登录失败次数过多，账号已被临时锁定 600 秒')
    })

    it('设备超限：先清过期条目，再淘汰 loginAt 最早的设备', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        password: await hash('secret123', 12),
        status: 1,
      } as Users)
      // 6 条既有会话：第 1 条已过期，其余 5 条 loginAt 递增（1..5）
      const entries: Record<string, string> = {}
      entries['expired-jti'] = JSON.stringify({
        userAgent: 'old',
        ip: '0.0.0.0',
        loginAt: now - 10_000,
        expiresAt: now - 5_000,
      })
      for (let i = 1; i <= 5; i++) {
        entries[`jti-${i}`] = JSON.stringify({
          userAgent: `ua-${i}`,
          ip: `1.1.1.${i}`,
          loginAt: now - 1000 * i,
          expiresAt: now + 999_999,
        })
      }
      mockRedis.hGetAll.mockResolvedValue(entries)

      await service.login({ username: 'alice', password: 'secret123' }, device)

      const delCalls = mockRedis.hDel.mock.calls.map((call) => call[1])
      // 过期条目被清理
      expect(delCalls).toContain('expired-jti')
      // 5 条存活的旧会话 + 1 条新会话 = 6 > 5，淘汰 loginAt 最早的 jti-5
      expect(delCalls).toContain('jti-5')
      expect(delCalls).not.toContain('jti-4')
      expect(mockRedis.hSet).toHaveBeenCalled()
    })
  })

  describe('refresh', () => {
    it('轮换成功：旧 jti 作废、新 jti 写入，返回新双 token', async () => {
      mockRedis.hGet.mockResolvedValue(
        JSON.stringify({ userAgent: 'ua', ip: '1.2.3.4', loginAt: now, expiresAt: now + 999_999 })
      )
      mockRepo.findOne.mockResolvedValue({ id: 'u1', username: 'alice', status: 1 } as Users)
      mockRedis.hGetAll.mockResolvedValue({})
      mockJwt.signAsync.mockImplementation(
        async (payload) => `t-${payload.tokenType}-${payload.jti}`
      )

      const payload: JwtPayload = {
        sub: 'u1',
        username: 'alice',
        tokenType: 'refresh',
        jti: 'old-jti',
      }
      const result = await service.refresh(payload, device)

      expect(mockRedis.hDel).toHaveBeenCalledWith('auth:devices:u1', 'old-jti')
      const hSetCalls = mockRedis.hSet.mock.calls
      expect(hSetCalls.length).toBe(1)
      expect(hSetCalls[0][1]).not.toBe('old-jti')
      // refresh token 内的 jti 与写入白名单的 field 一致
      const newJti = hSetCalls[0][1]
      expect(result.refreshToken).toBe(`t-refresh-${newJti}`)
      expect(result.accessToken).toMatch(/^t-access-/)
    })

    it('jti 不在白名单（已轮换重用 / 已登出 / 伪造）→ 401', async () => {
      mockRedis.hGet.mockResolvedValue(null)

      await expect(
        service.refresh(
          { sub: 'u1', username: 'alice', tokenType: 'refresh', jti: 'stale' },
          device
        )
      ).rejects.toBeInstanceOf(UnauthorizedException)
      await expect(
        service.refresh(
          { sub: 'u1', username: 'alice', tokenType: 'refresh', jti: 'stale' },
          device
        )
      ).rejects.toThrow('登录状态已失效')
    })

    it('刷新时用户已注销 → 401', async () => {
      mockRedis.hGet.mockResolvedValue(
        JSON.stringify({ userAgent: 'ua', ip: 'x', loginAt: now, expiresAt: now + 999 })
      )
      mockRepo.findOne.mockResolvedValue(null)

      await expect(
        service.refresh({ sub: 'u1', username: 'alice', tokenType: 'refresh', jti: 'j1' }, device)
      ).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('logout', () => {
    it('登出：按 decode 出的 sub/jti 删除白名单条目', async () => {
      mockJwt.decode.mockReturnValue({ sub: 'u1', jti: 'jti-x' } as JwtPayload)

      await service.logout('some-token')

      expect(mockRedis.hDel).toHaveBeenCalledWith('auth:devices:u1', 'jti-x')
    })

    it('登出幂等：伪造/畸形 token 静默成功', async () => {
      mockJwt.decode.mockReturnValue(null)

      await expect(service.logout('garbage')).resolves.toBeUndefined()
      expect(mockRedis.hDel).not.toHaveBeenCalled()
    })
  })

  describe('generateTokens 载荷', () => {
    it('access 无 jti 且 tokenType=access；refresh 含 jti 且 tokenType=refresh', async () => {
      mockJwt.signAsync.mockImplementation(async (payload) => JSON.stringify(payload))

      const result = await service.register({ username: 'alice123', password: 'secret123' })

      const accessPayload = JSON.parse(result.accessToken) as JwtPayload
      expect(accessPayload.tokenType).toBe('access')
      expect(accessPayload.sub).toBe('u1')
      expect(accessPayload.jti).toBeUndefined()

      const refreshPayload = JSON.parse(result.refreshToken) as JwtPayload
      expect(refreshPayload.tokenType).toBe('refresh')
      expect(refreshPayload.sub).toBe('u1')
      expect(refreshPayload.jti).toBeDefined()
    })

    it('双密钥方案：access 用 accessSecretKey，refresh 用 refreshSecretKey', async () => {
      mockJwt.signAsync.mockImplementation(async (payload) => JSON.stringify(payload))

      await service.register({ username: 'alice123', password: 'secret123' })

      const calls = mockJwt.signAsync.mock.calls as [unknown, { secret?: string }][]
      const accessCall = calls.find((call) => (call[0] as JwtPayload).tokenType === 'access')
      const refreshCall = calls.find((call) => (call[0] as JwtPayload).tokenType === 'refresh')

      expect(accessCall?.[1]?.secret).toBe('access-secret')
      expect(refreshCall?.[1]?.secret).toBe('refresh-secret')
      expect(accessCall?.[1]?.secret).not.toBe(refreshCall?.[1]?.secret)
    })
  })
})
