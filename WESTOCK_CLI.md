# westock（腾讯 Go CLI）命令行接口

WeStock 金融数据 CLI

## 行情

```bash
westock kline <代码[,代码...]> [--period 周期] [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--limit N] [--fq 复权] [flags]
# -h, --help  help for kline
# --period    K线周期: m1,m5,m15,m30,m60,m120,day,week,month,season,year
# --start     起始日期 YYYY-MM-DD
# --end       结束日期 YYYY-MM-DD
# --limit     返回条数上限
# --fq        复权: qfq,hfq,bfq,nofq

westock kline sh600000 --period day --limit 30
westock kline sh600000,hk00700 --period day --limit 30
westock kline sh600000 --period m5 --start 2026-09-11 --end 2026-09-18
westock kline sh600000 --period week --limit 20 --fq qfq
westock kline sh600000 --start 2026-06-18 --end 2026-09-18
westock kline sh000001 --period day --limit 30        # 指数K线
westock kline pt01801081 --period day --limit 30      # 板块K线
westock kline fuCN --period day --limit 30            # 期货K线
westock kline fxCNH --period day --limit 30           # 外汇K线
westock kline sh600036 --period m1 --start 2026-09-18 --end 2026-09-18   # ★ 查昨日分钟K（定位 10:00 等具体时间）
```

## 技术分析

```bash
# 筹码成本分析(仅A股)
westock chip <代码[,代码...]> [--date 日期] [--start 起始 --end 结束] [flags]
# -h, --help  help for chip
# --date      查询日期 YYYY-MM-DD
# --start     区间开始 YYYY-MM-DD
# --end       区间结束 YYYY-MM-DD

westock chip sh600000
westock chip sh600000 --date 2026-09-18
westock chip sh600000 --start 2026-08-21 --end 2026-09-18


# 技术指标（始终返回 MA/MACD/KDJ/RSI/BOLL 全部指标）。支持日/周/月/季/年/分钟 K 线的技术指标；美股指数仅支持日K。
westock technical <代码[,代码...]> [--period 周期] [--date 日期] [--start 起始 --end 结束] [--limit N] [flags]
# -h, --help  help for technical
# --period    K线周期 day/week/month/season/year/m1..m120
# --date      查询日期 YYYY-MM-DD
# --start     区间开始 YYYY-MM-DD
# --end       区间结束 YYYY-MM-DD
# --limit     截面模式表示"最近 N 期"；历史区间模式返回条数上限

westock technical sh600000
westock technical sh600000 --date 2026-09-18
westock technical sh600000 --period week
westock technical sh600000 --period month --limit 12
westock technical sh600000 --period m30 --start 2026-09-17 --end 2026-09-18
westock technical sh600000 --start 2026-08-21 --end 2026-09-18 --limit 30
westock technical sh600519,sz000001
```

## 市场

```bash
# 沪深A股涨跌分布：涨跌/涨跌停/停牌家数、上涨占比情绪、涨跌幅区间分布家数、两市成交额
westock changedist [--date 日期] [flags]
# -h, --help  help for changedist
# --date      查询日期 YYYY-MM-DD

westock changedist
westock changedist --date 2026-09-18


# 沪深港通成份股清单（陆股通标的范围，仅标的清单，不含北向资金流向）
westock connect --exchange <sh|sz> [--limit N] [--offset N] [flags]
# -h, --help  help for connect
# --date      查询日期
# --exchange  沪通/深通 sh|sz
# --limit     返回条数
# --offset    偏移量
# --side      同 --exchange（兼容）

westock connect --exchange sh
westock connect --exchange sz
westock connect --exchange sh --limit 50
westock connect --exchange sz --limit 80 --offset 80


# A股/港股/美股新股日历（默认 --market hs）
westock ipo [--market hs|hk|us] [flags]
# -h, --help  help for ipo
# --market    市场 hs|hk|us

westock ipo --market hk
westock ipo --market hs
westock ipo --market us


# 全市场龙虎榜：机构榜、活跃席位、高胜率买入、高胜率席位（--type 可多选）
westock lhb [--type institution,activeseat,winbuy,winseat] [--date 日期] [flags]
# -h, --help  help for lhb
# --date      查询日期
# --type      榜单类型 institution,activeseat,...

westock lhb
westock lhb --type institution
westock lhb --type activeseat --date 2026-09-18


# A 股大盘画像总评 + 7 类细分维度（收盘/区间/技术/涨跌分布/两融/估值/风格）。不传 --type 默认输出 summary 市场画像总评（14 维度得分+状态文案，含估值/情绪/技术/趋势等）。子命令 list 列出所有可用 type
westock market-overview [list] [--type type[,type...]|all] [--date 日期] [flags]
# -h, --help  help for market-overview
# --date      查询日期
# --type      总览类型

westock market-overview                                         # 默认 = summary
westock market-overview --type trade                            # 三大指数收盘统计
westock market-overview --type interval --date 2026-09-18
westock market-overview --type technical,updown                 # 多 type 一次拉
westock market-overview --type all --date 2026-09-18            # 全部 8 类
westock market-overview list                                    # 列出所有可用 type


# 查询指定日期/区间/年份是否为交易日、休市日及月末/季末/年末最后交易日（沪深京）。与投资日历 "calendar"（个股事件）不同。
westock trade-calendar [--date YYYY-MM-DD | --start YYYY-MM-DD --end YYYY-MM-DD | --year YYYY] [--trading-only] [--limit N] [--offset N] [flags]
# -h, --help      help for trade-calendar
# --date          查询单日 YYYY-MM-DD
# --end           结束日期
# --limit         返回条数
# --offset        偏移量
# --start         开始日期
# --trading-only  仅返回交易日
# --year          查询整年

westock trade-calendar
westock trade-calendar --date 2026-09-18
westock trade-calendar --start 2026-08-20 --end 2026-09-18
westock trade-calendar --year 2026 --trading-only
```

## 指数

```bash
# 指数清单与成份股（A股+港股）。指数搜索请用 "search <关键词> --type index"
westock index <list|constituent> [参数] [flags]
# -h, --help  help for index


# 指数清单
westock index list [--date 日期] [--limit N] [--offset N] [flags]
# -h, --help  help for list
# --date      查询日期 YYYY-MM-DD
# --limit     返回条数（0 表示全部）
# --offset    偏移量

westock index list
westock index list --limit 50
westock index list --limit 50 --offset 50
westock index list --date 2026-09-18


# 查询 A 股或港股指数成份股，支持逗号分隔批量
westock index constituent <指数代码[,代码...]> [--limit N] [flags]
# -h, --help  help for constituent
# --limit     返回条数（0 表示全部）

westock index constituent sh000688
westock index constituent sh000300,sh000688
westock index constituent hkHSI
westock index constituent hkHSCEI,hkHSTECH
```

## 板块

```bash
# 板块查询。北向行业持仓见 "fund north-holding <板块代码>"；板块搜索用 "search <关键词> --type sector"
westock sector <constituent|info|ranking|oper|valuation|forecast|finance> [参数] [flags]
# -h, --help  help for sector


# 返回板块全部成份股。支持申万行业及聚源概念/地域/产业；先用 search --type sector 获取 pt 代码。
westock sector constituent <板块代码[,代码...]> [flags]
# -h, --help  help for constituent
# --date      查询日期 YYYY-MM-DD
# --limit     返回条数（0 表示全部）

westock sector constituent pt01801080
westock sector constituent pt01801080,pt01801081


# 返回板块信息与交易数据，不含成份股明细。字段随板块类型而异：概念/产业板块（pt02 等）返回名称、成份股数量、区间涨跌幅/成交额、市值与 TTM 财务等；申万行业（pt01 开头）上游仅提供名称与成份股数量，涨跌幅/资金流请用 westock sector ranking --kind industry。
westock sector info <板块代码[,代码...]> [flags]
# -h, --help  help for info
# --date      查询日期 YYYY-MM-DD

westock sector info pt02003900
westock sector info pt02003900,pt02003640


# 行业/概念板块排行，按涨跌幅/成交额/主力资金等字段排序，支持升序/降序。默认行业涨幅降序榜。
westock sector ranking [--kind industry|concept] [--type 字段] [--order desc|asc] [flags]
# -h, --help   help for ranking
# --kind       板块类别：industry(行业)/concept(概念)
# --order      排序方向：desc(降序)/asc(升序)
# --type       排序字段：changePct(涨跌幅)/turnover(成交额)/mainInflow(主力流入)/mainOutflow(主力流出)/mainNetInflow(主力净流入)/mainNetInflow5d(5日主力净流入)/mainNetInflow20d(20日主力净流入)

westock sector ranking
westock sector ranking --kind concept
westock sector ranking --type mainNetInflow
westock sector ranking --kind concept --type mainNetInflow --order asc


# 查询申万一级行业经营指标（价格/产量/销量/收入等，29 个行业）。传行业中文名或标识（如 煤炭/coal），勿传 pt 板块代码。
westock sector oper [行业关键词] [flags]
# -h, --help  help for oper
# --date      查询日期 YYYY-MM-DD
# --list      列出支持经营数据的申万一级行业

westock sector oper 煤炭
westock sector oper 煤炭 --date 2026-09-18
westock sector oper --list


# 查询板块 PE/PB/PS/PCF/DIV 及历史百分位。支持申万行业及聚源概念/地域/产业；先用 search --type sector 获取 pt 代码。支持历史区间 --start --end（单代码）。
westock sector valuation <板块代码[,代码...]> [flags]
# -h, --help  help for valuation
# --date      查询日期 YYYY-MM-DD
# --end       历史区间结束 YYYY-MM-DD（与 --start 合用，单代码）
# --start     历史区间开始 YYYY-MM-DD（与 --end 合用，单代码）

westock sector valuation pt01801080
westock sector valuation pt01801080,pt01801081
westock sector valuation pt01801080 --start 2026-01-22 --end 2026-09-18


# 查询申万一级/二级行业的机构一致预期盈利路径（未来 3 年营收/净利润/PE/PB/ROE/PEG 等）。不支持申万三级及聚源概念/地域。
westock sector forecast <板块代码[,代码...]> [flags]
# -h, --help  help for forecast
# --date      查询日期 YYYY-MM-DD

westock sector forecast pt01801780
westock sector forecast pt01801081
westock sector forecast pt01801780 --date 2026-09-18


# 查询申万行业成份股聚合的财报 TTM 指标（营收/净利/ROE/负债率等）。支持 sw1/sw2/sw3；聚源概念/地域会报错。支持历史区间 --start --end（单代码）。
westock sector finance <板块代码[,代码...]> [flags]
# -h, --help  help for finance
# --date      查询日期 YYYY-MM-DD
# --end       历史区间结束 YYYY-MM-DD（与 --start 合用，单代码）
# --start     历史区间开始 YYYY-MM-DD（与 --end 合用，单代码）

westock sector finance pt01801780
westock sector finance pt01801780,pt01801080
westock sector finance pt01801780 --start 2020-06-20 --end 2026-09-18
```

## 发现

```bash
# 统一搜索入口。**默认仅搜股票**（排除 ETF/可转债）；--type 切换到 ETF/可转债/板块/指数/期货/外汇，支持逗号分隔同时搜多个类型（如 etf,index,sector）；--market 按市场限定结果（hs|bj|hk|us 与 --type 可组合，jp|kr 为日韩股专用接口，与 --type 互斥）
westock search <关键词> [--type stock|etf|bond|sector|index|futures|forex（可逗号分隔多个）] [--market hs|bj|hk|us|jp|kr] [--limit N] [flags]
# -h, --help  help for search
# --limit     最多显示条数
# --market    按市场限定结果 hs|bj|hk|us|jp|kr
# --offset    偏移量
# --type      搜索类型 stock|etf|bond|sector|index|futures|forex

westock search 腾讯                  # 默认：仅股票
westock search 沪深300 --type etf    # ETF
westock search 兴业 --type bond      # 可转债
westock search 银行 --type sector    # 板块
westock search 沪深300 --type index  # 指数
westock search 黄金 --type futures   # 期货
westock search 离岸 --type forex     # 外汇
westock search 港股通创新药 --type etf,index,sector  # 一次搜多类型（逗号分隔）
westock search 三星电子 --market kr  # 韩股
westock search 丰田 --market jp      # 日股
westock search 腾讯 --market hk      # 只看港股
westock search 苹果 --market us      # 只看美股
westock search 银行 --market hs      # 只看沪深
westock search 沪深300 --type etf --market hs  # 与 --type 组合
```

## 财务

```bash
# 财报披露日历（A股/港股/美股；又称业绩预约披露日）
westock disclosure <代码[,代码...]> [flags]
# -h, --help  help for disclosure

westock disclosure sh600519
westock disclosure hk00700
westock disclosure usAAPL
westock disclosure sh600519,hk00700


# 财务数据（★ 查营收/利润/ROE 等加 --type income；查资产/负债加 --type balance；查现金流加 --type cashflow；仅综合分析时省略 --type 全拉三大表）
westock finance <代码[,代码...]> [--type 类型] [--limit 期数 | --start 日期 --end 日期] [flags]
# -h, --help  help for finance
# --end       结束日期 YYYY-MM-DD
# --fields    字段范围: core(核心窄表,默认)/all(全字段)
# --limit     期数
# --start     起始日期 YYYY-MM-DD
# --type      报表类型: income,balance,cashflow（省略则三项都查）

westock finance sh600036 --type income --limit 1      # 查营业收入/利润
westock finance sh600036 --type balance --limit 1     # 查资产负债
westock finance sh600036 --type cashflow --limit 1    # 查现金流
westock finance hk00700 --type income --limit 4       # 多期利润表
westock finance sh600000,sz000001 --limit 4           # 批量三表（综合分析）
westock finance sh600000 --type income --start 2025-09-18 --end 2026-09-18
```

## 资金

```bash
# 资金数据（个股资金流向 / 卖空 / 融资融券 / 大宗交易 / 龙虎榜 / 北向资金持仓 / 南下资金持仓）
westock fund <flow|short|margin|block|lhb|north-holding|south-holding> [参数...] [flags]
# -h, --help  help for fund


# 查询个股日度资金流向（主力/超大单/大单/中单/小单）。沪深支持历史区间 --start --end（单代码）。
westock fund flow <代码[,代码...]> [flags]
# -h, --help  help for flow
# --date      查询日期 YYYY-MM-DD
# --end       区间结束
# --start     区间开始

westock fund flow sh600000
westock fund flow hk00700
westock fund flow sh600000 --start 2026-09-09 --end 2026-09-18


# 查询港股/美股卖空数据（卖空股数、卖空金额、卖空比例等）。支持单日快照（--date）与历史区间（--start --end），均支持多代码批量。
westock fund short <代码[,代码...]> [flags]
# -h, --help  help for short
# --date      查询日期 YYYY-MM-DD（单日快照）
# --end       区间结束 YYYY-MM-DD（与 --start 配合）
# --start     区间开始 YYYY-MM-DD（与 --end 配合）

westock fund short hk00700
westock fund short usAAPL
westock fund short hk00700 --date 2026-09-18
westock fund short hk00700 --start 2026-09-09 --end 2026-09-18


# 查询 A 股融资融券余额及变动（融资余额/融券余量/两融余额等）。
westock fund margin <代码[,代码...]> [flags]
# -h, --help  help for margin
# --date      查询日期 YYYY-MM-DD
# --end       区间结束 YYYY-MM-DD
# --start     区间开始 YYYY-MM-DD（与 --end 同时提供时按区间查询）

westock fund margin sh600000
westock fund margin sh600000,sz000651
westock fund margin sh600000 --date 2026-09-18
westock fund margin sh600036 --start 2026-09-11 --end 2026-09-18


# 查询 A 股大宗交易明细（成交价/成交量/买卖营业部等）。
westock fund block <代码[,代码...]> [flags]
# -h, --help  help for block
# --date      查询日期 YYYY-MM-DD
# --end       区间结束 YYYY-MM-DD
# --start     区间开始 YYYY-MM-DD（与 --end 同时提供时按区间查询）

westock fund block sh600000
westock fund block sh600000,sz000651
westock fund block sh600000 --date 2026-09-18
westock fund block sh600036 --start 2026-07-20 --end 2026-09-18


# 查询 A 股个股龙虎榜（成交统计 LhbInfos / 营业部买卖明细 LhbTradingDetails）。支持指定日期或时间区间查询。
westock fund lhb <代码[,代码...]> [flags]
# -h, --help  help for lhb
# --date      查询日期 YYYY-MM-DD
# --end       区间结束 YYYY-MM-DD
# --start     区间开始 YYYY-MM-DD（与 --end 同时提供时按区间查询）

westock fund lhb sh600000
westock fund lhb sh600000,sz000651 --date 2026-09-18
westock fund lhb sh600000 --start 2026-07-20 --end 2026-09-18


# 查询陆股通北向资金持仓：传 A 股代码查个股季度持仓；传申万行业 pt 代码查行业分布。
westock fund north-holding <代码[,代码...]> [flags]
# -h, --help  help for north-holding
# --date      查询日期 YYYY-MM-DD

westock fund north-holding sh600519
westock fund north-holding sh600519 --date 2026-09-18
westock fund north-holding pt01801080


# 查询港股通南下资金对港股的季度持仓（持股数/持股比例/持股市值等）。
westock fund south-holding <港股代码[,代码...]> [flags]
# -h, --help  help for south-holding
# --date      查询日期 YYYY-MM-DD

westock fund south-holding hk00700
westock fund south-holding hk00700,hk03690 --date 2026-09-18
```

## 简况

```bash
# 公司回购（A股/港股）
westock buyback <代码> [--start 日期] [--end 日期] [flags]
# -h, --help  help for buyback
# --end       区间结束
# --start     区间开始

westock buyback sh600519
westock buyback hk01810
westock buyback sh600519,hk01810
westock buyback hk01810 --start 2026-08-05 --end 2026-09-18


# 分红数据(A股/港股/美股)。历史分红+拆合股，支持 --years 调整时间窗、--all 包含未实施方案
westock dividend <代码[,代码...]> [--years N] [--all] [flags]
# -h, --help  help for dividend
# --all       包含未实施分红方案
# --years     回溯年数

westock dividend sh600519
westock dividend hk00700 --years 10
westock dividend sh600519 --all
westock dividend sh600519,hk00700,usAAPL


# 股票简况
westock profile <代码[,代码...]> [flags]
# -h, --help  help for profile

westock profile sh600000
westock profile sh600000,hk00700,usAAPL


# 股东研究(A股/港股)
westock shareholder <代码[,代码...]> [flags]
# -h, --help  help for shareholder

westock shareholder sh600519
westock shareholder hk00700
westock shareholder sh600519,hk00700
```

## ETF

```bash
# ETF 基金数据。子命令：profile（档案+资产配置） / overview（运作概览） / holdings（持仓明细） / nav（净值历史）
westock etf <profile|overview|holdings|nav> <代码[,代码...]> [--date 日期] [--start 起始 --end 结束] [flags]
# -h, --help  help for etf


# 基金档案：分类/经理/费率/投资策略/资产配置等。
westock etf profile <代码[,代码...]> [--date 日期] [flags]
# -h, --help  help for profile
# --date      查询日期

westock etf profile sh510300
westock etf profile sh510300,sz159915 --date 2026-09-18


# 运作概览：行情/规模/溢折率/回撤/净申购/估值等。
westock etf overview <代码[,代码...]> [--date 日期] [flags]
# -h, --help  help for overview
# --date      查询日期

westock etf overview sh510300


# 申赎清单成分股 + 重仓股涨跌。
westock etf holdings <代码[,代码...]> [--date 日期] [--limit N --offset N] [flags]
# -h, --help  help for holdings
# --date      查询日期
# --limit     最多显示条数（申赎清单成分股）
# --offset    偏移量（申赎清单成分股）

westock etf holdings sh510300
westock etf holdings sh510300 --date 2026-09-18
westock etf holdings sh510300 --limit 10    # 仅前10大持仓


# 净值时序（必需 --start 与 --end）。
westock etf nav <代码[,代码...]> --start 起始 --end 结束 [flags]
# -h, --help  help for nav
# --end       结束日期
# --start     开始日期

westock etf nav sh510300 --start 2026-06-21 --end 2026-09-18
```

## 研究

```bash
# 一致预期（A股、港股）
westock consensus <代码[,代码...]> [flags]
# -h, --help  help for consensus

westock consensus sh600519
westock consensus sh600519,sh600000
westock consensus hk00700                            # 港股一致预期
westock consensus hk00700,hk09988


# ESG 评级（中证/聚源字母档）。与 rating（机构评级）、score（量化评分）不同；仅 A 股。
westock esg <代码[,代码...]> [--date 日期] [--source csi|jy|all] [flags]
# -h, --help  help for esg
# --date      查询日期（YYYY-MM-DD），默认今天
# --source    数据来源：csi / jy / all

westock esg sh600519
westock esg sh600519,sz000651 --source csi
westock esg sh600519 --date 2026-09-18


# 机构评级（港股、美股）
westock rating <代码[,代码...]> [flags]
# -h, --help  help for rating

westock rating hk00700
westock rating hk00700,usAAPL


# 股票评分（最新评分及周/月/季变动）
westock score <代码[,代码...]> [--date 日期] [flags]
# -h, --help  help for score
# --date      查询日期（YYYY-MM-DD），默认最新

westock score sh600519
westock score sh600519,sz000001
westock score sh600519 --date 2026-09-18


# 研报。子命令：list（个股/行业研报列表） / detail <研报ID>（研报详情）
westock report <list|detail> [参数] [--limit N] [--offset N] [flags]
# -h, --help  help for report


# 查询个股或申万行业研报列表。
westock report list <代码[,代码...]|板块代码> [--limit N] [flags]
# -h, --help  help for list
# --limit     返回条数
# --offset    偏移量

westock report list sh600519 --limit 20
westock report list sh600519,sh600000 --limit 10 --offset 10
westock report list pt01801080 --limit 10


# 按研报 ID 返回研报摘要与正文。
westock report detail <研报ID> [flags]
# -h, --help  help for detail

westock report detail res833012871388
```

## 资讯

```bash
# 公告。子命令：list（个股公告列表） / detail（公告内容）
westock notice <list|detail> [参数] [--type N] [--limit N] [--offset N] [flags]
# -h, --help  help for notice


# 查询个股公告列表，可按公告类型过滤。
westock notice list <代码[,代码...]> [--type N] [--limit N] [flags]
# -h, --help  help for list
# --limit     返回条数
# --offset    偏移量
# --type      公告类型 0-全部

westock notice list sh600000
westock notice list sh600000,sz000001
westock notice list sh600000 --type 1


# 按公告 ID 返回公告全文。
westock notice detail <公告ID> [flags]
# -h, --help  help for detail

westock notice detail nos1224809143
```

## 事件

```bash
# 投资日历（默认查询今天，--event 默认 all）。event 可选值：financial_report/dividend/ipo/trading_halt/meeting/lockup_release/rights_issue/all。宏观经济日历请使用 `macro indicator cn_calendar_future|cn_calendar_hist`。市场: A股 · 港股
westock calendar [--date YYYY-MM-DD] [--event financial_report/.../all] [--limit N] [--market hs|hk] [flags]
# -h, --help   help for calendar
# --date       查询日期
# --event      事件类型
# --limit      返回条数
# --market     市场
# --offset     偏移量（分页）

westock calendar
westock calendar --date 2026-09-18
westock calendar --date 2026-09-18 --event dividend
westock calendar --date 2026-09-18 --event ipo --market hs


# 风险事件监控（仅支持A股）。types 可选：specialtrade, pledge, unlock, lawsuit, seasonedissue, leaderchange, executivetransfer, bondrating（共 8 种，支持 st/addition/leader/executive/rating 等别名）
westock risk <代码[,代码...]> [--types 类型1,类型2] [flags]
# -h, --help  help for risk
# --types     风险类型过滤

westock risk sh600000
westock risk sz000001 --types pledge,unlock
westock risk sh600000,sz000001,sz300750 --types pledge
westock risk bj831399 --types specialtrade,lawsuit
westock risk sh600028 --types leaderchange
westock risk sz300747 --types executivetransfer
westock risk sh600635 --types bondrating


# 停复牌列表（默认 --market hs；沪深A股/港股/美股）
westock suspension [--market hs|hk|us] [flags]
# -h, --help  help for suspension
# --market    市场

westock suspension
westock suspension --market hk
westock suspension --market hs
westock suspension --market us
```

## 宏观

```bash
# 宏观经济数据查询。子命令：list（列出指标，可 --region 过滤）/ indicator（查主题型指标，cn/us/hk/jp/eu）/ expect（按地区查海外预期日历，36 个国家/地区/区域组织）。指标按声明 mode 分流：mode=year 用 --year/--start --end；mode=date 用 --date（默认今天）。主题型短名：cn_gdp, cn_pmi, cn_lpr, us_employment, jp_inflation, eu_monetary 等。海外预期短名：expect_chn, expect_usa, expect_jpn, expect_hk, expect_euz, expect_glo 等。
westock macro <list | indicator <短名[,短名...]> | expect <list | --area iso3>> [--year Y | --date YYYY-MM-DD | --start S --end E] [flags]
# -h, --help  help for macro


# 列出全部宏观指标短名、代码、区域与查询模式（year/date）。
westock macro list [--region cn|us|hk|jp|eu|global] [flags]
# -h, --help  help for list
# --region    区域 cn|us|hk|jp|eu|global

westock macro list
westock macro list --region cn
westock macro list --region us


# 按短名查询主题型宏观指标（cn_gdp/cn_pmi/us_employment 等）。
westock macro indicator <短名[,短名...]> [--year Y | --date D | --start S --end E] [flags]
# -h, --help  help for indicator
# --date      查询日期 YYYY-MM-DD
# --end       区间结束
# --limit     每个指标最多保留最近 N 条
# --region    一键拉取该地区全部指标 cn|us|hk|jp|eu|global（与显式短名二选一）
# --start     区间开始
# --year      查询年份（mode=year 指标）

westock macro indicator cn_gdp --year 2025
westock macro indicator cn_pmi --start 2023 --end 2025
westock macro indicator cn_lpr --date 2026-09-18
westock macro indicator us_inflation --date 2026-09-18
westock macro indicator us_employment,us_inflation,us_monetary --date 2026-09-18
westock macro indicator --region us --date 2026-09-18


# 按 iso3 地区代码查询海外宏观预期日历；expect list 列出支持的地区。
westock macro expect [--area iso3] [--year Y | --start S --end E] [flags]
# -h, --help  help for expect
# --area      iso3 地区代码 chn/usa/jpn...
# --date      查询日期
# --end       区间结束
# --start     区间开始
# --year      查询年份

westock macro expect list
westock macro expect --area chn --year 2025
westock macro expect --area usa --start 2023 --end 2025


# 列出海外预期日历支持的 iso3 地区代码。
westock macro expect list [flags]
# -h, --help  help for list

westock macro expect list
```

## 期货

```bash
# 期货合约资料（外盘商品/金融期货 + 港股股指期货）。行情用 quote、分时用 minute、K线用 kline；搜索请用 "search <关键词> --type futures"
westock futures detail <代码> [flags]
# -h, --help  help for futures


# 查询合约交易所、规模、币种、最小变动、交易时间等；搜索请用 search --type futures。
westock futures detail fuGC [flags]
# -h, --help  help for detail

westock search 黄金 --type futures
westock search 贵金属 --type futures
westock futures detail fuGC
```

## 外汇

```bash
# 外汇品种列表（离岸人民币/主要货币对/美元指数）。行情用 quote、分时用 minute、K线用 kline；搜索请用 "search <关键词> --type forex"
westock forex list [flags]
# -h, --help  help for forex


# 外汇品种列表（离岸人民币/主要货币对/美元指数）。
westock forex list [flags]
# -h, --help  help for list

westock forex list
westock search 美元 --type forex
westock search 离岸 --type forex
westock kline fxCNH --period day --limit 30
```

## 债券

```bash
# 可转债详情（发行/评级/期限利率/转股/赎回回售/条款/利率变动/现金流明细）。行情用 quote、分时用 minute、K线用 kline
westock bond <代码[,代码...]> [flags]
# -h, --help  help for bond

westock bond sh113052
westock bond sh113052,sz123245             # 批量查询
westock quote sh113052                            # 可转债行情（复用个股通道）
```
