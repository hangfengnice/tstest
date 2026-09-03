// Day 28 验收测试 —— 以运行时断言为主,配少量类型断言与 @ts-expect-error 反例。
// 骨架状态下:类型断言因 never 占位而红,运行时断言因 throw TODO 而红 —— 都是预期的红。
import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  createTodo,
  toggleTodo,
  matchesFilter,
  filterTodos,
  createMemoryStorage,
  saveToStorage,
  loadFromStorage,
  isTodoArray,
} from './solution.js'
import type {
  Todo,
  ActiveTodo,
  DoneTodo,
  FilterStatus,
  CreateTodoInput,
  KVStorage,
} from './solution.js'

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

const sampleActiveTagged: ActiveTodo = {
  status: 'active',
  id: 't2',
  title: '复盘 chipRunner',
  priority: 'high',
  createdAt: '2026-09-03T09:10:00Z',
  tags: ['work', 'chip'],
}

const sampleDone: DoneTodo = {
  status: 'done',
  id: 't3',
  title: '学完判别联合',
  priority: 'low',
  createdAt: '2026-09-02T09:00:00Z',
  completedAt: '2026-09-02T18:00:00Z',
  tags: ['ts'],
}

const sampleUntaggedDone: DoneTodo = {
  status: 'done',
  id: 't4',
  title: '配置严格模式',
  priority: 'low',
  createdAt: '2026-09-01T09:00:00Z',
  completedAt: '2026-09-01T10:00:00Z',
}

const mixed: Todo[] = [sampleActive, sampleActiveTagged, sampleDone, sampleUntaggedDone]

// KVStorage 签名探针:只参与类型检查,不调用
function probeKVStorage(s: KVStorage): void {
  const raw = s.get('k')
  expectTypeOf(raw).toEqualTypeOf<string | null>()
  s.set('k', 'v')
  s.remove('k')
}

// =============================================================
// 🟢 createTodo
// =============================================================

describe('Day 28 — 🟢 createTodo 工厂', () => {
  it('生成 active 待办:id 唯一、createdAt 是合法 ISO、字段透传', () => {
    const t = createTodo({ title: '写周报', priority: 'high' })
    expect(t.status).toBe('active')
    expect(t.title).toBe('写周报')
    expect(t.priority).toBe('high')
    expect(typeof t.id).toBe('string')
    expect(t.id.length).toBeGreaterThan(0)
    expect(Number.isNaN(Date.parse(t.createdAt))).toBe(false)
  })

  it('两次生成的 id 不同', () => {
    const a = createTodo({ title: 'x', priority: 'low' })
    const b = createTodo({ title: 'x', priority: 'low' })
    expect(a.id).not.toBe(b.id)
  })

  it('不传 tags 时,产出对象上没有 tags 键(exactOptionalPropertyTypes 姿势)', () => {
    const t = createTodo({ title: 'x', priority: 'low' })
    expect('tags' in t).toBe(false)
    expect(t.tags).toBeUndefined()
  })

  it('传 tags 时正常透传', () => {
    const t = createTodo({ title: 'x', priority: 'low', tags: ['work'] })
    expect(t.tags).toEqual(['work'])
  })

  it('返回类型是 ActiveTodo', () => {
    expectTypeOf(createTodo({ title: 'x', priority: 'low' })).toEqualTypeOf<ActiveTodo>()
  })

  it('非法输入必须编译报错(反例)', () => {
    // @ts-expect-error —— priority 不在三档内
    createTodo({ title: 'x', priority: 'urgent' })
    // @ts-expect-error —— 缺 title
    createTodo({ priority: 'low' })
    // @ts-expect-error —— tags 不能显式传 undefined(exactOptionalPropertyTypes)
    createTodo({ title: 'x', priority: 'low', tags: undefined })
    // @ts-expect-error —— 不允许调用方自带 status(判别符由工厂负责)
    createTodo({ title: 'x', priority: 'low', status: 'done' })
  })
})

// =============================================================
// 🟡 toggleTodo / matchesFilter / filterTodos
// =============================================================

describe('Day 28 — 🟡 toggleTodo 状态切换', () => {
  it('active → done:补 completedAt,其余字段不变', () => {
    const r = toggleTodo(sampleActive)
    expect(r.status).toBe('done')
    expect(r.id).toBe('t1')
    expect(r.title).toBe('写周报')
    expect(r.priority).toBe('medium')
    if (r.status !== 'done') throw new Error('收窄失败')
    expect(Number.isNaN(Date.parse(r.completedAt))).toBe(false)
  })

  it('done → active:必须丢弃 completedAt', () => {
    const r = toggleTodo(sampleDone)
    expect(r.status).toBe('active')
    expect('completedAt' in r).toBe(false)
    if ('completedAt' in r) return // 运行时兜底:上面的断言保证不会走到这
    // in 收窄后 r 是 ActiveTodo(联合上用 in 判别,属性访问才合法)
    expectTypeOf(r).toEqualTypeOf<ActiveTodo>()
  })

  it('不可变:不修改入参对象', () => {
    toggleTodo(sampleActive)
    toggleTodo(sampleDone)
    expect(sampleActive.status).toBe('active')
    expect('completedAt' in sampleActive).toBe(false)
    expect(sampleDone.status).toBe('done')
    expect(sampleDone.completedAt).toBe('2026-09-02T18:00:00Z')
  })

  it('签名:接受 Todo,返回 Todo', () => {
    expectTypeOf(toggleTodo(sampleActive)).toEqualTypeOf<Todo>()
  })
})

describe('Day 28 — 🟡 matchesFilter 过滤判定', () => {
  it('预设过滤器', () => {
    expect(matchesFilter(sampleActive, 'all')).toBe(true)
    expect(matchesFilter(sampleDone, 'all')).toBe(true)
    expect(matchesFilter(sampleActive, 'active')).toBe(true)
    expect(matchesFilter(sampleDone, 'active')).toBe(false)
    expect(matchesFilter(sampleActive, 'done')).toBe(false)
    expect(matchesFilter(sampleDone, 'done')).toBe(true)
  })

  it('自定义标签过滤器:tags 命中与否', () => {
    expect(matchesFilter(sampleActiveTagged, 'tag:work')).toBe(true)
    expect(matchesFilter(sampleActiveTagged, 'tag:chip')).toBe(true)
    expect(matchesFilter(sampleActiveTagged, 'tag:life')).toBe(false)
  })

  it('tags 不存在的待办,tag: 过滤器不炸、返回 false', () => {
    expect(matchesFilter(sampleActive, 'tag:work')).toBe(false)
    expect(matchesFilter(sampleUntaggedDone, 'tag:ts')).toBe(false)
  })

  it('边界:空标签名(tag:)只匹配空串标签', () => {
    const emptyTagTodo: ActiveTodo = {
      status: 'active',
      id: 't5',
      title: '空标签',
      priority: 'low',
      createdAt: '2026-09-03T09:20:00Z',
      tags: [''],
    }
    expect(matchesFilter(emptyTagTodo, 'tag:')).toBe(true)
    expect(matchesFilter(sampleActiveTagged, 'tag:')).toBe(false)
  })

  it('非法过滤器必须编译报错(反例)', () => {
    // @ts-expect-error —— 预设值拼写错误
    matchesFilter(sampleActive, 'done2')
    // @ts-expect-error —— 大小写敏感
    matchesFilter(sampleActive, 'TAG:work')
  })
})

describe('Day 28 — 🟡 filterTodos 列表过滤', () => {
  it('四个过滤器各自的结果数量', () => {
    expect(filterTodos(mixed, 'all')).toHaveLength(4)
    expect(filterTodos(mixed, 'active')).toHaveLength(2)
    expect(filterTodos(mixed, 'done')).toHaveLength(2)
    expect(filterTodos(mixed, 'tag:work')).toHaveLength(1)
    expect(filterTodos(mixed, 'tag:ts')).toHaveLength(1)
  })

  it('结果元素正确:active 过滤出的都是进行中', () => {
    const actives = filterTodos(mixed, 'active')
    expect(actives[0]?.status).toBe('active')
    expect(actives[1]?.status).toBe('active')
  })

  it('永远返回新数组,不返回原引用(即使 all)', () => {
    const r = filterTodos(mixed, 'all')
    expect(r).not.toBe(mixed)
    expect(r).toEqual(mixed)
  })

  it('签名:readonly 入参 + Todo[] 出参', () => {
    expectTypeOf(filterTodos(mixed, 'all')).toEqualTypeOf<Todo[]>()
    const readonlyInput: readonly Todo[] = mixed
    expect(filterTodos(readonlyInput, 'done')).toHaveLength(2)
  })
})

// =============================================================
// 🔴 存储与 unknown 守卫
// =============================================================

describe('Day 28 — 🔴 createMemoryStorage 内存存储', () => {
  it('set/get/remove 行为与 localStorage 同构', () => {
    const s = createMemoryStorage()
    expect(s.get('missing')).toBe(null)
    s.set('k', 'v1')
    expect(s.get('k')).toBe('v1')
    s.set('k', 'v2') // 覆盖
    expect(s.get('k')).toBe('v2')
    s.remove('k')
    expect(s.get('k')).toBe(null)
    s.remove('not-exist') // 不存在的键不报错
  })

  it('KVStorage 是诚实版:只管字符串(签名探针)', () => {
    expectTypeOf(probeKVStorage).toBeFunction()
    expectTypeOf<keyof KVStorage>().toEqualTypeOf<'get' | 'set' | 'remove'>()
  })
})

describe('Day 28 — 🔴 saveToStorage / loadFromStorage', () => {
  it('往返:保存后加载,深相等(tags 缺失也保持缺失)', () => {
    const s = createMemoryStorage()
    saveToStorage(s, 'todos', mixed)
    expect(loadFromStorage(s, 'todos')).toEqual(mixed)
  })

  it('键不存在 / 已删除 → 返回空数组', () => {
    const s = createMemoryStorage()
    expect(loadFromStorage(s, 'nothing')).toEqual([])
    saveToStorage(s, 'todos', mixed)
    s.remove('todos')
    expect(loadFromStorage(s, 'todos')).toEqual([])
  })

  it('坏 JSON → throw(信息含"损坏")', () => {
    const s = createMemoryStorage()
    s.set('todos', '{{{ 这不是 JSON')
    expect(() => loadFromStorage(s, 'todos')).toThrow(/损坏/)
  })

  it('合法 JSON 但形状不对 → throw', () => {
    const s = createMemoryStorage()
    s.set('todos', JSON.stringify({ id: 1, title: '形状不对' }))
    expect(() => loadFromStorage(s, 'todos')).toThrow(/损坏/)
  })

  it('守卫完备性:每种脏数据都得被拒(direct isTodoArray 断言)', () => {
    expect(isTodoArray(null)).toBe(false)
    expect(isTodoArray('todos')).toBe(false)
    expect(isTodoArray([])).toBe(true)
    expect(isTodoArray([sampleActive, sampleDone])).toBe(true)
    // status 非法
    expect(
      isTodoArray([{ ...sampleActive, status: 'archived' }]),
    ).toBe(false)
    // priority 超出三档
    expect(
      isTodoArray([{ ...sampleActive, priority: 'urgent' }]),
    ).toBe(false)
    // done 缺 completedAt
    expect(
      isTodoArray([{ status: 'done', id: 'x', title: 'x', priority: 'low', createdAt: 'x' }]),
    ).toBe(false)
    // tags 不是字符串数组
    expect(
      isTodoArray([{ ...sampleActive, tags: [1, 2] }]),
    ).toBe(false)
    // 缺 title
    expect(
      isTodoArray([{ status: 'active', id: 'x', priority: 'low', createdAt: 'x' }]),
    ).toBe(false)
  })

  it('守卫触发 narrowing:unknown 收敛为 Todo[]', () => {
    const raw: unknown = [sampleActive]
    expect(isTodoArray(raw)).toBe(true)
    if (isTodoArray(raw)) {
      expectTypeOf(raw).toEqualTypeOf<Todo[]>()
    }
  })

  it('签名:loadFromStorage 返回 Todo[]', () => {
    const s = createMemoryStorage()
    expectTypeOf(loadFromStorage(s, 'todos')).toEqualTypeOf<Todo[]>()
  })
})

// =============================================================
// 组合场景:类型反例(CreateTodoInput / FilterStatus)
// =============================================================

describe('Day 28 — 类型反例', () => {
  it('CreateTodoInput 的键集合精确(title/priority/tags)', () => {
    expectTypeOf<keyof CreateTodoInput>().toEqualTypeOf<'title' | 'priority' | 'tags'>()
  })

  it('FilterStatus 模板字面量仍在', () => {
    expectTypeOf<FilterStatus>().toEqualTypeOf<
      'all' | 'active' | 'done' | `tag:${string}`
    >()
    const f: FilterStatus = 'tag:work'
    // @ts-expect-error —— 不是 tag: 前缀也不是预设值
    const bad: FilterStatus = 'work'
    void [f, bad]
  })
})
