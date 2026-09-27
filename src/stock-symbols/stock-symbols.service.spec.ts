import { Logger } from '@nestjs/common'
import { FindOperator, type FindManyOptions, type Repository } from 'typeorm'
import type { ApiThsService } from '../api-ths/api-ths.service'
import type { ThsTickerItem } from '../api-ths/api-ths.types'
import type { StockSymbol } from './entities/stock-symbol.entity'
import { STOCK_SYMBOLS_UPSERT_CHUNK_SIZE } from './stock-symbols.constants'
import { StockSymbolsService } from './stock-symbols.service'

/** 生成 n 条上游标的 */
function makeItems(n: number, assetType = 'a-share'): ThsTickerItem[] {
  return Array.from({ length: n }, (_, i) => ({
    thscode: `${600000 + i}.SH`,
    ticker: `${600000 + i}`,
    name: `标的${i}`,
    exchange: 'SH',
    asset_type: assetType,
    currency: 'CNY',
    list_date: '2020-01-01',
    end_date: null,
    last_trade_date: null,
    last_delivery_date: null,
  }))
}

describe('StockSymbolsService', () => {
  let service: StockSymbolsService
  const mockManager = {
    upsert: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  }
  /** getSyncStatus 用的 QueryBuilder 链 */
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  }
  const mockRepo = {
    count: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    manager: {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(mockManager)),
    },
  }
  const mockThsApi = { getAllTickers: jest.fn() }

  /** 取出第 index 次 upsert 的实体数组 */
  const upsertBatch = (index = 0): Partial<StockSymbol>[] =>
    mockManager.upsert.mock.calls[index][1] as Partial<StockSymbol>[]

  /** 取出第 index 次 update 的查询条件 */
  const updateCriteria = (index = 0): Record<string, unknown> =>
    mockManager.update.mock.calls[index][1] as Record<string, unknown>

  beforeEach(() => {
    jest.clearAllMocks()
    Logger.overrideLogger(false)
    mockManager.update.mockResolvedValue({ affected: 0 })
    mockManager.count.mockResolvedValue(0)
    mockRepo.count.mockResolvedValue(1) // 默认：存量小，量级护栏放行（护栏本身由专门用例覆盖）
    service = new StockSymbolsService(
      mockRepo as unknown as Repository<StockSymbol>,
      mockThsApi as unknown as ApiThsService
    )
  })

  describe('syncSymbols', () => {
    it('正常同步：只拉一次两类、写入 delistedAt=null 且不碰 status', async () => {
      mockThsApi.getAllTickers.mockResolvedValue(makeItems(2))

      const result = await service.syncSymbols()

      expect(mockThsApi.getAllTickers).toHaveBeenCalledTimes(1)
      expect(mockThsApi.getAllTickers).toHaveBeenCalledWith(['a-share', 'a-share-index'])
      expect(result).toMatchObject({ fetched: 2, skipped: false })

      const row = upsertBatch()[0]
      expect(row.thscode).toBe('600000.SH')
      expect(row.assetType).toBe('a-share')
      expect(row.delistedAt).toBeNull()
      expect(row.syncAt).toBeInstanceOf(Date)
      // 上游字段全量映射：漏掉任何一个都说明同步不完整
      expect(Object.keys(row).sort()).toEqual([
        'assetType',
        'currency',
        'delistedAt',
        'endDate',
        'exchange',
        'lastDeliveryDate',
        'lastTradeDate',
        'listDate',
        'name',
        'syncAt',
        'thscode',
        'ticker',
      ])
      // 冲突键与主键一致（thscode 既是主键也是 upsert 的冲突目标）
      expect(mockManager.upsert.mock.calls[0][2]).toEqual(['thscode'])
    })

    it('按分片大小分批 upsert，避免超出 PostgreSQL 绑定参数上限', async () => {
      mockThsApi.getAllTickers.mockResolvedValue(makeItems(STOCK_SYMBOLS_UPSERT_CHUNK_SIZE + 5))

      await service.syncSymbols()

      expect(mockManager.upsert).toHaveBeenCalledTimes(2)
      expect(upsertBatch(0)).toHaveLength(STOCK_SYMBOLS_UPSERT_CHUNK_SIZE)
      expect(upsertBatch(1)).toHaveLength(5)
    })

    it('两段式标记：先全量置 delistedAt，再由 upsert 把本轮返回的置回 null', async () => {
      mockThsApi.getAllTickers.mockResolvedValue(makeItems(1))
      mockManager.count.mockResolvedValue(7)

      const result = await service.syncSymbols()

      const criteria = updateCriteria()
      expect(criteria.assetType).toBeDefined()
      expect(criteria.delistedAt).toBeDefined()

      // 顺序：标记必须先于 upsert，否则本轮返回的标的会被误标
      const updateOrder = mockManager.update.mock.invocationCallOrder[0]
      const upsertOrder = mockManager.upsert.mock.invocationCallOrder[0]
      expect(updateOrder).toBeLessThan(upsertOrder)

      // 消失数取自事务后的精确统计
      expect(result.deactivated).toBe(7)
    })

    it('空结果保护：上游返回空列表时不写库，避免把全表标的误标为已消失', async () => {
      mockThsApi.getAllTickers.mockResolvedValue([])

      const result = await service.syncSymbols()

      expect(result).toMatchObject({ fetched: 0, deactivated: 0 })
      expect(mockManager.upsert).not.toHaveBeenCalled()
      expect(mockManager.update).not.toHaveBeenCalled()
      expect(mockRepo.manager.transaction).not.toHaveBeenCalled()
    })

    it('量级护栏：返回量不足存量一半时只写入、不标记消失', async () => {
      mockRepo.count.mockResolvedValue(10_000) // 存量活跃 1 万
      mockThsApi.getAllTickers.mockResolvedValue(makeItems(100)) // 仅返回 100

      const result = await service.syncSymbols()

      expect(mockManager.upsert).toHaveBeenCalled()
      expect(mockManager.update).not.toHaveBeenCalled()
      expect(result.deactivated).toBe(0)
    })

    it('忽略同步范围外的资产类型，不写进表', async () => {
      mockThsApi.getAllTickers.mockResolvedValue([...makeItems(2), ...makeItems(1, 'futures')])

      const result = await service.syncSymbols()

      expect(result.fetched).toBe(2)
      expect(upsertBatch()[0].assetType).toBe('a-share')
    })

    it('上游异常向上传播，且不写库', async () => {
      mockThsApi.getAllTickers.mockRejectedValue(new Error('上游限流'))

      await expect(service.syncSymbols()).rejects.toThrow('上游限流')
      expect(mockManager.upsert).not.toHaveBeenCalled()
    })

    it('异常后释放防重入标志，后续调用仍可进行', async () => {
      mockThsApi.getAllTickers.mockRejectedValueOnce(new Error('上游限流'))
      await expect(service.syncSymbols()).rejects.toThrow('上游限流')

      mockThsApi.getAllTickers.mockResolvedValue(makeItems(1))
      await expect(service.syncSymbols()).resolves.toMatchObject({ fetched: 1 })
    })

    it('并发调用：后者返回 skipped，且不重复拉取上游', async () => {
      let releaseFetch!: (items: ThsTickerItem[]) => void
      mockThsApi.getAllTickers.mockReturnValue(
        new Promise<ThsTickerItem[]>((resolve) => {
          releaseFetch = resolve
        })
      )

      const first = service.syncSymbols()
      const second = await service.syncSymbols()

      expect(second).toMatchObject({ skipped: true, fetched: 0 })
      expect(mockThsApi.getAllTickers).toHaveBeenCalledTimes(1)

      releaseFetch(makeItems(1))
      await first
    })
  })

  describe('getSyncStatus（同步状态概要）', () => {
    beforeEach(() => {
      mockQueryBuilder.getRawOne.mockResolvedValue({
        lastSyncAt: new Date('2026-09-27T15:16:21.000Z'),
      })
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { assetType: 'a-share', total: 5578, active: 5578 },
        { assetType: 'a-share-index', total: 1431, active: 1430 },
      ])
    })

    it('汇总总数、活跃数与最后同步时间', async () => {
      const status = await service.getSyncStatus()

      expect(status.total).toBe(7009)
      expect(status.activeTotal).toBe(7008)
      expect(status.lastSyncAt).toEqual(new Date('2026-09-27T15:16:21.000Z'))
      expect(status.syncing).toBe(false)
      expect(status.byAssetType).toHaveLength(2)
    })

    it('表为空时 lastSyncAt 为 null、计数为 0', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue(undefined)
      mockQueryBuilder.getRawMany.mockResolvedValue([])

      const status = await service.getSyncStatus()

      expect(status.lastSyncAt).toBeNull()
      expect(status.total).toBe(0)
      expect(status.activeTotal).toBe(0)
      expect(status.byAssetType).toEqual([])
    })

    it('同步进行中时 syncing 为 true', async () => {
      let releaseFetch!: (items: ThsTickerItem[]) => void
      mockThsApi.getAllTickers.mockReturnValue(
        new Promise<ThsTickerItem[]>((resolve) => {
          releaseFetch = resolve
        })
      )

      const inFlight = service.syncSymbols()
      const status = await service.getSyncStatus()

      expect(status.syncing).toBe(true)

      releaseFetch([])
      await inFlight
    })
  })

  describe('findSymbols（分页查询）', () => {
    /** 取出第 index 次 findAndCount 的查询选项 */
    const queryOptions = (index = 0): FindManyOptions<StockSymbol> =>
      mockRepo.findAndCount.mock.calls[index][0] as FindManyOptions<StockSymbol>

    beforeEach(() => {
      mockRepo.findAndCount.mockResolvedValue([[{ thscode: '600000.SH' }], 1])
    })

    it('默认只返回在市标的，并按 thscode 升序分页', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 7009])

      const result = await service.findSymbols({})

      const options = queryOptions()
      const where = options.where as Record<string, unknown>
      expect(where.delistedAt).toBeInstanceOf(FindOperator) // IsNull()
      expect(options.order).toEqual({ thscode: 'ASC' })
      expect(options.skip).toBe(0)
      expect(options.take).toBe(20)
      expect(result).toEqual({ total: 7009, page: 1, pageSize: 20, items: [] })
    })

    it('页码换算为 skip，pageSize 透传', async () => {
      await service.findSymbols({ page: 3, pageSize: 50 })

      expect(queryOptions().skip).toBe(100)
      expect(queryOptions().take).toBe(50)
    })

    it('按 assetType 过滤', async () => {
      await service.findSymbols({ assetType: 'a-share-index' })

      expect((queryOptions().where as Record<string, unknown>).assetType).toBe('a-share-index')
    })

    it('includeDelisted=true 时不加退市过滤条件', async () => {
      await service.findSymbols({ includeDelisted: true })

      expect((queryOptions().where as Record<string, unknown>).delistedAt).toBeUndefined()
    })

    it('关键词走 OR 条件（thscode 或 name），并转义 LIKE 通配符', async () => {
      await service.findSymbols({ keyword: '50%_' })

      const where = queryOptions().where as Record<string, unknown>[]
      expect(Array.isArray(where)).toBe(true)
      expect(where).toHaveLength(2)
      // % 与 _ 必须被转义，否则用户输入会退化成「匹配全部」
      expect((where[0].thscode as FindOperator<unknown>).value).toBe('%50\\%\\_%')
      expect((where[1].name as FindOperator<unknown>).value).toBe('%50\\%\\_%')
    })
  })

  describe('onApplicationBootstrap（首次补齐）', () => {
    it('表为空时触发同步', async () => {
      mockRepo.count.mockResolvedValue(0)
      mockThsApi.getAllTickers.mockResolvedValue(makeItems(2))

      service.onApplicationBootstrap()
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockThsApi.getAllTickers).toHaveBeenCalledTimes(1)
    })

    it('表非空时不触发同步（后续重启不再拉取）', async () => {
      mockRepo.count.mockResolvedValue(6500)

      service.onApplicationBootstrap()
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockThsApi.getAllTickers).not.toHaveBeenCalled()
    })
  })
})
