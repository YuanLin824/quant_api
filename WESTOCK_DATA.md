# WESTOCK 股票查询工具 - 命令行接口

批量查询：大部分命令支持逗号分隔多股代码，自动使用 Batch 模式
返回 BatchResult 结构（status + data[] + errors[]），支持局部降级

## 使用方法:

```bash
# 行情数据
npx -y westock-data-clawhub minute <代码> [--days N]  # 分时数据（支持个股、指数、板块）
npx -y westock-data-clawhub kline <代码[,代码...]> [--period 周期] [--limit N] [--fq 复权]  # K线数据（支持个股、指数、板块、ETF）

# 财务数据
npx -y westock-data-clawhub finance <代码[,代码...]> [--type 类型] [--num 期数]  # 财务数据
npx -y westock-data-clawhub profile <代码[,代码...]>  # 股票简况

# 资金分析
npx -y westock-data-clawhub asfund <代码[,代码...]> [--date 日期]  # A股主力资金
npx -y westock-data-clawhub hkfund <代码[,代码...]> [--date 日期]  # 港股资金分析
npx -y westock-data-clawhub usfund <代码[,代码...]> [--date 日期]  # 美股资金分析
npx -y westock-data-clawhub lhb <代码> [--date 日期]  # 龙虎榜
npx -y westock-data-clawhub blocktrade <代码> [--date 日期]  # 大宗交易
npx -y westock-data-clawhub margintrade <代码> [--date 日期]  # 融资融券
npx -y westock-data-clawhub buyback <代码> [--start 日期] [--end 日期]  # 公司回购（A股/港股）

# 技术分析
npx -y westock-data-clawhub technical <代码[,代码...]> [--group 分组] [--date 日期] [--start 起始 --end 结束]  # 技术指标
npx -y westock-data-clawhub chip <代码[,代码...]> [--date 日期] [--start 起始 --end 结束]  # 筹码成本分析(仅A股)

# 基本面
npx -y westock-data-clawhub shareholder <代码[,代码...]>  # 股东研究(A股/港股)
npx -y westock-data-clawhub dividend <代码[,代码...]> [--years N] [--all]  # 分红数据(A股/港股/美股)
npx -y westock-data-clawhub exdiv <代码[,代码...]>  # 分红除权日日历(A股/港股/美股)
npx -y westock-data-clawhub reserve <代码[,代码...]>  # 财报披露日(A股/港股/美股)
npx -y westock-data-clawhub suspension [市场]  # 停复牌列表(沪深/港股/美股)

# 市场发现
npx -y westock-data-clawhub search <关键词> [--stock] [--fund] [--sector]  # 股票搜索
npx -y westock-data-clawhub hot [类型] [--limit N] [--raw]  # 热搜
npx -y westock-data-clawhub board  # 行业板块
npx -y westock-data-clawhub calendar [日期] [--limit N] [--country 地区] [--indicator 指标]  # 投资日历
npx -y westock-data-clawhub ipo [市场] [--days N] [--raw]  # 新股日历

# ETF 基金
npx -y westock-data-clawhub etf <代码[,代码...]> [--date 日期]  # ETF 详情
npx -y westock-data-clawhub etf-holdings <代码[,代码...]> [--date 日期]  # ETF 持仓明细
npx -y westock-data-clawhub etf-nav <代码> --start 起始日期 --end 结束日期  # ETF 净值历史
npx -y westock-data-clawhub etf-company <代码[,代码...]> [--date 日期]  # ETF 公司信息
npx -y westock-data-clawhub etf-holders <代码[,代码...]> [--date 日期]  # ETF 持有人结构
npx -y westock-data-clawhub etf-financial <代码[,代码...]> [--date 日期]  # ETF 财务指标
```

## 示例:

```bash
npx -y westock-data-clawhub minute sh600000
npx -y westock-data-clawhub minute sh600000 --days 5
npx -y westock-data-clawhub minute sh000001                              # 指数分时
npx -y westock-data-clawhub minute pt01801081                            # 板块分时
npx -y westock-data-clawhub kline sh600000 --period day --limit 30
npx -y westock-data-clawhub kline sh600000,hk00700 --period day --limit 30
npx -y westock-data-clawhub kline sh600000 --period week --limit 20 --fq qfq
npx -y westock-data-clawhub kline sh000001 --period day --limit 30        # 指数K线
npx -y westock-data-clawhub kline pt01801081 --period day --limit 30      # 板块K线

npx -y westock-data-clawhub finance sh600000
npx -y westock-data-clawhub finance hk00700 --type zhsy --num 4
npx -y westock-data-clawhub finance sh600000,sz000001 --type lrb --num 4
npx -y westock-data-clawhub profile sh600000
npx -y westock-data-clawhub profile sh600000,hk00700,usAAPL

npx -y westock-data-clawhub asfund sh600000
npx -y westock-data-clawhub asfund sh600000,sz000001 --date 2026-03-10
npx -y westock-data-clawhub hkfund hk00700
npx -y westock-data-clawhub hkfund hk00700,hk01810 --date 2026-03-10
npx -y westock-data-clawhub usfund usAAPL
npx -y westock-data-clawhub usfund usAAPL,usTSLA --date 2026-03-10
npx -y westock-data-clawhub lhb sh600000
npx -y westock-data-clawhub lhb sh600000 --date 2026-03-20
npx -y westock-data-clawhub blocktrade sh600000
npx -y westock-data-clawhub blocktrade sh600000 --date 2026-03-20
npx -y westock-data-clawhub margintrade sh600000
npx -y westock-data-clawhub margintrade sh600000 --date 2026-03-20
npx -y westock-data-clawhub buyback sh600519
npx -y westock-data-clawhub buyback hk01810
npx -y westock-data-clawhub buyback hk01810 --start 2026-03-01 --end 2026-04-14

npx -y westock-data-clawhub technical sh600000
npx -y westock-data-clawhub technical sh600000 --group macd
npx -y westock-data-clawhub technical sh600000 --group ma,rsi
npx -y westock-data-clawhub technical sh600000,hk00700 --group all
npx -y westock-data-clawhub technical sh600000 --group macd --start 2026-02-01 --end 2026-03-01
npx -y westock-data-clawhub technical sh600000 --date 2026-03-01
npx -y westock-data-clawhub chip sh600000
npx -y westock-data-clawhub chip sh600000 --date 2026-03-01
npx -y westock-data-clawhub chip sh600000 --start 2026-02-01 --end 2026-03-01

npx -y westock-data-clawhub shareholder sh600519
npx -y westock-data-clawhub shareholder hk00700
npx -y westock-data-clawhub shareholder sh600519,hk00700
npx -y westock-data-clawhub dividend sh600519
npx -y westock-data-clawhub dividend hk00700
npx -y westock-data-clawhub dividend sh600519 --years 5
npx -y westock-data-clawhub dividend sh600519 --all
npx -y westock-data-clawhub dividend sh600519,hk00700,usAAPL
npx -y westock-data-clawhub exdiv hk00700
npx -y westock-data-clawhub exdiv hk00700,usAAPL
npx -y westock-data-clawhub reserve sh600519
npx -y westock-data-clawhub reserve sh600519,hk00700
npx -y westock-data-clawhub suspension hs
npx -y westock-data-clawhub suspension hk
npx -y westock-data-clawhub suspension us

npx -y westock-data-clawhub search 腾讯
npx -y westock-data-clawhub search 腾讯 --stock
npx -y westock-data-clawhub search 华夏 --fund
npx -y westock-data-clawhub search 银行 --sector
npx -y westock-data-clawhub hot stock
npx -y westock-data-clawhub hot wx
npx -y westock-data-clawhub hot news --limit 20
npx -y westock-data-clawhub hot board --limit 10
npx -y westock-data-clawhub hot etf
npx -y westock-data-clawhub hot stock --raw
npx -y westock-data-clawhub calendar
npx -y westock-data-clawhub calendar 2026-03-10 --limit 30
npx -y westock-data-clawhub ipo hs
npx -y westock-data-clawhub ipo hk --days 60
npx -y westock-data-clawhub ipo us --days 60
npx -y westock-data-clawhub ipo hs --days 30 --raw

npx -y westock-data-clawhub etf sh510300
npx -y westock-data-clawhub etf sh510300,sz159915
npx -y westock-data-clawhub etf sh510300 --date 2026-03-20
npx -y westock-data-clawhub etf-holdings sh510300
npx -y westock-data-clawhub etf-holdings sh510300 --date 2026-03-20
npx -y westock-data-clawhub etf-nav sh510300 --start 2026-01-01 --end 2026-03-31
npx -y westock-data-clawhub etf-company sh510300
npx -y westock-data-clawhub etf-company sh510300 --date 2026-03-20
npx -y westock-data-clawhub etf-holders sh510300
npx -y westock-data-clawhub etf-holders sh510300 --date 2026-03-20
npx -y westock-data-clawhub etf-financial sh510300
npx -y westock-data-clawhub etf-financial sh510300 --date 2026-03-20
```
