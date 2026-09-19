/**
 * CLI 调用的通用常量
 *
 * 本项目通过子进程调用若干第三方 CLI（见 `CliRunnerBase`），以下取值对它们通用。
 */

/** 子进程超时：实测单次 400~600ms，取约 30 倍余量 */
export const CLI_TIMEOUT_MS = 15_000

/** stdout 缓冲上限：五日分时约 1300 行，留足余量 */
export const CLI_MAX_BUFFER = 8 * 1024 * 1024

/** 日志中截断输出的长度，避免刷屏 */
export const LOG_SNIPPET_LENGTH = 500

/**
 * 无结果的提示文案
 *
 * CLI 的退出码在「无结果」时也是 0，故只能按输出内容判定。
 * 两个 CLI 都使用 `数据为空`；`无分时数据` 来自 clawhub。
 */
export const EMPTY_MESSAGES = ['数据为空', '无分时数据'] as const

/** 失败提示前缀（clawhub 用；Go CLI 的失败文案靠「非表格」兜底判定） */
export const ERROR_PREFIX = '执行失败'

/** 组件缺失时提示的获取命令（两个 CLI 都由同一个 setup 脚本下载） */
export const CLI_SETUP_HINT = 'npm run setup:westock'
