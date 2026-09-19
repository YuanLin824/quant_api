import type { WestockCliService } from '../westock-cli/westock-cli.service'
import { StockSearchService } from './stock-search.service'

describe('StockSearchService', () => {
  let service: StockSearchService
  let westock: { search: jest.Mock }

  beforeEach(() => {
    westock = {
      search: jest
        .fn()
        .mockResolvedValue({ keyword: '腾讯', limit: 10, offset: 0, sections: [], total: 0 }),
    }
    service = new StockSearchService(westock as unknown as WestockCliService)
  })

  it('把查询参数原样转给 CLI 服务', async () => {
    await service.search({
      keyword: '兴业',
      type: ['stock', 'bond'],
      market: 'hk',
      limit: 5,
      offset: 2,
    })

    expect(westock.search).toHaveBeenCalledWith('兴业', {
      types: ['stock', 'bond'],
      market: 'hk',
      limit: 5,
      offset: 2,
    })
  })

  it('未传的可选项透传 undefined，由 CLI 服务取默认（limit 10 / offset 0 / 仅股票）', async () => {
    await service.search({ keyword: '腾讯' })

    expect(westock.search).toHaveBeenCalledWith('腾讯', {
      types: undefined,
      market: undefined,
      limit: undefined,
      offset: undefined,
    })
  })

  it('结果原样透传（不在本层做加工）', async () => {
    const result = {
      keyword: '腾讯',
      limit: 10,
      offset: 0,
      sections: [
        {
          title: '股票',
          total: 1,
          columns: ['code', 'name', 'type'],
          rows: [{ code: 'hk00700', name: '腾讯控股', type: 'GP' }],
        },
      ],
      total: 1,
    }
    westock.search.mockResolvedValue(result)

    await expect(service.search({ keyword: '腾讯' })).resolves.toBe(result)
  })
})
