// 本 spec 是本仓库唯一真正执行「带装饰器的类」的用例：
// 其余 spec 都用 `import type` 引用 DTO/实体，模块体不执行，故一直没暴露
// Jest 环境缺 reflect-metadata 的问题（class-transformer 的 @Type 需要它）
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import 'reflect-metadata'
import { SearchStockQueryDto } from './search-stock.dto'

/**
 * 走一遍校验管道（先转换再校验），与 `AppSetup` 里 ValidationPipe 的
 * `transform: true` 行为一致
 */
async function check(raw: Record<string, unknown>) {
  const dto = plainToInstance(SearchStockQueryDto, raw)
  const errors = await validate(dto)
  return { dto, properties: errors.map((error) => error.property) }
}

describe('SearchStockQueryDto', () => {
  describe('type 的逗号分隔', () => {
    it('`stock,bond` 拆成数组', async () => {
      const { dto, properties } = await check({ keyword: '兴业', type: 'stock,bond' })

      expect(properties).toEqual([])
      expect(dto.type).toEqual(['stock', 'bond'])
    })

    it('重复参数（数组形式）与逗号分隔等价', async () => {
      // Nest 对 `?type=stock&type=bond` 给的是数组，两种写法都应接受
      const { dto, properties } = await check({ keyword: '兴业', type: ['stock', 'bond'] })

      expect(properties).toEqual([])
      expect(dto.type).toEqual(['stock', 'bond'])
    })

    it('分隔符两侧的空白被裁掉、空项被丢弃', async () => {
      const { dto, properties } = await check({ keyword: '兴业', type: ' stock , , bond ' })

      expect(properties).toEqual([])
      expect(dto.type).toEqual(['stock', 'bond'])
    })

    it('含非法取值时报错', async () => {
      const { properties } = await check({ keyword: '兴业', type: 'stock,xxx' })

      expect(properties).toContain('type')
    })
  })

  describe('其余参数', () => {
    it('keyword 为空时报错', async () => {
      expect((await check({ keyword: '' })).properties).toContain('keyword')
      expect((await check({})).properties).toContain('keyword')
    })

    it('market 限定取值', async () => {
      expect((await check({ keyword: '腾讯', market: 'hk' })).properties).toEqual([])
      expect((await check({ keyword: '腾讯', market: 'xx' })).properties).toContain('market')
    })

    it('limit / offset 由查询串转成数字并校验范围', async () => {
      const { dto, properties } = await check({ keyword: '腾讯', limit: '5', offset: '2' })

      expect(properties).toEqual([])
      expect(dto.limit).toBe(5)
      expect(dto.offset).toBe(2)

      expect((await check({ keyword: '腾讯', limit: '0' })).properties).toContain('limit')
      expect((await check({ keyword: '腾讯', limit: '101' })).properties).toContain('limit')
      expect((await check({ keyword: '腾讯', offset: '-1' })).properties).toContain('offset')
    })
  })
})
