// 教材维护工具：在临时目录验证答案，不覆盖学习者的实现。
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)
const workspace = mkdtempSync(join(tmpdir(), 'tstest-textbook-'))
const supplied = {
  day15: ['createSignal', 'createMemoryStorage'],
  day19: ['User', 'Pagination', 'Paged'],
  day20: ['OrderStatus', 'FilterValue'],
  day22: ['ComponentEvents'],
}
let overloadVariant

function declarations(source, names) {
  const file = ts.createSourceFile('solution.ts', source, ts.ScriptTarget.Latest, true)
  return names.map((name) => {
    const statement = file.statements.find((item) => item.name?.getText(file) === name)
    if (!statement) throw new Error(`找不到骨架提供的声明：${name}`)
    return statement.getFullText(file)
  }).join('\n')
}

function run(entry, args) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd: workspace, stdio: 'inherit' })
  if (result.error) throw result.error
  return result.status === 0
}

try {
  cpSync(join(root, 'src'), join(workspace, 'src'), { recursive: true })
  for (const name of ['package.json', 'tsconfig.json', 'vitest.config.ts']) {
    cpSync(join(root, name), join(workspace, name))
  }
  symlinkSync(join(root, 'node_modules'), join(workspace, 'node_modules'), 'junction')
  for (let i = 6; i <= 30; i++) {
    const day = `day${String(i).padStart(2, '0')}`
    const directory = join(root, 'src', day)
    const answer = readFileSync(join(directory, 'ANSWER.md'), 'utf8')
    const section = answer.split('## 一、参考实现')[1]?.split('## 二')[0]
    if (!section) throw new Error(`${day} 缺少参考实现章节`)
    const blocks = [...section.matchAll(/^```ts\n([\s\S]*?)^```/gm)].map((match) => match[1])
    const expected = day === 'day18' ? 6 : ['day09', 'day16'].includes(day) ? 2 : 1
    if (blocks.length !== expected) throw new Error(`${day} 参考代码块数量变化，请更新提取规则`)
    if (day === 'day16') {
      writeFileSync(join(workspace, 'src', day, 'legacy-config.d.ts'), blocks[0])
      writeFileSync(join(workspace, 'src', day, 'solution.ts'), blocks[1])
      continue
    }
    const skeleton = readFileSync(join(directory, 'solution.ts'), 'utf8')
    let prefix = supplied[day] ? declarations(skeleton, supplied[day]) : ''
    if (day === 'day18') {
      if (!skeleton.includes('// 任务 1 —')) throw new Error('Day 18 库代码分界标记缺失')
      prefix = skeleton.split('// 任务 1 —')[0]
    }
    const implementation = day === 'day18' ? blocks.join('\n') : blocks[0]
    if (day === 'day09') {
      const parsed = ts.createSourceFile('solution.ts', implementation, ts.ScriptTarget.Latest, true)
      const original = parsed.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === 'validateRegisterForm')
      if (!original) throw new Error('Day 9 主实现缺少 validateRegisterForm')
      overloadVariant = implementation.slice(0, original.getStart(parsed)) + blocks[1] + implementation.slice(original.end)
    }
    writeFileSync(join(workspace, 'src', day, 'solution.ts'), `${prefix}\n${implementation}`)
  }
  mkdirSync(join(workspace, 'src', 'textbook'))
  cpSync(join(root, 'scripts/textbook-probes.test.ts'), join(workspace, 'src/textbook/probes.test.ts'))
  console.log(`教材验证：Day 1–5 当前实现 + Day 6–30 主参考实现；TypeScript ${ts.version}`)
  const typesPassed = run(require.resolve('typescript/lib/tsc.js'), ['--noEmit', '-p', 'tsconfig.json'])
  const runtimePassed = run(join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), ['run', '--typecheck.enabled=false'])
  if (!overloadVariant) throw new Error('未提取 Day 9 重载替代实现')
  console.log('追加验证：Day 9 重载替代实现（相同的类型与运行时验收）。')
  writeFileSync(join(workspace, 'src/day09/solution.ts'), overloadVariant)
  const overloadTypesPassed = run(require.resolve('typescript/lib/tsc.js'), ['--noEmit', '-p', 'tsconfig.json'])
  const overloadRuntimePassed = run(join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), ['run', 'src/day09/', '--typecheck.enabled=false'])
  process.exitCode = typesPassed && runtimePassed && overloadTypesPassed && overloadRuntimePassed ? 0 : 1
  console.log(process.exitCode === 0 ? '教材验证通过（含勘误探针）。' : '教材验证失败，请检查上方输出。')
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
