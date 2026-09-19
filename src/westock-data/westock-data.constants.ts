import { resolve } from 'path'

/**
 * `westock-data-clawhub` 的契约常量
 *
 * 这个 CLI（命令名 `westock-data`）提供**搜索**与**分时**。
 * K 线由另一个 CLI（腾讯 Go CLI，见 `WestockCliService`）提供——本 CLI 的 kline
 * 不支持分钟周期，传 `m1`/`5m` 等会**静默回退到日线**。
 *
 * 集中存放「参数取值」与「输出格式」两类知识——CLI 升级时只需改本文件。
 * 以下形态均经实测确认。
 */

/**
 * 搜索范围
 *
 * CLI 另支持 `--sector`，但实测对所有关键词均**无任何输出**（退出码 0），
 * 功能实际不可用，故不对外暴露。
 */
export const SEARCH_SCOPES = ['stock', 'fund'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

/** 分时天数：1 = 当日，2~5 = 五日；实测传入大于 5 也只返回 5 天 */
export const MINUTE_DEFAULT_DAYS = 1
export const MINUTE_MAX_DAYS = 5

/**
 * clawhub 入口
 *
 * 这是 `westock-data-clawhub` 的**单文件 bundle**（包本身无依赖），已直接从
 * npm 包取出放入 `src/scripts/`，不再经 npm 安装——故用 `node <入口>` 调用，
 * 跨平台可靠（Windows 下 `.bin` 是 shell 脚本，execFile 无法直接执行）。
 *
 * 扩展名为 `.mjs` 是必需的：源文件是 ESM，而本项目 `package.json` 无 `type: module`，
 * 用 `.js` 会让 Node 先按 CommonJS 解析失败再回退重解析，既慢又喷 warning。
 */
export const CLAWHUB_ENTRY_PATH = resolve(__dirname, '../scripts/westock-data-clawhub.mjs')
