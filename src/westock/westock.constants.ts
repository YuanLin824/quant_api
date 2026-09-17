import { resolve } from 'path'

/**
 * WeStock CLI（`westock-data-clawhub`）的契约常量
 *
 * 集中存放「参数取值」与「输出格式」两类知识——CLI 升级时只需改本文件。
 * 以下形态均经实测确认（详见 docs/api/westock.md）。
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

/** 入参长度上限 */
export const SEARCH_KEYWORD_MAX_LENGTH = 50
export const CODE_MAX_LENGTH = 20

/**
 * 关键词 / 代码的通用校验：不以 `-` 开头（否则会被 CLI 当作参数开关），且不含控制字符
 *
 * 用 `*` 而非 `+`——空串交给 DTO 的 `@IsNotEmpty` 负责，避免同一个空串
 * 同时触发两条校验、在 message 里并列报出（顺序还取决于装饰器注册顺序）。
 *
 * 控制字符用 Unicode 类别 `Cc` 表达而非 `0x00-0x1f` 范围——
 * 后者在部分编辑/写入链路中会被还原成真实的控制字节，把源文件变成二进制。
 */
export const TEXT_INPUT_PATTERN = /^(?!-)[^\p{Cc}]*$/u

/** 子进程超时：实测单次 400~600ms，取约 30 倍余量 */
export const CLI_TIMEOUT_MS = 15_000
/** stdout 缓冲上限：五日分时约 1300 行，留足余量 */
export const CLI_MAX_BUFFER = 8 * 1024 * 1024

/** 无结果的提示文案（search 与 minute 各一种，退出码均为 0） */
export const EMPTY_MESSAGES = ['数据为空', '无分时数据'] as const
/** 失败的提示前缀（退出码同样为 0，故只能按内容判定） */
export const ERROR_PREFIX = '执行失败'

/**
 * CLI 入口
 *
 * 这是 `westock-data-clawhub` 的**单文件 bundle**（包本身无依赖），已直接从
 * npm 包取出放入 `src/scripts/`，不再经 npm 安装——故用 `node <入口>` 调用，
 * 跨平台可靠（Windows 下 `.bin` 是 shell 脚本，execFile 无法直接执行）。
 *
 * 路径用 `../scripts/`：`src/westock/`（dev）与 `dist/westock/`（prod）都在
 * 各自根下一层，而 `src/scripts/*.mjs` 会经 nest-cli 的 assets 配置同步到
 * `dist/scripts/`，故两种情况指向同一相对位置。
 *
 * 扩展名为 `.mjs` 是必需的：源文件是 ESM，而本项目 `package.json` 无 `type: module`，
 * 用 `.js` 会让 Node 先按 CommonJS 解析失败再回退重解析，既慢又喷 warning。
 */
export const CLI_ENTRY_PATH = resolve(__dirname, '../scripts/westock-data-clawhub.mjs')
