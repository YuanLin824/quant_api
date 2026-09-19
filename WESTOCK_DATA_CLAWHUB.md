# westock-data-clawhub 命令行接口

npm 包，经 `npx -y westock-data-clawhub` 调用；命令名为 `westock-data`

> 💡 批量查询：大部分命令支持逗号分隔多股代码，自动使用 Batch 模式
> 返回 BatchResult 结构（status + data[] + errors[]），支持局部降级
>
> ⚠️ 该 CLI **只提供顶层帮助**（`npx -y westock-data-clawhub --help`），子命令没有独立的
> `--help`（传入会被当作未知参数）。故下文各命令的用法取自顶层帮助，示例取自实际调用提示。

## 行情数据

```bash
# 分时数据（支持个股、指数、板块）
westock-data minute <代码> [--days N]

westock-data minute sh600000
westock-data minute sh600000 --days 5
westock-data minute sh000001                              # 指数分时
westock-data minute pt01801081                            # 板块分时


# K线数据（支持个股、指数、板块、ETF）
westock-data kline <代码[,代码...]> [--period 周期] [--limit N] [--fq 复权]

westock-data kline sh600000 --period day --limit 30
westock-data kline sh600000,hk00700 --period day --limit 30
westock-data kline sh600000 --period week --limit 20 --fq qfq
westock-data kline sh000001 --period day --limit 30        # 指数K线
westock-data kline pt01801081 --period day --limit 30      # 板块K线
```

## 财务数据

```bash
# 财务数据
westock-data finance <代码[,代码...]> [--type 类型] [--num 期数]

westock-data finance sh600000
westock-data finance hk00700 --type zhsy --num 4
westock-data finance sh600000,sz000001 --type lrb --num 4


# 股票简况
westock-data profile <代码[,代码...]>

westock-data profile sh600000
westock-data profile sh600000,hk00700,usAAPL
```

## 资金分析

```bash
# A股主力资金
westock-data asfund <代码[,代码...]> [--date 日期]

westock-data asfund sh600000
westock-data asfund sh600000,sz000001 --date 2026-03-10


# 港股资金分析
westock-data hkfund <代码[,代码...]> [--date 日期]

westock-data hkfund hk00700
westock-data hkfund hk00700,hk01810 --date 2026-03-10


# 美股资金分析
westock-data usfund <代码[,代码...]> [--date 日期]

westock-data usfund usAAPL
westock-data usfund usAAPL,usTSLA --date 2026-03-10


# 龙虎榜
westock-data lhb <代码> [--date 日期]

westock-data lhb sh600000
westock-data lhb sh600000 --date 2026-03-20


# 大宗交易
westock-data blocktrade <代码> [--date 日期]

westock-data blocktrade sh600000
westock-data blocktrade sh600000 --date 2026-03-20


# 融资融券
westock-data margintrade <代码> [--date 日期]

westock-data margintrade sh600000
westock-data margintrade sh600000 --date 2026-03-20


# 公司回购（A股/港股）
westock-data buyback <代码> [--start 日期] [--end 日期]

westock-data buyback sh600519
westock-data buyback hk01810
westock-data buyback hk01810 --start 2026-03-01 --end 2026-04-14
```

## 技术分析

```bash
# 技术指标。支持截面查询与历史区间查询
westock-data technical <代码[,代码...]> [--group 分组] [--date 日期] [--start 起始 --end 结束]

# 用法:
#   截面查询: westock-data technical <代码[,代码...]> [--group 分组] [--date 日期]
#   历史查询: westock-data technical <代码> [--group 分组] --start 起始 --end 结束
# 指标分组: ma, macd, kdj, rsi, boll, bias, wr, dmi, all(默认)

westock-data technical sh600000                                        # 全部指标
westock-data technical sh600000 --group macd                           # 仅 MACD
westock-data technical sh600000 --group ma,rsi                         # MA + RSI
westock-data technical sh600000 --group macd --start 2026-02-01 --end 2026-03-01
westock-data technical sh600000 --date 2026-03-01
westock-data technical sh600000,hk00700 --group all


# 筹码成本分析(仅A股)。⚠️ 仅支持沪深A股（sh/sz/bj 前缀），港股/美股不支持
westock-data chip <代码[,代码...]> [--date 日期] [--start 起始 --end 结束]

# 用法:
#   截面查询: westock-data chip <代码[,代码...]> [--date 日期]
#   历史查询: westock-data chip <代码> --start 起始 --end 结束

westock-data chip sh600000                                     # 最新筹码数据
westock-data chip sh600000,sz000001                            # 批量查询
westock-data chip sh600000 --date 2026-03-01                   # 指定日期
westock-data chip sh600000 --start 2026-02-01 --end 2026-03-01 # 历史区间
```

## 基本面

```bash
# 股东研究(A股/港股)
westock-data shareholder <代码[,代码...]>

westock-data shareholder sh600519
westock-data shareholder hk00700
westock-data shareholder sh600519,hk00700


# 分红数据(A股/港股/美股)
westock-data dividend <代码[,代码...]> [--years N] [--all]

westock-data dividend sh600519
westock-data dividend hk00700
westock-data dividend sh600519 --years 5
westock-data dividend sh600519 --all
westock-data dividend sh600519,hk00700,usAAPL


# 分红除权日日历(A股/港股/美股)
westock-data exdiv <代码[,代码...]>

westock-data exdiv hk00700
westock-data exdiv hk00700,usAAPL


# 财报披露日(A股/港股/美股)
westock-data reserve <代码[,代码...]>

westock-data reserve sh600519
westock-data reserve sh600519,hk00700


# 停复牌列表(沪深/港股/美股)。支持的市场: hs(沪深A股) / hk(港股) / us(美股)
westock-data suspension [市场]

westock-data suspension hs
westock-data suspension hk
westock-data suspension us
```

## 市场发现

```bash
# 股票搜索
westock-data search <关键词> [--stock] [--fund] [--sector]

westock-data search 腾讯
westock-data search 腾讯 --stock
westock-data search 华夏 --fund
westock-data search 银行 --sector


# 热搜
westock-data hot [类型] [--limit N] [--raw]

westock-data hot stock
westock-data hot wx
westock-data hot news --limit 20
westock-data hot board --limit 10
westock-data hot etf
westock-data hot stock --raw


# 行业板块
westock-data board

westock-data board


# 投资日历
westock-data calendar [日期] [--limit N] [--country 地区] [--indicator 指标]

westock-data calendar
westock-data calendar 2026-03-10 --limit 30


# 新股日历
westock-data ipo [市场] [--days N] [--raw]

westock-data ipo hs
westock-data ipo hk --days 60
westock-data ipo us --days 60
westock-data ipo hs --days 30 --raw
```

## ETF 基金

```bash
# ETF 详情
westock-data etf <代码[,代码...]> [--date 日期]

westock-data etf sh510300
westock-data etf sh510300,sz159915
westock-data etf sh510300 --date 2026-03-20


# ETF 持仓明细
westock-data etf-holdings <代码[,代码...]> [--date 日期]

westock-data etf-holdings sh510300
westock-data etf-holdings sh510300 --date 2026-03-20


# ETF 净值历史（必需 --start 与 --end）
westock-data etf-nav <代码> --start 起始日期 --end 结束日期

westock-data etf-nav sh510300 --start 2026-01-01 --end 2026-03-31


# ETF 公司信息
westock-data etf-company <代码[,代码...]> [--date 日期]

westock-data etf-company sh510300
westock-data etf-company sh510300 --date 2026-03-20


# ETF 持有人结构
westock-data etf-holders <代码[,代码...]> [--date 日期]

westock-data etf-holders sh510300
westock-data etf-holders sh510300 --date 2026-03-20


# ETF 财务指标
westock-data etf-financial <代码[,代码...]> [--date 日期]

westock-data etf-financial sh510300
westock-data etf-financial sh510300 --date 2026-03-20
```
