// Day 29 验收测试 —— 两部分:
//   1. 行为不变(坏代码的功能语义)+ 类型更严(expectTypeOf / @ts-expect-error)
//   2. 源码扫描判卷(读 solution.ts 源文本,坏味道零命中、JSDoc 数量达标)
import { describe, it, expect, expectTypeOf } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  addTodo,
  toggleTodo,
  renderTodo,
  findTodo,
  createMemoryStorage,
  saveTodos,
} from './solution.js'
import type { Todo, ActiveTodo, DoneTodo, TodoPriority, CreateTodoInput, KVStorage } from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const sampleActive: ActiveTodo = {
  status: 'active',
  id: 't1',
  title: '写周报',
  priority: 'medium',
  createdAt: '2026-09-03T09:00:00Z',
}

const sampleDone: DoneTodo = {
  status: 'done',
  id: 't2',
  title: '配置严格模式',
  priority: 'high',
  createdAt: '2026-09-02T09:00:00Z',
  completedAt: '2026-09-02T10:00:00Z',
}

const list: Todo[] = [sampleActive, sampleDone]

// KVStorage 签名探针:只参与类型检查,不调用
function probeKVStorage(s: KVStorage): void {
  const raw = s.get('k')
  expectTypeOf(raw).toEqualTypeOf<string | null>()
  s.set('k', 'v')
  s.remove('k')
}

// =============================================================
// 行为不变:renderTodo / findTodo
// =============================================================

describe('Day 29 — 行为不变:renderTodo', () => {
  it('输出格式与坏代码一致:active => [ ] 标题', () => {
    expect(renderTodo(sampleActive)).toBe('[ ] 写周报')
  })

  it('done => [x] 标题', () => {
    expect(renderTodo(sampleDone)).toBe('[x] 配置严格模式')
  })

  it('切换后再渲染,前缀跟着变', () => {
    const toggled = toggleTodo(sampleActive)
    expect(renderTodo(toggled)).toBe('[x] 写周报')
    expect(renderTodo(toggleTodo(toggled))).toBe('[ ] 写周报')
  })
})

describe('Day 29 — 行为不变:findTodo', () => {
  it('命中返回元素,未命中返回 undefined', () => {
    expect(findTodo(list, 't1')).toBe(sampleActive)
    expect(findTodo(list, 'missing')).toBeUndefined()
  })

  it('返回类型是 Todo | undefined(不再是 any)', () => {
    expectTypeOf(findTodo(list, 't1')).toEqualTypeOf<Todo | undefined>()
  })
})

// =============================================================
// 允许的修复:addTodo 纯函数化 / toggleTodo 丢 completedAt
// =============================================================

describe('Day 29 — 修复①:addTodo 纯函数化', () => {
  it('不改入参数组,返回新数组', () => {
    const before: Todo[] = [sampleActive]
    const after = addTodo(before, { title: '新任务' })
    expect(before).toHaveLength(1) // 入参没被动过
    expect(after).toHaveLength(2)
    expect(after).not.toBe(before)
  })

  it('新待办:active、priority 默认 medium、tags 默认 []、id/createdAt 自动生成', () => {
    const after = addTodo([], { title: '新任务' })
    const added = after[0]
    expect(added).toBeDefined()
    if (!added) throw new Error('不可能:长度为 1')
    expect(added.status).toBe('active')
    expect(added.title).toBe('新任务')
    if (added.status !== 'active') throw new Error('收窄失败')
    expect(added.priority).toBe('medium')
    expect(added.tags).toEqual([])
    expect(typeof added.id).toBe('string')
    expect(added.id.length).toBeGreaterThan(0)
    expect(Number.isNaN(Date.parse(added.createdAt))).toBe(false)
  })

  it('显式传 priority 时透传', () => {
    const after = addTodo([], { title: 'x', priority: 'high' })
    const added = after[0]
    if (!added) throw new Error('不可能:长度为 1')
    if (added.status !== 'active') throw new Error('收窄失败')
    expect(added.priority).toBe('high')
  })

  it('返回类型是 Todo[]', () => {
    expectTypeOf(addTodo([], { title: 'x' })).toEqualTypeOf<Todo[]>()
  })
})

describe('Day 29 — 修复②:toggleTodo 丢 completedAt', () => {
  it('done → active 后 completedAt 键消失(坏味道⑤的 bug 已修)', () => {
    const r = toggleTodo(sampleDone)
    expect(r.status).toBe('active')
    expect('completedAt' in r).toBe(false)
  })

  it('active → done 补 completedAt', () => {
    const r = toggleTodo(sampleActive)
    expect(r.status).toBe('done')
    if (r.status !== 'done') throw new Error('收窄失败')
    expect(Number.isNaN(Date.parse(r.completedAt))).toBe(false)
  })

  it('不可变:入参对象不被修改', () => {
    toggleTodo(sampleDone)
    expect(sampleDone.status).toBe('done')
    expect(sampleDone.completedAt).toBe('2026-09-02T10:00:00Z')
  })
})

// =============================================================
// 架构:存储依赖注入
// =============================================================

describe('Day 29 — 修复③:存储依赖注入', () => {
  it('createMemoryStorage:与 localStorage 同构的行为', () => {
    const s = createMemoryStorage()
    expect(s.get('missing')).toBe(null)
    s.set('k', 'v')
    expect(s.get('k')).toBe('v')
    s.remove('k')
    expect(s.get('k')).toBe(null)
  })

  it('saveTodos:序列化行为与坏代码一致(JSON 字符串)', () => {
    const s = createMemoryStorage()
    saveTodos(s, 'todos', list)
    const raw = s.get('todos')
    expect(typeof raw).toBe('string')
    expect(JSON.parse(raw ?? 'null')).toEqual(list)
  })

  it('KVStorage 签名探针', () => {
    expectTypeOf(probeKVStorage).toBeFunction()
    expectTypeOf<keyof KVStorage>().toEqualTypeOf<'get' | 'set' | 'remove'>()
  })
})

// =============================================================
// 类型更严:判别联合 + 反例
// =============================================================

describe('Day 29 — 类型更严', () => {
  it('TodoPriority 三档 / status 字面量 / completedAt 只在 done', () => {
    expectTypeOf<TodoPriority>().toEqualTypeOf<'low' | 'medium' | 'high'>()
    expectTypeOf<Todo['status']>().toEqualTypeOf<'active' | 'done'>()
    expectTypeOf<keyof ActiveTodo>().toEqualTypeOf<
      'status' | 'id' | 'title' | 'priority' | 'createdAt' | 'tags'
    >()
    expectTypeOf<DoneTodo['completedAt']>().toEqualTypeOf<string>()
  })

  it('CreateTodoInput:priority 可选', () => {
    expectTypeOf<keyof CreateTodoInput>().toEqualTypeOf<'title' | 'priority'>()
    expectTypeOf<CreateTodoInput['priority']>().toEqualTypeOf<
      TodoPriority | undefined
    >()
  })

  it('非法输入必须编译报错(反例)', () => {
    // @ts-expect-error —— priority 不在三档
    addTodo([], { title: 'x', priority: 'urgent' })
    // @ts-expect-error —— 缺 title
    addTodo([], { priority: 'low' })
    // @ts-expect-error —— 判别联合:缺字段的对象不是 Todo
    renderTodo({ status: 'active', id: '1' })
    // @ts-expect-error —— id 必须是 string
    findTodo(list, 42)
  })

  it('穷尽检查的效果:renderTodo 返回 string,分支后前缀是字面量', () => {
    expectTypeOf(renderTodo(sampleActive)).toEqualTypeOf<string>()
    // 切换回来的必须是合法 Todo,收窄后字段可访问
    const r = toggleTodo(sampleActive)
    if (r.status === 'done') {
      expectTypeOf(r.completedAt).toEqualTypeOf<string>()
    }
  })
})

// =============================================================
// 源码扫描判卷:坏味道零命中 + JSDoc 数量达标
// =============================================================

describe('Day 29 — 源码扫描判卷', () => {
  const source = readFileSync(new URL('./solution.ts', import.meta.url), 'utf8')

  it('禁止 as any / : any / <any> / any[](坏味道①④⑥⑦)', () => {
    expect(source).not.toMatch(/as\s+any\b/)
    expect(source).not.toMatch(/:\s*any\b/)
    expect(source).not.toMatch(/<any[>,]/)
    expect(source).not.toMatch(/\bany\[\]/)
  })

  it('禁止直连 localStorage(坏味道⑧:扫描 API 调用形态,注释里提到不算)', () => {
    // 匹配 localStorage.getItem / setItem / removeItem 等真实调用
    expect(source).not.toMatch(/\blocalStorage\s*\./)
  })

  it('每个 export 都有 JSDoc(坏味道⑧的另一半)', () => {
    const exportCount = (source.match(/^export /gm) ?? []).length
    const jsdocCount = (source.match(/\/\*\*/g) ?? []).length
    expect(exportCount).toBeGreaterThan(0)
    expect(jsdocCount).toBeGreaterThanOrEqual(exportCount)
  })
})
