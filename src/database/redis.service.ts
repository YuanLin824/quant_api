import { Inject, Injectable } from '@nestjs/common'
import { REDIS_CLIENT, type IRedisClient } from './redis.module'

/**
 * Redis 服务封装
 *
 * 基于 ioredis 提供的 RedisClient 实例，封装常用操作。
 * 支持字符串读写、JSON 序列化、哈希操作和发布订阅。
 * TTL 参数统一为秒，与 ioredis EX 选项对齐。
 */
@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: IRedisClient) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  /** 写入字符串，ttlSeconds 为可选过期时间（秒） */
  async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds)
    } else {
      await this.redis.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  /**
   * 原子删除并返回是否实际删除（ioredis del 返回删除数量，1=存在已删，0=不存在）
   * 用于"检查存在性 + 删除"的原子合并——避免 exists 与 del 两步之间的并发竞态
   */
  async delIfExists(key: string): Promise<boolean> {
    return (await this.redis.del(key)) === 1
  }

  /** 自增并返回新值；首次自增（返回 1）时设置 TTL，实现滑动窗口过期 */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const value = await this.redis.incr(key)
    if (ttlSeconds && value === 1) {
      await this.redis.expire(key, ttlSeconds)
    }
    return value
  }

  /** 读取并反序列化 JSON */
  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key)
    return data ? JSON.parse(data) : null
  }

  /** 序列化为 JSON 后写入 */
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds)
  }

  /** 检查 key 是否存在（返回值 true/false，屏蔽 ioredis 的 0/1） */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key)
    return result === 1
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds)
  }

  // Hash 操作
  async hGet(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field)
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value)
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key)
  }

  async hDel(key: string, ...fields: string[]): Promise<void> {
    await this.redis.hdel(key, ...fields)
  }

  // 发布订阅
  async publish(channel: string, message: string): Promise<void> {
    await this.redis.publish(channel, message)
  }

  /** 获取原始 Redis 客户端实例（高级用法） */
  getClient(): IRedisClient {
    return this.redis
  }
}
