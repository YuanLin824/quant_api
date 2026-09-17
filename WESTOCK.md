# WeStock Data

> ⚠️ **本文档描述的不是 API 的 `westock` 模块，当前也无代码使用它**
>
> 本文件与 `docs/westock/` 描述的是腾讯发布的 Go CLI（`src/scripts/westock.exe`，能力更广：
> K线/板块/资金/技术指标/研报等），保留作为后续扩展的参考。
> API 的 `/api/westock/*` 接口基于 `src/scripts/westock-data-clawhub.mjs`（另一个第三方 CLI 的单文件 bundle），
> 文档见 [docs/api/westock.md](./docs/api/westock.md)。

腾讯自选股数据接口的 CLI 封装（`westock`），提供金融市场结构化数据查询：股票（A股/港股/美股）、ETF、指数、板块、期货、外汇、可转债的 K 线、技术指标、筹码、财报、研报、公告、风险事件、股东、分红、ETF 持仓、新股/投资日历、龙虎榜；另含行业经营数据、申万行业估值/盈利预测/财务与全球宏观经济。

不同标的与市场支持的维度差异较大，具体命令与能力矩阵见 [routing-guide.md](./docs/westock/routing-guide.md)。

## 获取二进制

二进制**不入库**（约 3.1MB），需先下载到本仓库的 `src/scripts/` 目录。

```bash
# 手动获取（三选一；幂等：目标已存在则跳过）
bash src/scripts/setup.sh            # macOS / Linux
pwsh -File src/scripts/setup.ps1     # Windows (PowerShell)
node src/scripts/setup.cjs           # 跨平台（Node ≥ 18）

# 需要重新拉取时加：setup.cjs 用 --force，setup.sh 用 -f，setup.ps1 用 -Force
```

`npm install` 后会经 `prepare` 钩子自动执行一次 `npm run setup:westock`（即 `setup.cjs -f`，强制刷新），通常无需手动调用。
`start` / `build` 等命令不再触发获取——若二进制被清理掉，需按上面的方式手动重跑。

> **二进制缺失时**：重跑上述任一脚本（幂等，不会重复下载已存在的文件）。不要用 `export PATH`、猜路径或 `find /` 找二进制。

> **安全说明**：脚本先用内置信任根校验 `SHA256.txt` 清单未被篡改，再用它校验二进制，两者都通过才写入。

---

**调用方式**：`<bin> <子命令> [参数]`，`<bin>` 按下表取二进制路径（脚本只落地文件，不写 PATH）：

| 平台          | 二进制路径                                                                         |
| ------------- | ---------------------------------------------------------------------------------- |
| Windows       | `.\src\scripts\westock.exe`（PowerShell）/ `./src/scripts/westock.exe`（Git Bash） |
| macOS / Linux | `./src/scripts/westock`                                                            |

统一 Go CLI，需网络。下文示例中的 `westock` 均指该二进制，实际执行时代入对应路径。

```bash
westock search 宁德时代
westock kline sh600519 --period day --limit 20
westock kline sh600036,sh601318,sz300750 --period day --limit 20    # 批量
```

---

## 参考文档

- [routing-guide.md](./docs/westock/routing-guide.md) — 场景路由、能力差异速查
- [commands.md](./docs/westock/commands.md) — 完整命令语法
- [scenarios-guide.md](./docs/westock/scenarios-guide.md) — 分析场景模板
- [ai_usage_guide.md](./docs/westock/ai_usage_guide.md) — 返回字段说明
- [macro-fields.md](./docs/westock/macro-fields.md) — 宏观指标字段

---

## 使用约定

1. **代码格式**——一律带市场前缀（`sh`/`sz`/`bj`·`hk`·`us`·`fu`·`fx`·`pt`）。不要用裸数字 `300685`、Wind 格式 `601988.SH`，港股不要漏前缀（`00700` → `hk00700`）。
2. **未知代码先搜索**——只知道名称时，先 `westock search <关键词>` 拿到代码。
3. **多股批量**——支持批量的命令用逗号一次传多个代码（如 `westock finance sh600519,sz000651`）。仅 `westock search` 不支持批量。
4. **货币单位随市场**——港元/美元，不使用人民币符号。
5. **K 线有延迟**——`kline` 非实时，须标注数据日期，不要当作「现价」或「实时涨跌」。

### 命令选型速查

「查这类数据该用哪条命令」——选对命令与参数，不要用别的命令硬凑或手算：

| 需求     | 用法                                                                                                            | 要点                                         |
| -------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 财报取值 | `westock finance`（默认 `--fields core`，全字段 `--fields all`）                                                | 比率类（ROE/毛利率）直读返回值，不要自行拼算 |
| 资金数据 | `fund flow` 流向（美股无）/ `fund short` 卖空空头 / `fund south-holding` 南下持仓 / `fund lhb` 龙虎榜（仅沪深） | 不要用南下持仓替代卖空                       |
| 宏观数据 | `westock macro`：先 `macro list` 查短名（如 `us_inflation`）再 `macro indicator`                                | 短名不要凭自然语言猜                         |

### 参数命名约定

参数名与取值都用简短写法（如 `--limit 20`、`--period day`、`--type sector`），不要自创长参数或复数形式；不确定某参数/取值时，回 [commands.md](./docs/westock/commands.md) 对应小节核对。

常见参数：

| 语义      | 参数与取值                                                               | 适用命令                                               |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| 周期      | `--period day\|week\|month\|season\|year`                                | `kline` / `technical`                                  |
| 条数/期数 | `--limit N`                                                              | `kline` / `technical` / `finance`（期数）/ 排行·清单类 |
| 回溯年数  | `--years N`                                                              | `dividend`                                             |
| 板块类型  | `--type sector`（概念/行业统一 `sector`，非 `concept`/`industry`/`all`） | `sector` 等                                            |
| 日期区间  | `--start` / `--end`（YYYY-MM-DD）                                        | `fund flow` / `finance` 等支持历史区间的命令           |

### 输出格式

命令默认输出结构化 Markdown 表格（含关键字段），可直接阅读。不要用 `| grep` / `| head` / `| tail` / `| sed` 过滤输出，也不要用 `&&` / `;` 拼接多条命令——条数、分页、筛选一律走**该子命令自己的参数**（不同命令支持的 flag 不同，不要跨命令套用）。

返回字段含义见 [ai_usage_guide.md](./docs/westock/ai_usage_guide.md)。

### search 的子类型

`westock search <关键词>` **默认只搜股票**（等价 `--type stock`），不会自动覆盖 ETF/板块/指数/期货/外汇。`--type` 支持逗号分隔多个类型同时搜（如 `--type etf,index,sector`），一条命令按类型分组返回。

| 目标             | 命令                                                  |
| ---------------- | ----------------------------------------------------- |
| 股票代码（默认） | `westock search 宁德时代`                             |
| ETF/基金         | `westock search 沪深300 --type etf`                   |
| 指数             | `westock search 中证红利 --type index`                |
| 板块             | `westock search 银行 --type sector`                   |
| 可转债           | `westock search 兴业 --type bond`                     |
| 期货/外汇        | `westock search 黄金 --type futures` / `--type forex` |
| 一次搜多个类型   | `westock search 港股通创新药 --type etf,index,sector` |

同一个关键词不要依次换 `--type` 盲试；需要多类型就用 `--type a,b,c` 一次搞定。

**空结果时**：读 CLI 返回的提示，最多再试 1 种 `--type`。

### 批量查询

多标的对比时，代码用逗号写在**同一条命令**里（如 `westock finance sh600519,sz000651`），不要一个标的一条命令。

```bash
# 对比 sh600519 + sz000651 → 下面各 1 次（共 5 次），而不是 10+ 次
westock kline sh600519,sz000651 --period day --limit 60
westock finance sh600519,sz000651 --limit 4
westock technical sh600519,sz000651
westock fund flow sh600519,sz000651
westock report list sh600519,sz000651 --limit 5
```

**不支持代码批量**的命令（须分开调用）：

| 命令             | 限制           |
| ---------------- | -------------- |
| `westock search` | 不支持代码批量 |

完整限制见 [routing-guide.md §三/§六](./docs/westock/routing-guide.md#三能力差异速查标的--维度)。

---

## 高频命令速查

```bash
# 搜索
westock search 宁德时代
westock search 半导体 --type sector

# K 线 / 财务 / 技术
westock kline sh600519 --period day --limit 20
westock finance sh600519,sz000651 --limit 1          # 多股三大表
westock technical sh600519

# 研报 / 公告
westock report list sh600519 --limit 5
westock notice list sh600519 --limit 10

# 板块 / 指数 / 宏观
westock sector constituent pt01801080          # 成份股
westock sector valuation pt01801080            # 估值 PE/PB/PS + 历史百分位
westock sector finance pt01801780               # 申万行业财报 TTM 聚合（仅申万行业，聚源概念不支持）
westock index constituent sh000300
westock macro indicator cn_core --date 2026-03-01

# 资金 / 北向
westock fund flow sh600519
westock fund north-holding sh600519
westock fund south-holding hk00700
westock fund north-holding pt01801080             # 仅申万行业，聚源概念板块不支持

# ETF
westock etf profile sh510300
```

完整语法见 [commands.md](./docs/westock/commands.md)。

---

## 异常与空结果

1. **二进制缺失 / 无法执行**：重跑 `node src/scripts/setup.cjs`（或对应平台脚本）后重试。
2. **命令报错**：按 CLI 返回的提示排查。
3. **空结果**：区分「代码不支持该维度」与「该时点无披露」（必要时先 `westock search` 确认代码）。
4. **能力不支持**：如美股无 `westock fund flow`，见 [routing-guide.md §三](./docs/westock/routing-guide.md#三能力差异速查标的--维度)。

---

## 重要声明

> 本工具仅提供客观市场数据查询，不构成投资建议。数据可能有延迟，以交易所官方为准。投资有风险，决策需谨慎。

**数据来源**：腾讯自选股数据接口
