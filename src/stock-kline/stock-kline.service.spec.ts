import { Logger } from '@nestjs/common'
import type { Repository } from 'typeorm'
import type { ApiTdxService } from '../api-tdx/api-tdx.service'
import type { StockSymbol } from '../stock-symbols/entities/stock-symbol.entity'
import type { StockKline } from './entities/stock-kline.entity'
import { StockKlineService } from './stock-kline.service'

/** 固定「当前时刻」（本地构造：2026-10-09 09:00），让日 K 自适应回取根数可精确断言 */
const NOW = new Date(2026, 9, 9, 9, 0, 0).getTime()

/**
 * 构造通达信 K 线
 *
 * `time` 由库以本地时区构造函数拼出（字段值即中国墙钟时间）；
 * 日 K 约定为当日 15:00，分钟 K 为该根起始时刻。
 */
function makeTdxBar(time: Date, volume = 100) {
  return { time, open: 1290, high: 1310, low: 1280, close: 1300, volume, amount: 100000000 }
}

/** 可链式调用的 QueryBuilder 假件（select 链与 delete 链共用形状） */
function makeBuilder(): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    delete: jest.fn(),
    from: jest.fn(),
    getRawMany: jest.fn(),
    execute: jest.fn(),
  }
  for (const method of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'orderBy',
    'limit',
  ]) {
    builder[method].mockReturnValue(builder)
  }
  builder.delete.mockReturnValue(builder)
  builder.from.mockReturnValue(builder)
  builder.getRawMany.mockResolvedValue([])
  builder.execute.mockResolvedValue({ affected: 0 })
  return builder
}

describe('StockKlineService', () => {
  let service: StockKlineService
  const klineRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    upsert: jest.fn(),
    createQueryBuilder: jest.fn(),
  }
  const symbolRepo = { find: jest.fn() }
  const tdxApi = { getKlines: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    Logger.overrideLogger(false)
    klineRepo.upsert.mockResolvedValue(undefined)

    service = new StockKlineService(
      klineRepo as unknown as Repository<StockKline>,
      symbolRepo as unknown as Repository<StockSymbol>,
      tdxApi as unknown as ApiTdxService
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('syncDailyKlines（日 K 同步）', () => {
    it('标的列表为空时跳过本轮且不写库', async () => {
      symbolRepo.find.mockResolvedValue([])

      const result = await service.syncDailyKlines()

      expect(result).toMatchObject({ symbols: 0, rows: 0, skipped: false })
      expect(tdxApi.getKlines).not.toHaveBeenCalled()
      expect(klineRepo.upsert).not.toHaveBeenCalled()
    })

    it('无记录回补 250 根；有记录按「间隔自然日 × 5/7 + 余量」自适应回取', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(NOW)
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }, { thscode: '000001.SZ' }])
      const builder = makeBuilder()
      builder.getRawMany.mockResolvedValue([{ thscode: '600519.SH', lastDate: '20261008' }])
      klineRepo.createQueryBuilder.mockReturnValue(builder)
      tdxApi.getKlines.mockResolvedValue([])

      await service.syncDailyKlines()

      // 20261008 00:00 → NOW（次日 09:00）间隔 33 小时，向上取整 2 天 → ceil(2×5/7)=2 → +10 余量 = 12 根
      expect(tdxApi.getKlines).toHaveBeenCalledWith({
        thscode: '600519.SH',
        category: 'day',
        count: 12,
      })
      expect(tdxApi.getKlines).toHaveBeenCalledWith({
        thscode: '000001.SZ',
        category: 'day',
        count: 250,
      })
    })

    it('行转换：日 K 为 yyyyMMdd，成交量由「手」换算为「股」', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      klineRepo.createQueryBuilder.mockReturnValue(makeBuilder())
      tdxApi.getKlines.mockResolvedValue([makeTdxBar(new Date(2026, 9, 8, 15, 0), 100)])

      await service.syncDailyKlines()

      expect(klineRepo.upsert).toHaveBeenCalledWith(
        [
          {
            thscode: '600519.SH',
            category: 'day',
            datetime: '20261008',
            openPrice: 1290,
            highPrice: 1310,
            lowPrice: 1280,
            closePrice: 1300,
            volume: 10000, // 100 手 × 100
            amount: 100000000,
          },
        ],
        { conflictPaths: ['thscode', 'category', 'datetime'], skipUpdateIfNoValuesChanged: true }
      )
    })

    it('单只失败不中断整轮，其余标的照常写入', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }, { thscode: '000001.SZ' }])
      klineRepo.createQueryBuilder.mockReturnValue(makeBuilder())
      tdxApi.getKlines
        .mockRejectedValueOnce(new Error('socket closed'))
        .mockResolvedValueOnce([makeTdxBar(new Date(2026, 9, 8, 15, 0))])

      const result = await service.syncDailyKlines()

      expect(result).toMatchObject({ symbols: 2, succeeded: 1, failed: 1, rows: 1 })
      expect(klineRepo.upsert).toHaveBeenCalledWith(
        [expect.objectContaining({ thscode: '000001.SZ', datetime: '20261008' })],
        expect.anything()
      )
    })

    it('缓冲超过分片阈值时按 1000 行分批 upsert', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      klineRepo.createQueryBuilder.mockReturnValue(makeBuilder())
      tdxApi.getKlines.mockResolvedValue(
        Array.from({ length: 2500 }, (_, i) => makeTdxBar(new Date(2026, 9, 8 - i, 15, 0)))
      )

      const result = await service.syncDailyKlines()

      expect(result.rows).toBe(2500)
      expect(klineRepo.upsert).toHaveBeenCalledTimes(3)
      expect(klineRepo.upsert.mock.calls.map((call) => (call[0] as unknown[]).length)).toEqual([
        1000, 1000, 500,
      ])
    })

    it('批内主键重复时先去重（同批重复冲突键会让整个分片写入失败）', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      klineRepo.createQueryBuilder.mockReturnValue(makeBuilder())
      const bar = makeTdxBar(new Date(2026, 9, 8, 15, 0))
      tdxApi.getKlines.mockResolvedValue([bar, { ...bar }])

      await service.syncDailyKlines()

      expect(klineRepo.upsert).toHaveBeenCalledTimes(1)
      expect((klineRepo.upsert.mock.calls[0][0] as unknown[]).length).toBe(1)
    })

    it('开局连续失败达阈值即中止本轮（疑似上游整体不可用）', async () => {
      symbolRepo.find.mockResolvedValue(
        Array.from({ length: 25 }, (_, i) => ({ thscode: `0000${i}.SZ` }))
      )
      klineRepo.createQueryBuilder.mockReturnValue(makeBuilder())
      tdxApi.getKlines.mockRejectedValue(new Error('socket closed'))

      const result = await service.syncDailyKlines()

      expect(tdxApi.getKlines).toHaveBeenCalledTimes(20)
      expect(result).toMatchObject({ succeeded: 0, failed: 20 })
    })

    it('同步进行中重入 → 跳过而非抛异常', async () => {
      symbolRepo.find.mockResolvedValue([])

      const first = service.syncDailyKlines()
      const second = await service.syncDailyKlines()

      expect(second.skipped).toBe(true)
      await first
    })
  })

  describe('syncMinuteKlines（分钟 K 同步 + 清理）', () => {
    it('五个周期按窗口表逐窗口取数（1m 拆两个窗口）', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      tdxApi.getKlines.mockResolvedValue([])

      const result = await service.syncMinuteKlines()

      expect(tdxApi.getKlines.mock.calls.map((call) => call[0])).toEqual([
        { thscode: '600519.SH', category: '1m', start: 0, count: 800 },
        { thscode: '600519.SH', category: '1m', start: 800, count: 400 },
        { thscode: '600519.SH', category: '5m', start: 0, count: 240 },
        { thscode: '600519.SH', category: '15m', start: 0, count: 80 },
        { thscode: '600519.SH', category: '30m', start: 0, count: 40 },
        { thscode: '600519.SH', category: '60m', start: 0, count: 20 },
      ])
      expect(result).toMatchObject({ symbols: 1, succeeded: 1, failed: 0, rows: 0 })
      // 本轮一根未取到 → 跳过清理（createQueryBuilder 一次都不该发生）
      expect(klineRepo.createQueryBuilder).not.toHaveBeenCalled()
    })

    it('行转换：时间按本地字段拼 yyyyMMddHHmm，成交量由「手」换算为「股」', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      tdxApi.getKlines
        .mockResolvedValueOnce([makeTdxBar(new Date(2026, 9, 8, 9, 31), 100)])
        .mockResolvedValue([])

      await service.syncMinuteKlines()

      expect(klineRepo.upsert).toHaveBeenCalledWith(
        [
          {
            thscode: '600519.SH',
            category: '1m',
            datetime: '202610080931',
            openPrice: 1290,
            highPrice: 1310,
            lowPrice: 1280,
            closePrice: 1300,
            volume: 10000, // 100 手 × 100
            amount: 100000000,
          },
        ],
        { conflictPaths: ['thscode', 'category', 'datetime'], skipUpdateIfNoValuesChanged: true }
      )
    })

    it('单窗口失败只计数不中断，其余窗口照常取数', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      tdxApi.getKlines.mockRejectedValue(new Error('socket closed'))

      const result = await service.syncMinuteKlines()

      expect(tdxApi.getKlines).toHaveBeenCalledTimes(6)
      expect(result).toMatchObject({ symbols: 1, succeeded: 0, failed: 1 })
    })

    it('开局连续失败达阈值即中止本轮（疑似上游整体不可用）', async () => {
      symbolRepo.find.mockResolvedValue(
        Array.from({ length: 25 }, (_, i) => ({ thscode: `0000${i}.SZ` }))
      )
      tdxApi.getKlines.mockRejectedValue(new Error('socket closed'))

      const result = await service.syncMinuteKlines()

      expect(tdxApi.getKlines).toHaveBeenCalledTimes(120) // 20 只 × 6 个窗口
      expect(result).toMatchObject({ succeeded: 0, failed: 20 })
    })

    it('同步产出后清理：以保留窗左边界为界删除更早的分钟行', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      tdxApi.getKlines.mockResolvedValue([makeTdxBar(new Date(2026, 9, 8, 9, 31))])
      const selectBuilder = makeBuilder()
      selectBuilder.getRawMany.mockResolvedValue([
        { date: '20261009' },
        { date: '20261008' },
        { date: '20260930' },
        { date: '20260929' },
        { date: '20260928' },
      ])
      const deleteBuilder = makeBuilder()
      klineRepo.createQueryBuilder
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(deleteBuilder)

      await service.syncMinuteKlines()

      expect(selectBuilder.limit).toHaveBeenCalledWith(5)
      expect(deleteBuilder.where).toHaveBeenCalledWith('category IN (:...categories)', {
        categories: ['1m', '5m', '15m', '30m', '60m'],
      })
      expect(deleteBuilder.andWhere).toHaveBeenCalledWith('datetime < :cutoff', {
        cutoff: '202609280000',
      })
    })

    it('保留窗口不足 5 个交易日时不做清理', async () => {
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      tdxApi.getKlines.mockResolvedValue([makeTdxBar(new Date(2026, 9, 8, 9, 31))])
      const selectBuilder = makeBuilder()
      selectBuilder.getRawMany.mockResolvedValue([{ date: '20261009' }])
      klineRepo.createQueryBuilder.mockReturnValueOnce(selectBuilder)

      await service.syncMinuteKlines()

      // 只发起了保留窗查询，没有 delete 链（第二次 createQueryBuilder）
      expect(klineRepo.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it('同步进行中重入 → 跳过而非抛异常', async () => {
      symbolRepo.find.mockResolvedValue([])

      const first = service.syncMinuteKlines()
      const second = await service.syncMinuteKlines()

      expect(second.skipped).toBe(true)
      await first
    })
  })

  describe('findKlines（查询）', () => {
    it('默认日 K、按 datetime 升序分页，未给日期时不过滤区间', async () => {
      klineRepo.findAndCount.mockResolvedValue([[{ datetime: '20261008' }], 1])

      const result = await service.findKlines({ thscode: '600519.SH' })

      expect(klineRepo.findAndCount).toHaveBeenCalledWith({
        where: { thscode: '600519.SH', category: 'day' },
        order: { datetime: 'ASC' },
        skip: 0,
        take: 500,
      })
      expect(result).toEqual({
        total: 1,
        page: 1,
        pageSize: 500,
        items: [{ datetime: '20261008' }],
      })
    })

    it('日期边界按类别构造：日 K 用 8 位，分钟 K 补 0000 / 2359', async () => {
      klineRepo.findAndCount.mockResolvedValue([[], 0])

      await service.findKlines({ thscode: '600519.SH', start: '20260101', end: '20261231' })
      await service.findKlines({
        thscode: '600519.SH',
        category: '5m',
        start: '20260101',
        end: '20261231',
      })

      expect(klineRepo.findAndCount).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            datetime: expect.objectContaining({ value: ['20260101', '20261231'] }),
          }),
        })
      )
      expect(klineRepo.findAndCount).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            datetime: expect.objectContaining({ value: ['202601010000', '202612312359'] }),
          }),
        })
      )
    })

    it('只给 start 用 >= 边界、只给 end 用 <= 边界（分钟类别同样补零）', async () => {
      klineRepo.findAndCount.mockResolvedValue([[], 0])

      await service.findKlines({ thscode: '600519.SH', start: '20260101' })
      await service.findKlines({ thscode: '600519.SH', category: '1m', end: '20261231' })

      expect(klineRepo.findAndCount).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            datetime: expect.objectContaining({ type: 'moreThanOrEqual', value: '20260101' }),
          }),
        })
      )
      expect(klineRepo.findAndCount).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            datetime: expect.objectContaining({ type: 'lessThanOrEqual', value: '202612312359' }),
          }),
        })
      )
    })

    it('分页参数换算为 skip / take', async () => {
      klineRepo.findAndCount.mockResolvedValue([[], 0])

      await service.findKlines({ thscode: '600519.SH', page: 3, pageSize: 200 })

      expect(klineRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 400, take: 200 })
      )
    })
  })

  describe('onApplicationBootstrap（启动补齐）', () => {
    it('两表均有数据时不触发任何同步', async () => {
      klineRepo.findOne.mockResolvedValue({ thscode: '600519.SH' })

      service.onApplicationBootstrap()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(tdxApi.getKlines).not.toHaveBeenCalled()
    })

    it('日 K 表为空时只补日 K（分钟表有数据）', async () => {
      klineRepo.findOne
        .mockResolvedValueOnce(null) // 日 K 判空：空
        .mockResolvedValueOnce({ thscode: '600519.SH' }) // 分钟判空：有数据
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      klineRepo.createQueryBuilder.mockReturnValue(makeBuilder())
      tdxApi.getKlines.mockResolvedValue([])

      service.onApplicationBootstrap()
      await new Promise((resolve) => setTimeout(resolve, 0))

      // 只发起了日 K 的一次取数（分钟同步的 6 次窗口调用不应出现）
      expect(tdxApi.getKlines).toHaveBeenCalledTimes(1)
      expect(tdxApi.getKlines).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'day', count: 250 })
      )
    })

    it('分钟 K 表为空时只补分钟 K（日 K 表有数据）', async () => {
      klineRepo.findOne
        .mockResolvedValueOnce({ thscode: '600519.SH' }) // 日 K 判空：有数据
        .mockResolvedValueOnce(null) // 分钟判空：空
      symbolRepo.find.mockResolvedValue([{ thscode: '600519.SH' }])
      tdxApi.getKlines.mockResolvedValue([])

      service.onApplicationBootstrap()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(tdxApi.getKlines).toHaveBeenCalledTimes(6)
      expect(tdxApi.getKlines).not.toHaveBeenCalledWith(
        expect.objectContaining({ category: 'day' })
      )
    })
  })
})
