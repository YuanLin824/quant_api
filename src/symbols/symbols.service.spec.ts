import { ConflictException } from '@nestjs/common'
import type { Repository } from 'typeorm'
import type { StockSdkService } from '../stock-sdk/stock-sdk.service'
import type { StockSymbol } from './entities/stock-symbol.entity'
import { SymbolsService } from './symbols.service'

describe('SymbolsService', () => {
  let service: SymbolsService
  let sdk: { getCodeList: jest.Mock }
  let qb: Record<string, jest.Mock>
  let repo: { count: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock }

  /** 收集所有写入过的行（跨分片、跨市场） */
  function writtenRows(): { market: string; code: string }[] {
    return qb.values.mock.calls.flatMap((call) => call[0] as { market: string; code: string }[])
  }

  beforeEach(() => {
    qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    }
    sdk = { getCodeList: jest.fn().mockResolvedValue([]) }
    repo = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => qb),
    }

    service = new SymbolsService(
      sdk as unknown as StockSdkService,
      repo as unknown as Repository<StockSymbol>
    )
  })

  describe('市场遍历', () => {
    it('依次同步 cn/hk/us/fund 四个市场', async () => {
      await service.syncAll()

      expect(sdk.getCodeList.mock.calls.map((call) => call[0].market)).toEqual([
        'cn',
        'hk',
        'us',
        'fund',
      ])
    })

    it('不传 simple，以取得带市场前缀的代码', async () => {
      await service.syncAll()

      expect(sdk.getCodeList).toHaveBeenCalledWith({ market: 'cn' })
    })

    it('单市场失败不影响其他市场，错误记在该市场结果上', async () => {
      sdk.getCodeList.mockImplementation(({ market }: { market: string }) =>
        market === 'hk' ? Promise.reject(new Error('上游超时')) : Promise.resolve(['sh600000'])
      )

      const summary = await service.syncAll()

      expect(summary.results).toHaveLength(4)
      expect(summary.results.find((r) => r.market === 'hk')?.error).toBe('上游超时')
      expect(summary.results.filter((r) => !r.error)).toHaveLength(3)
    })

    it('全部失败时仍返回完整汇总（不抛异常）', async () => {
      sdk.getCodeList.mockRejectedValue(new Error('数据源不可达'))

      const summary = await service.syncAll()

      expect(summary.results).toHaveLength(4)
      expect(summary.results.every((r) => r.error === '数据源不可达')).toBe(true)
    })
  })

  describe('写入', () => {
    /** 只让 cn 返回指定代码 */
    function onlyCn(codes: string[]) {
      sdk.getCodeList.mockImplementation(({ market }: { market: string }) =>
        Promise.resolve(market === 'cn' ? codes : [])
      )
    }

    it('代码原样入库（保留市场前缀）', async () => {
      onlyCn(['sh600000', 'sz000001', 'bj430047'])

      await service.syncAll()

      expect(
        writtenRows()
          .filter((row) => row.market === 'cn')
          .map((row) => row.code)
      ).toEqual(['sh600000', 'sz000001', 'bj430047'])
    })

    it('去重：同一批内重复的 code 只写一次', async () => {
      // 重复的冲突键会让 PG 报 "cannot affect row a second time" 并整批失败
      onlyCn(['sh600000', 'sh600000'])

      await service.syncAll()

      expect(writtenRows().filter((row) => row.code === 'sh600000')).toHaveLength(1)
    })

    it('超过分片大小时分批写入（2500 条 → 3 次 execute）', async () => {
      onlyCn(Array.from({ length: 2500 }, (_, i) => `sh${600000 + i}`))

      await service.syncAll()

      expect(qb.execute).toHaveBeenCalledTimes(3)
      for (const call of qb.values.mock.calls) {
        expect((call[0] as unknown[]).length).toBeLessThanOrEqual(1000)
      }
    })

    it('orUpdate 冲突键为 code，只覆盖 market', async () => {
      onlyCn(['sh600000'])

      await service.syncAll()

      expect(qb.orUpdate).toHaveBeenCalledWith(['market'], ['code'], {
        skipUpdateIfNoValuesChanged: true,
      })
    })

    it('上游返回空列表时不触发写库', async () => {
      await service.syncAll()

      expect(repo.createQueryBuilder).not.toHaveBeenCalled()
    })
  })

  describe('重入保护', () => {
    it('同步执行中再次调用抛 409', async () => {
      let release: () => void = () => {}
      sdk.getCodeList
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release = () => resolve([])
            })
        )
        .mockResolvedValue([])

      const first = service.syncAll()
      await expect(service.syncAll()).rejects.toBeInstanceOf(ConflictException)

      release()
      await first

      // 释放后应可再次同步
      await expect(service.syncAll()).resolves.toBeDefined()
    })
  })

  describe('查询', () => {
    it('按市场查询返回升序代码数组', async () => {
      repo.find.mockResolvedValue([{ code: 'sh600036' }, { code: 'sh600000' }])

      await expect(service.getByMarket('cn')).resolves.toEqual(['sh600036', 'sh600000'])
      expect(repo.find).toHaveBeenCalledWith({ where: { market: 'cn' }, order: { code: 'ASC' } })
    })

    it('统计返回各市场数量', async () => {
      repo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { market: 'cn', count: '5400' },
          { market: 'hk', count: '2600' },
        ]),
      })

      await expect(service.getStats()).resolves.toEqual({ cn: 5400, hk: 2600 })
    })
  })
})
