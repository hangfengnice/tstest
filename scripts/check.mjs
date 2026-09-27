import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const [mode, ...args] = process.argv.slice(2)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function normalizeDay(value) {
  if (!/^(?:0?[1-9]|[12]\d|30)$/.test(value)) {
    fail(`无效天数：${value}。请输入 1–30，例如 pnpm check:day 06。`)
  }
  return `day${value.padStart(2, '0')}`
}

let days
if (mode === 'day' && args.length === 1) {
  days = [normalizeDay(args[0])]
} else if (mode === 'completed' && args.length === 0) {
  // PROGRESS.md 的验收列是唯一来源；无需再维护一份天数列表。
  const progress = readFileSync(join(root, 'PROGRESS.md'), 'utf8')
  days = [...new Set(progress.split('\n').flatMap((line) => {
    const cells = line.split('|').map((cell) => cell.trim())
    return /^\d+$/.test(cells[1] ?? '') && cells[4]?.startsWith('✅')
      ? [normalizeDay(cells[1])]
      : []
  }))]
  if (days.length === 0) fail('PROGRESS.md 中没有验收列以 ✅ 开头的题目。')
} else {
  fail('用法：pnpm check:day <1–30> 或 pnpm check:completed')
}

for (const day of days) {
  if (!existsSync(join(root, 'src', day, 'solution.ts')) ||
      !existsSync(join(root, 'src', day, 'solution.test.ts'))) {
    fail(`${day} 缺少 solution.ts 或 solution.test.ts，无法验收。`)
  }
}

console.log(`验收范围：${days.join(', ')}`)
const configPath = join(root, 'tsconfig.json')
const config = ts.readConfigFile(configPath, ts.sys.readFile)
const formatHost = {
  getCanonicalFileName: (path) => path,
  getCurrentDirectory: () => root,
  getNewLine: () => '\n',
}

function report(diagnostics) {
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost))
  }
}

if (config.error) {
  report([config.error])
  process.exit(1)
}
const parsed = ts.parseJsonConfigFileContent({
  ...config.config,
  include: days.map((day) => `src/${day}/**/*`),
}, ts.sys, root, { noEmit: true }, configPath)
const program = ts.createProgram(parsed.fileNames, parsed.options)
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
report(diagnostics)
console.log(`类型检查：${diagnostics.length ? '失败' : '通过'}`)

// 上面已按范围检查所有类型断言；此处只运行运行时测试，避免重复全库检查。
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
const result = spawnSync(process.execPath, [
  vitest, 'run', ...days.map((day) => `src/${day}/`), '--typecheck.enabled=false',
], { cwd: root, stdio: 'inherit' })
if (result.error) console.error(result.error.message)
const passed = diagnostics.length === 0 && result.status === 0
console.log(passed ? '验收通过：类型检查与运行时测试均通过。' : '验收失败：请检查上述类型或运行时错误。')
process.exit(passed ? 0 : 1)
