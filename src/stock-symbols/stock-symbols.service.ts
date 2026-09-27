import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, ILike, In, IsNull, Repository } from 'typeorm'
import { ApiThsService } from '../api-ths/api-ths.service'
import type { ThsTickerItem } from '../api-ths/api-ths.types'
import { StockSymbolQueryDto } from './dto/stock-symbol-query.dto'
import { StockSymbol } from './entities/stock-symbol.entity'
import {
  STOCK_SYMBOLS_ASSET_TYPES,
  STOCK_SYMBOLS_MIN_KEEP_RATIO,
  STOCK_SYMBOLS_QUERY_DEFAULT_PAGE_SIZE,
  STOCK_SYMBOLS_UPSERT_CHUNK_SIZE,
} from './stock-symbols.constants'

/** 分页查询结果 */
export interface StockSymbolPage {
  /** 符合条件的总条数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 当前页数据 */
  items: StockSymbol[]
}

/** 按资产类型的标的分布 */
export interface StockSymbolsAssetTypeStat {
  /** 资产类型 */
  assetType: string
  /** 该类型的全部标的数（含已退市） */
  total: number
  /** 该类型仍在市的标的数 */
  active: number
}

/** 同步状态概要 */
export interface StockSymbolsSyncStatus {
  /** 最后一次同步完成的时间；表为空时为 null */
  lastSyncAt: Date | null
  /** 标的表总行数 */
  total: number
  /** 仍在市（`delistedAt` 为 NULL）的标的数 */
  activeTotal: number
  /** 当前是否有同步正在进行 */
  syncing: boolean
  /** 按资产类型的分布 */
  byAssetType: StockSymbolsAssetTypeStat[]
}

/** 单次同步的结果统计 */
export interface StockSymbolsSyncResult {
  /** 上游返回且在同步范围内的标的数 */
  fetched: number
  /** 本轮被标记为「已消失」的标的数 */
  deactivated: number
  /** 是否因上一轮同步尚未结束而整体跳过 */
  skipped: boolean
  /** 耗时（毫秒） */
  costMs: number
}

/**
 * 标的代码表服务
 *
 * 从同花顺拉取个股与指数/板块的代码表并落库，供其他模块使用。
 * 同步采用增量写入：以 thscode 为唯一键 upsert（行的 id 跨轮次保持稳定），
 * 上游本轮未返回的标的不会被删除，而是置 `delistedAt` 标记为「已消失」。
 */
@Injectable()
export class StockSymbolsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StockSymbolsService.name)

  /** 防重入标志：定时触发、启动补齐、手动调用三者共用 */
  private syncing = false

  constructor(
    @InjectRepository(StockSymbol) private readonly symbolRepo: Repository<StockSymbol>,
    private readonly thsApi: ApiThsService
  ) {}

  /** 表为空时补齐首次数据（仅首次部署命中；不 await，避免启动被外部 API 拖住） */
  onApplicationBootstrap(): void {
    void this.fillIfEmpty()
  }

  /**
   * 从同花顺同步标的代码表并落库
   *
   * 由 `StockSymbolsSchedule` 定时触发，也可手动调用。
   * 网络请求刻意放在事务外：一次 sweep 最坏几十秒，放进事务会长时间占用连接池。
   */
  async syncSymbols(): Promise<StockSymbolsSyncResult> {
    if (this.syncing) {
      this.logger.warn({ message: '标的同步已在进行中, 本轮跳过' })
      return { fetched: 0, deactivated: 0, skipped: true, costMs: 0 }
    }
    this.syncing = true
    const startedAt = Date.now()

    try {
      // 一次拉两类：内部会拼成 asset_type=a-share,a-share-index，省一半请求
      const fetchedItems = await this.thsApi.getAllTickers(STOCK_SYMBOLS_ASSET_TYPES)

      if (fetchedItems.length === 0) {
        // 空结果极可能是上游异常（如数据未就绪），照常写入会把全表标的误标为「已消失」
        this.logger.warn({ message: '标的同步返回空列表, 已跳过本轮写入' })
        return { fetched: 0, deactivated: 0, skipped: false, costMs: Date.now() - startedAt }
      }

      // 护栏：上游若返回同步范围外的类型（口径变化），忽略并告警而非写进表
      const items = fetchedItems.filter((item) =>
        (STOCK_SYMBOLS_ASSET_TYPES as string[]).includes(item.asset_type)
      )
      if (items.length < fetchedItems.length) {
        this.logger.warn({
          message: '上游返回了范围外的资产类型, 已忽略',
          ignored: fetchedItems.length - items.length,
          types: [...new Set(fetchedItems.map((item) => item.asset_type))],
        })
      }

      const deactivated = await this.runSync(items, new Date())
      const costMs = Date.now() - startedAt
      this.logger.log({ message: '标的同步完成', fetched: items.length, deactivated, costMs })

      return { fetched: items.length, deactivated, skipped: false, costMs }
    } finally {
      this.syncing = false
    }
  }

  /**
   * 查询同步状态概要
   *
   * 供前端在「同步」按钮旁展示：上次同步时间、条数分布、是否有同步正在跑。
   */
  async getSyncStatus(): Promise<StockSymbolsSyncStatus> {
    const [latest, byAssetType] = await Promise.all([
      this.symbolRepo
        .createQueryBuilder('s')
        .select('MAX(s.sync_at)', 'lastSyncAt')
        .getRawOne<{ lastSyncAt: Date | null }>(),
      this.symbolRepo
        .createQueryBuilder('s')
        .select('s.asset_type', 'assetType')
        .addSelect('COUNT(*)::int', 'total')
        .addSelect('COUNT(*) FILTER (WHERE s.delisted_at IS NULL)::int', 'active')
        .groupBy('s.asset_type')
        .orderBy('s.asset_type')
        .getRawMany<StockSymbolsAssetTypeStat>(),
    ])

    return {
      lastSyncAt: latest?.lastSyncAt ?? null,
      total: byAssetType.reduce((sum, row) => sum + row.total, 0),
      activeTotal: byAssetType.reduce((sum, row) => sum + row.active, 0),
      syncing: this.syncing,
      byAssetType,
    }
  }

  /**
   * 分页查询标的代码表
   *
   * 默认只返回在市标的（`delistedAt IS NULL`），可显式包含已退市的。
   */
  async findSymbols(dto: StockSymbolQueryDto): Promise<StockSymbolPage> {
    const page = dto.page ?? 1
    const pageSize = dto.pageSize ?? STOCK_SYMBOLS_QUERY_DEFAULT_PAGE_SIZE

    const base: FindOptionsWhere<StockSymbol> = {}
    if (dto.assetType) base.assetType = dto.assetType
    if (!dto.includeDelisted) base.delistedAt = IsNull()

    // `%` 与 `_` 是 LIKE 的通配符：不转义的话用户输入一个 `%` 会退化成「匹配全部」
    const keyword = dto.keyword?.replace(/[%_\\]/g, '\\$&')

    const [items, total] = await this.symbolRepo.findAndCount({
      // 数组形式的 where 即 OR 语义：thscode 或 name 命中即可
      where: keyword
        ? [
            { ...base, thscode: ILike(`%${keyword}%`) },
            { ...base, name: ILike(`%${keyword}%`) },
          ]
        : base,
      order: { thscode: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return { total, page, pageSize, items }
  }

  /**
   * 事务内完成「标记消失 + 分片写入」，返回本轮真正消失的标的数
   *
   * 采用**先全量标记、再由 upsert 置回**的两段式，而非比较 syncAt 时间戳：
   * 净效果相同，但不依赖时钟，规避 NTP 回拨或虚拟机快照恢复导致的漏标。
   */
  private async runSync(items: ThsTickerItem[], syncAt: Date): Promise<number> {
    // 护栏：上游返回量骤降时只写入、不标记，避免把大批正常标的误判为退市
    const activeCount = await this.symbolRepo.count({
      where: { assetType: In(STOCK_SYMBOLS_ASSET_TYPES), delistedAt: IsNull() },
    })
    const shouldMark =
      activeCount === 0 || items.length >= activeCount * STOCK_SYMBOLS_MIN_KEEP_RATIO
    if (!shouldMark) {
      this.logger.warn({
        message: '上游返回量不足存量的一半, 本轮只写入不标记消失',
        active: activeCount,
        fetched: items.length,
      })
    }

    return this.symbolRepo.manager.transaction(async (manager) => {
      if (shouldMark) {
        await manager.update(
          StockSymbol,
          { assetType: In(STOCK_SYMBOLS_ASSET_TYPES), delistedAt: IsNull() },
          { delistedAt: syncAt }
        )
      }

      for (let i = 0; i < items.length; i += STOCK_SYMBOLS_UPSERT_CHUNK_SIZE) {
        const batch = items
          .slice(i, i + STOCK_SYMBOLS_UPSERT_CHUNK_SIZE)
          .map((item) => this.toRow(item, syncAt))
        await manager.upsert(StockSymbol, batch, ['thscode'])
      }

      return shouldMark ? await manager.count(StockSymbol, { where: { delistedAt: syncAt } }) : 0
    })
  }

  /** 上游条目 → 实体行（全字段映射；delistedAt=null 表示本轮仍在上游代码表中） */
  private toRow(item: ThsTickerItem, syncAt: Date): Partial<StockSymbol> {
    return {
      thscode: item.thscode,
      ticker: item.ticker,
      name: item.name,
      exchange: item.exchange,
      assetType: item.asset_type,
      currency: item.currency,
      listDate: item.list_date,
      endDate: item.end_date,
      lastTradeDate: item.last_trade_date,
      lastDeliveryDate: item.last_delivery_date,
      syncAt,
      delistedAt: null,
    }
  }

  /** 表为空时补齐（仅在首次部署时命中） */
  private async fillIfEmpty(): Promise<void> {
    try {
      if ((await this.symbolRepo.count()) > 0) return

      this.logger.log({ message: '标的表为空, 触发首次同步' })
      await this.syncSymbols()
    } catch (err) {
      this.logger.error({ message: '标的首次同步失败', error: err })
    }
  }
}
