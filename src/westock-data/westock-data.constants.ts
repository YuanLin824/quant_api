import { resolve } from 'path'

/**
 * `westock-data-clawhub` 的契约常量
 *
 * 这个 CLI（命令名 `westock-data`）在本项目里**只用来取分时**——搜索已由腾讯 Go CLI
 * 承接（见 `WestockCliService.search`，支持类型/市场/分页，能力更强）。
 * K 线同样在 Go CLI 那边：本 CLI 的 kline **不支持分钟周期**，
 * 传 `m1`/`5m` 等会**静默回退到日线**。
 *
 * 集中存放「参数取值」与「输出格式」两类知识——CLI 升级时只需改本文件。
 * 以下形态均经实测确认。
 */

/**
 * 分时天数默认值：1 = 当日，2~5 = 五日
 *
 * 上限（5 天）**不在本层设**：实测传入大于 5 也只返回 5 天，是 CLI 自己截断的。
 */
export const MINUTE_DEFAULT_DAYS = 1

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
