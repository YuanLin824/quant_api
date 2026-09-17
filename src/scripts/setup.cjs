#!/usr/bin/env node
'use strict'

/**
 * 下载 WESTOCK CLI 二进制到本脚本所在目录（跨平台，需 Node ≥ 18）
 *
 * 复制自 WESTOCK 技能包提供的安装脚本并做了裁剪：
 * - 只把对应平台的二进制落到 scripts/ 目录，不再安装到 ~/.local/bin、不再改 PATH
 * - 相应去掉 -d/--bindir 与 -y/--yes（不触碰系统环境，故无需确认）
 * - 保留平台检测、版本解析与 SHA256 两级校验（信任根 → SHA256.txt → 二进制）
 * - 目标已存在时直接跳过（本脚本由启动/打包前的 npm pre 钩子反复调用，重复下载没有意义；
 *   需要重新拉取时加 -f/--force）
 */

const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const BIN_NAME = 'westock'

/** 二进制与脚本同目录存放 */
const SCRIPTS_DIR = __dirname

// CLI 官方发布源（默认下载基址，形如 https://<host>/release/<channel>/cli）。
// 占位符未被替换时（本地直接运行源码）视为空。
const CLI_BASE_DEFAULT = 'https://stockbuddy.qq.com/release/clawhub/cli'

// 发布时注入的「SHA256.txt 清单文件」自身哈希（信任根，独立于 CDN）。
// 校验链：脚本内固定哈希 → 校验 SHA256.txt 未被篡改 → SHA256.txt 校验二进制。
// 占位符未被替换（本地源码运行）时视为空，退回仅校验二进制（兼容本地开发）。
const PINNED_MANIFEST_SHA256 = '78a44b270812bd641735f47f58de31b6ee7638c6c79377ac7eb4230d3639b437'

// 发布时注入的「发布版本 tag」（与该版本 SHA256.txt 信任根配套）。
// 下载时优先用它确定版本（而非 CDN 上的 latest.txt），保证清单哈希信任根
// 始终对应该版本；追新交给 CLI 运行时自检升级。占位符未替换时为空，退回读 latest.txt。
const PINNED_VERSION = 'v0.0.2'

// 是否配置了 pinned 信任根（占位符已被发布流程替换为真实哈希）。
// 哨兵用拼接构造，避免发布期 replaceAll 把这里的比较基准也一并替换。
function hasPinned() {
  const sentinel = '__PINNED_' + 'MANIFEST_SHA256__'
  return PINNED_MANIFEST_SHA256 && PINNED_MANIFEST_SHA256 !== sentinel
}

// 是否注入了固定发布版本（占位符已被发布流程替换为真实 tag）。
function hasPinnedVersion() {
  const sentinel = '__PINNED_' + 'VERSION__'
  return PINNED_VERSION && PINNED_VERSION !== sentinel
}

function parseArgs(argv) {
  const opts = {
    base: '',
    version: '',
    dryRun: false,
    force: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '-b' || a === '--base') opts.base = argv[++i]
    else if (a === '-v' || a === '--version') opts.version = argv[++i]
    else if (a === '-n' || a === '--dry-run') opts.dryRun = true
    else if (a === '-f' || a === '--force') opts.force = true
    else if (a === '-h' || a === '--help') opts.help = true
    else {
      console.error(`未知参数: ${a}`)
      process.exit(1)
    }
  }
  return opts
}

function detectArtifact() {
  const platform = os.platform()
  const arch = os.arch()
  let goos
  let goarch
  if (platform === 'darwin') goos = 'darwin'
  else if (platform === 'linux') goos = 'linux'
  else if (platform === 'win32') goos = 'windows'
  else {
    console.error(`不支持的操作系统: ${platform}（请使用 setup.sh / setup.ps1）`)
    process.exit(1)
  }
  if (arch === 'x64') goarch = 'amd64'
  else if (arch === 'arm64') goarch = 'arm64'
  else {
    console.error(`不支持的架构: ${arch}`)
    process.exit(1)
  }
  const ext = goos === 'windows' ? '.exe' : ''
  return { artifact: `westock-${goos}-${goarch}${ext}`, ext }
}

async function httpGetText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

async function httpGetBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf
}

function readFirstLine(text) {
  return text.split(/\r?\n/).find((l) => l.trim() !== '') || ''
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toLowerCase()
}

function resolveBase(opts) {
  if (opts.base) return opts.base.replace(/\/+$/, '')
  if (CLI_BASE_DEFAULT.startsWith('http')) return CLI_BASE_DEFAULT.replace(/\/+$/, '')
  return ''
}

// 语义化版本比较：a > b 返回 1，a < b 返回 -1，相等返回 0
function compareVersion(a, b) {
  const pa = a.replace(/^v/, '').split(/[-+]/)[0].split('.').map(Number)
  const pb = b.replace(/^v/, '').split(/[-+]/)[0].split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

// 本地模式（bundled 渠道无 latest.txt 时的兜底）：枚举 base 下 v* 目录返回最大版本 tag
function latestLocalTag(baseDir) {
  let best = ''
  try {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('v')) continue
      if (!/^v\d+\.\d+\.\d+/.test(entry.name)) continue
      if (best === '' || compareVersion(entry.name, best) > 0) best = entry.name
    }
  } catch {
    // 忽略目录读取错误
  }
  return best
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(`westock 二进制下载脚本（跨平台，需 Node ≥ 18）

把对应平台的二进制下载到本脚本所在目录（scripts/），不做系统级安装、不改 PATH。

用法:
  node scripts/setup.cjs                      # 下载固定版本到 scripts/
  node scripts/setup.cjs -v v1.2.3            # 指定版本
  node scripts/setup.cjs --help

参数（全部可选）:
  -b, --base URL     远程发布基址 (默认: 官方发布源)
  -v, --version VER  指定版本 (默认固定版本)
  -f, --force        目标已存在时也重新下载
  -n, --dry-run      只打印不执行
  -h, --help         显示帮助`)
    process.exit(0)
  }

  const { artifact, ext } = detectArtifact()
  const base = resolveBase(opts)
  const isRemote = base.startsWith('http')

  let version = opts.version
  // 发布产物注入了固定版本时优先使用，避免读 CDN 的 latest.txt 导致旧包指向新版本、
  // 与包内固定的 SHA256.txt 清单信任根失配（版本 tag 由构建期注入）。
  if (!version) {
    if (hasPinnedVersion()) {
      version = PINNED_VERSION
    } else if (isRemote) {
      try {
        version = readFirstLine(await httpGetText(`${base}/latest.txt`)).trim()
      } catch (e) {
        console.error(`无法获取 latest.txt: ${e.message}`)
        process.exit(1)
      }
    } else {
      let v = ''
      try {
        v = readFirstLine(fs.readFileSync(path.join(base, 'latest.txt'), 'utf8')).trim()
      } catch {
        v = latestLocalTag(base)
      }
      if (!v) {
        console.error('未找到 latest.txt，且 base 下无可用 v* 版本目录，请用 -v 指定版本')
        process.exit(1)
      }
      version = v
    }
  }
  if (!version.startsWith('v')) version = `v${version}`

  const relative = `${version}/${artifact}`
  const src = isRemote ? `${base}/${relative}` : path.join(base, relative)
  const dest = path.join(SCRIPTS_DIR, `${BIN_NAME}${ext}`)

  console.log(`将下载: ${BIN_NAME} ${version}`)
  console.log(`  源:   ${src}`)
  console.log(`  目标: ${dest}`)
  if (opts.dryRun) {
    console.log('(dry-run) 未做任何改动')
    process.exit(0)
  }

  // 已存在则跳过：本脚本由 npm 的 pre 钩子反复调用，每次重新下载 3.1MB 没有意义。
  if (!opts.force && fs.existsSync(dest)) {
    console.log(`已存在，跳过下载: ${dest}`)
    console.log('（如需强制重新下载，请加 -f/--force）')
    process.exit(0)
  }

  let buf
  if (isRemote) {
    try {
      buf = await httpGetBuffer(src)
    } catch (e) {
      console.error(`下载失败: ${e.message}`)
      process.exit(1)
    }
  } else {
    if (!fs.existsSync(src)) {
      console.error(`找不到二进制: ${src}`)
      process.exit(1)
    }
    buf = fs.readFileSync(src)
  }

  // SHA256 校验
  try {
    let checksumText
    if (isRemote) {
      checksumText = await httpGetText(`${base}/${version}/SHA256.txt`)
    } else {
      checksumText = fs.readFileSync(path.join(base, version, 'SHA256.txt'), 'utf8')
    }

    // 信任根校验：先确认 SHA256.txt 清单本身未被篡改（独立于 CDN 的固定哈希）。
    if (hasPinned()) {
      const manifestActual = sha256Hex(Buffer.from(checksumText, 'utf8'))
      if (manifestActual !== PINNED_MANIFEST_SHA256.toLowerCase()) {
        console.error('SHA256.txt 清单校验失败（疑似 CDN 被篡改），拒绝写入')
        console.error(`  期望: ${PINNED_MANIFEST_SHA256}`)
        console.error(`  实际: ${manifestActual}`)
        process.exit(1)
      }
    }

    const expected = checksumText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.endsWith(artifact))
      ?.split(/\s+/)[0]
      ?.toLowerCase()
    if (expected) {
      const actual = sha256Hex(buf)
      if (actual !== expected) {
        console.error(`SHA256 校验失败: ${artifact}`)
        console.error(`  期望: ${expected}`)
        console.error(`  实际: ${actual}`)
        process.exit(1)
      }
    } else {
      console.warn('未找到对应 SHA256 条目，跳过校验')
    }
  } catch (e) {
    // 已配置固定校验值却拿不到/校验不了 SHA256.txt → 拒绝写入（不静默放行）。
    if (hasPinned()) {
      console.error(`无法校验 SHA256.txt，且已配置固定校验值，拒绝写入: ${e.message}`)
      process.exit(1)
    }
    console.warn(`未找到 SHA256.txt，跳过校验: ${e.message}`)
  }

  fs.writeFileSync(dest, buf)
  if (ext === '') fs.chmodSync(dest, 0o755)

  console.log(`✅ 已下载 → ${dest}`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
