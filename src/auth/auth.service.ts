import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { compare, hash } from 'bcryptjs'
import { randomUUID } from 'crypto'
import { QueryFailedError, Repository } from 'typeorm'
import { CONFIG_MODULES } from '../config/constants'
import { IGlobalConfig } from '../config/global.config'
import { RedisService } from '../database/redis.service'
import { DeviceInfo, JwtPayload, TokenResult } from './auth.types'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { Users } from './entities/users.entity'

/** PG 唯一约束冲突错误码（注册防重兜底，业务层给出更友好的消息） */
const PG_UNIQUE_VIOLATION = '23505'

interface DeviceHeader {
  userAgent: string
  ip: string
}

/**
 * 认证服务：注册 / 登录 / 刷新 / 登出 + 多设备控制
 *
 * 多设备控制基于 Redis Hash：key = auth:devices:{userId}，field = refresh token 的 jti，
 * value = 设备信息 JSON { userAgent, ip, loginAt, expiresAt }。
 * - 不做 key 级 TTL（会让整个会话集合集体过期），改为条目内 expiresAt + 惰性清理
 * - 超限淘汰：先清过期条目，再淘汰 loginAt 最早者（踢出最早登录设备）
 * - refresh 每次轮换：旧 jti 立即从白名单移除，旧 token 重用即被 hGet 判空拦截
 */
@Injectable()
export class AuthService {
  private readonly globalConfig: IGlobalConfig

  constructor(
    @InjectRepository(Users) private readonly userRepo: Repository<Users>,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    configService: ConfigService
  ) {
    this.globalConfig = configService.get<IGlobalConfig>(CONFIG_MODULES.GLOBAL)!
  }

  /** 注册即登录：bcrypt 哈希入库，成功直接签发双 token */
  async register(dto: RegisterDto): Promise<TokenResult> {
    const user = new Users()
    user.username = dto.username
    user.password = await hash(dto.password, 12)

    try {
      await this.userRepo.save(user)
    } catch (err) {
      // 捕获唯一约束冲突而非先 findOne 预检：单次 DB 往返、无竞态
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('用户名已存在')
      }
      throw err
    }

    return this.generateTokensAndRecord(user, { userAgent: '', ip: '' })
  }

  /** 登录：校验密码后签发双 token 并登记设备；防时序攻击，密码比对使用恒定时间算法 */
  async login(dto: LoginDto, device: DeviceHeader): Promise<TokenResult> {
    // 账号锁定检查：连续失败 5 次则锁定 15 分钟
    const failKey = `auth:fail:${dto.username}`
    const fails = await this.redis.get(failKey)
    if (fails && parseInt(fails) >= 5) {
      const ttl = await this.redis.getClient().ttl(failKey)
      throw new ForbiddenException(`登录失败次数过多，账号已被临时锁定 ${ttl} 秒`)
    }

    // password 列设置了 select: false，此处显式选回用于比对
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
      select: { id: true, username: true, password: true, status: true },
    })

    // 用户不存在与密码错误统一消息，防止用户名枚举
    // bcrypt.compare 内部已实现恒定时间比对，确保用户不存在时也执行比对避免时序差异
    const dummyHash = '$2a$12$abcdefghijklmnopqrstuv1234567890123456789012345678'
    const passwordToCompare = user ? user.password : dummyHash
    const isPasswordValid = await compare(dto.password, passwordToCompare)

    if (!user || !isPasswordValid) {
      // 登录失败：递增失败计数，首次失败时设置 15 分钟 TTL
      await this.redis.incr(failKey, 900)
      throw new UnauthorizedException('用户名或密码错误')
    }
    if (user.status === 0) {
      throw new ForbiddenException('账号已被禁用')
    }

    // 登录成功：清除失败计数
    await this.redis.del(failKey)
    return this.generateTokensAndRecord(user, device)
  }

  /** 刷新令牌：校验 jti 白名单 → 轮换（旧 jti 作废）→ 签发新双 token */
  async refresh(payload: JwtPayload, device: DeviceHeader): Promise<TokenResult> {
    const key = this.deviceKey(payload.sub)
    const raw = await this.redis.hGet(key, payload.jti!)

    // 覆盖三类场景：已轮换的旧 token 重用、登出后刷新、伪造 jti
    if (!raw) {
      throw new UnauthorizedException('登录状态已失效, 请重新登录')
    }

    // 重查用户：刷新期间用户被删除/禁用立即生效
    const user = await this.userRepo.findOne({ where: { id: payload.sub } })
    if (!user) {
      throw new UnauthorizedException('登录状态已失效, 请重新登录')
    }
    if (user.status === 0) {
      throw new ForbiddenException('账号已被禁用')
    }

    let oldInfo: DeviceInfo
    try {
      oldInfo = JSON.parse(raw) as DeviceInfo
    } catch {
      oldInfo = { userAgent: '', ip: '', loginAt: 0, expiresAt: 0 }
    }

    // 轮换：先删旧 jti，再登记新会话（继承旧设备的 userAgent/ip/loginAt）
    await this.redis.hDel(key, payload.jti!)
    const { accessToken, refreshToken, jti } = await this.generateTokens(user)
    await this.recordDevice(payload.sub, jti, {
      userAgent: oldInfo.userAgent || device.userAgent,
      ip: oldInfo.ip || device.ip,
      loginAt: oldInfo.loginAt || Date.now(),
      expiresAt: Date.now() + this.globalConfig.refreshExpiresIn * 1000,
    })

    return { accessToken, refreshToken, username: user.username }
  }

  /**
   * 登出：吊销 refresh token
   *
   * 用 decode() 而非 verifyAsync()——已过期的 refresh token 无法验签，
   * 但同样需要能撤销；伪造 token decode 失败/字段缺失时静默返回（幂等）。
   */
  async logout(refreshToken: string): Promise<void> {
    const payload = this.jwtService.decode<JwtPayload>(refreshToken)
    if (!payload?.sub || !payload.jti) return
    await this.redis.hDel(this.deviceKey(payload.sub), payload.jti)
  }

  /** 当前用户信息（access token 保护，重查 DB 使删除/禁用即时生效） */
  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new UnauthorizedException('用户不存在或已注销')
    }
    if (user.status === 0) {
      throw new ForbiddenException('账号已被禁用')
    }
    return { id: user.id, username: user.username, createAt: user.createAt }
  }

  /** 签发双 token 并登记设备会话（登录/注册路径） */
  private async generateTokensAndRecord(user: Users, device: DeviceHeader): Promise<TokenResult> {
    const { accessToken, refreshToken, jti } = await this.generateTokens(user)
    await this.recordDevice(user.id, jti, {
      userAgent: device.userAgent,
      ip: device.ip,
      loginAt: Date.now(),
      expiresAt: Date.now() + this.globalConfig.refreshExpiresIn * 1000,
    })
    return { accessToken, refreshToken, username: user.username }
  }

  /** 签发双 token；access 无状态（无 jti），refresh 携带 jti 作为会话吊销依据；双密钥各自签名 */
  private async generateTokens(user: Users): Promise<TokenResult & { jti: string }> {
    const jti = randomUUID()
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, username: user.username, tokenType: 'access' },
        {
          secret: this.globalConfig.accessSecretKey,
          expiresIn: this.globalConfig.accessExpiresIn,
        }
      ),
      this.jwtService.signAsync(
        { sub: user.id, username: user.username, tokenType: 'refresh', jti },
        {
          secret: this.globalConfig.refreshSecretKey,
          expiresIn: this.globalConfig.refreshExpiresIn,
        }
      ),
    ])
    return { accessToken, refreshToken, username: user.username, jti }
  }

  /**
   * 登记设备会话（登录/注册/刷新共用）
   *
   * 1. 惰性清理过期条目（expiresAt 已过 / JSON 脏数据）
   * 2. 仍超限则淘汰 loginAt 最早者（踢出最早登录设备），直到 < maxDevices
   * 3. 写入新会话
   */
  private async recordDevice(userId: string, jti: string, info: DeviceInfo): Promise<void> {
    const key = this.deviceKey(userId)
    const maxDevices = Math.max(1, this.globalConfig.maxDevices)
    const entries = await this.redis.hGetAll(key)

    const now = Date.now()
    for (const [field, raw] of Object.entries(entries)) {
      let device: DeviceInfo | null
      try {
        device = JSON.parse(raw) as DeviceInfo
      } catch {
        device = null
      }
      if (!device || device.expiresAt <= now) {
        await this.redis.hDel(key, field)
        delete entries[field]
      }
    }

    while (Object.keys(entries).length >= maxDevices) {
      const oldest = Object.entries(entries).reduce<[string, DeviceInfo] | null>(
        (min, [field, raw]) => {
          const cur = JSON.parse(raw) as DeviceInfo
          return !min || cur.loginAt < min[1].loginAt ? [field, cur] : min
        },
        null
      )
      if (!oldest) break
      await this.redis.hDel(key, oldest[0])
      delete entries[oldest[0]]
    }

    await this.redis.hSet(key, jti, JSON.stringify(info))
  }

  private deviceKey(userId: string): string {
    return `auth:devices:${userId}`
  }
}
