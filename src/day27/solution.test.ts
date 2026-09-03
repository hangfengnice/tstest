// Day 27 验收测试 —— 今天全是类型断言:
// 运行时是空操作,判卷走 typecheck(本仓库 vitest 已开启 typecheck 模式)。
// 骨架是 never 占位,初始必然全红 —— 这是预期的红,红因只能来自 never 不匹配。
import { describe, it, expectTypeOf } from 'vitest'
import type {
  TodoPriority,
  ActiveTodo,
  DoneTodo,
  Todo,
  FilterStatus,
  PresetFilter,
  TagName,
  KVStorage,
  TodoEvents,
  EventName,
  TodoListener,
  TodoStore,
  TodoHandlers,
} from './solution.js'

// 探针函数:只参与类型检查、永不调用(避免 declare const 在运行时被擦除后 ReferenceError)
function probeNarrowing(t: Todo): void {
  if (t.status === 'done') {
    expectTypeOf(t).toEqualTypeOf<DoneTodo>()
    expectTypeOf(t.completedAt).toEqualTypeOf<string>()
  }
  if (t.status === 'active') {
    expectTypeOf(t).toEqualTypeOf<ActiveTodo>()
    expectTypeOf(t.tags).toEqualTypeOf<string[] | undefined>()
  }
}

function probeStorageGet(s: KVStorage): void {
  const todos = s.get<Todo[]>('todos')
  const count = s.get<number>('count')
  expectTypeOf(todos).toEqualTypeOf<Todo[] | null>()
  expectTypeOf(count).toEqualTypeOf<number | null>()
}

function probeStorageSet(s: KVStorage, list: Todo[]): void {
  s.set('todos', list)
  expectTypeOf(s.remove('todos')).toEqualTypeOf<void>()
  // @ts-expect-error —— 显式实例化 set<Todo[]> 后,value 不能传 number
  s.set<Todo[]>('todos', 42)
}

function probeStore(s: TodoStore): void {
  s.on('todoAdded', ({ todo: added }) => {
    expectTypeOf(added).toEqualTypeOf<Todo>()
    return void 0
  })
  s.emit('filterChanged', { from: 'all', to: 'tag:work' })
  // @ts-expect-error —— 传 todoAdded 却给 filterChanged 的载荷
  s.emit('todoAdded', { from: 'all', to: 'tag:work' })
}

// 测试用样例:空待办数组(skeleton 状态下 Todo = never,never[] 仍可赋空数组)
const sampleTodoList: Todo[] = []

// 测试用样例:tags 显式传 undefined 的"坏对象"
const rawWithUndefinedTags = {
  status: 'active' as const,
  id: 't1',
  title: 'x',
  priority: 'low' as const,
  createdAt: '2026-09-03T00:00:00Z',
  tags: undefined,
}

// =============================================================
// 🟢 基础:待办与过滤器
// =============================================================

describe('Day 27 — 🟢 Todo 可辨识联合', () => {
  it('TodoPriority 是三档字面量联合', () => {
    expectTypeOf<TodoPriority>().toEqualTypeOf<'low' | 'medium' | 'high'>()
  })

  it('ActiveTodo 的键集合精确(status/id/title/priority/createdAt/tags)', () => {
    // keyof 断言:多一个键(比如 completedAt)或少一个键都会挂
    expectTypeOf<keyof ActiveTodo>().toEqualTypeOf<
      'status' | 'id' | 'title' | 'priority' | 'createdAt' | 'tags'
    >()
  })

  it('DoneTodo 的键集合精确(比 ActiveTodo 多 completedAt)', () => {
    expectTypeOf<keyof DoneTodo>().toEqualTypeOf<
      'status' | 'id' | 'title' | 'priority' | 'createdAt' | 'tags' | 'completedAt'
    >()
  })

  it('字段类型精确:status 字面量 / priority 引用 TodoPriority / tags 可选', () => {
    expectTypeOf<ActiveTodo['status']>().toEqualTypeOf<'active'>()
    expectTypeOf<DoneTodo['status']>().toEqualTypeOf<'done'>()
    expectTypeOf<ActiveTodo['priority']>().toEqualTypeOf<TodoPriority>()
    // exactOptionalPropertyTypes 下,tags?: string[] 的索引访问是 string[] | undefined
    expectTypeOf<ActiveTodo['tags']>().toEqualTypeOf<string[] | undefined>()
    expectTypeOf<DoneTodo['completedAt']>().toEqualTypeOf<string>()
  })

  it('Todo 的 status 是 active | done 联合', () => {
    expectTypeOf<Todo['status']>().toEqualTypeOf<'active' | 'done'>()
  })

  it('status === 判别符收窄后,类型精确到分支', () => {
    // 断言在 probeNarrowing 函数体里(声明即检查,不需要调用)
    expectTypeOf(probeNarrowing).toBeFunction()
  })

  it('Extract 能按判别符取出分支(宽 string 判别符做不到)', () => {
    expectTypeOf<Extract<Todo, { status: 'done' }>>().toEqualTypeOf<DoneTodo>()
    expectTypeOf<Extract<Todo, { status: 'active' }>>().toEqualTypeOf<ActiveTodo>()
  })

  it('宽 status 的对象不属于 Todo(判别符不能是 string)', () => {
    expectTypeOf<{ status: string }>().not.toMatchTypeOf<Todo>()
  })

  it('exactOptionalPropertyTypes:tags 不能显式传 undefined', () => {
    // @ts-expect-error —— tags: undefined 与 tags?: string[](exact 模式)不兼容
    const bad: ActiveTodo = rawWithUndefinedTags
    expectTypeOf(bad).toMatchTypeOf<ActiveTodo>()
  })
})

describe('Day 27 — 🟢 FilterStatus 模板字面量', () => {
  it('FilterStatus = 三个预设 + tag: 前缀的自定义过滤器', () => {
    expectTypeOf<FilterStatus>().toEqualTypeOf<
      'all' | 'active' | 'done' | `tag:${string}`
    >()
  })

  it('合法与非法的 FilterStatus 值', () => {
    const f1: FilterStatus = 'all'
    const f2: FilterStatus = 'active'
    const f3: FilterStatus = 'done'
    const f4: FilterStatus = 'tag:work'
    const f5: FilterStatus = 'tag:' // 空标签名也合法
    // @ts-expect-error —— 大小写敏感,不是 tag: 前缀
    const bad1: FilterStatus = 'TAG:work'
    // @ts-expect-error —— 预设值拼写错误
    const bad2: FilterStatus = 'done2'
    // 合法性由 f1~f5 赋值能编译、bad1/bad2 被 @ts-expect-error 命中证明
    void [f1, f2, f3, f4, f5, bad1, bad2]
  })
})

// =============================================================
// 🟡 进阶:存储接口与事件映射
// =============================================================

describe('Day 27 — 🟡 KVStorage 泛型接口', () => {
  it('恰好三个成员:get / set / remove', () => {
    expectTypeOf<keyof KVStorage>().toEqualTypeOf<'get' | 'set' | 'remove'>()
  })

  it('get 是泛型方法:调用点实例化,返回 T | null', () => {
    expectTypeOf(probeStorageGet).toBeFunction()
  })

  it('set 的 value 类型由 T 推断;remove 返回 void', () => {
    expectTypeOf(probeStorageSet).toBeFunction()
    void sampleTodoList
  })
})

describe('Day 27 — 🟡 事件映射', () => {
  it('TodoEvents 三个事件的载荷形状(引用 Todo/FilterStatus 自洽)', () => {
    expectTypeOf<TodoEvents['todoAdded']>().toEqualTypeOf<{ todo: Todo }>()
    expectTypeOf<TodoEvents['todoToggled']>().toEqualTypeOf<{
      id: string
      status: Todo['status']
    }>()
    expectTypeOf<TodoEvents['filterChanged']>().toEqualTypeOf<{
      from: FilterStatus
      to: FilterStatus
    }>()
  })

  it('EventName = keyof TodoEvents;TodoListener<K> 按事件取载荷', () => {
    expectTypeOf<EventName>().toEqualTypeOf<
      'todoAdded' | 'todoToggled' | 'filterChanged'
    >()
    expectTypeOf<TodoListener<'todoAdded'>>().toEqualTypeOf<
      (payload: TodoEvents['todoAdded']) => void
    >()
    expectTypeOf<TodoListener<'filterChanged'>>().toEqualTypeOf<
      (payload: TodoEvents['filterChanged']) => void
    >()
  })
})

describe('Day 27 — 🟡 TodoStore 索引关联签名', () => {
  it('on/emit 的事件名与载荷相关联', () => {
    expectTypeOf<TodoStore>().toEqualTypeOf<{
      on: <K extends EventName>(event: K, listener: TodoListener<K>) => void
      emit: <K extends EventName>(event: K, payload: TodoEvents[K]) => void
    }>()
  })

  it('调用侧自动对齐载荷类型', () => {
    expectTypeOf(probeStore).toBeFunction()
  })
})

// =============================================================
// 🔴 边界:类型体操三连
// =============================================================

describe('Day 27 — 🔴 PresetFilter / TagName / TodoHandlers', () => {
  it('PresetFilter:Exclude 掉所有 tag: 开头的值', () => {
    expectTypeOf<PresetFilter>().toEqualTypeOf<'all' | 'active' | 'done'>()
    const f: PresetFilter = 'done'
    // @ts-expect-error —— tag:work 不是预设过滤器
    const bad: PresetFilter = 'tag:work'
    // f 能赋值、bad 被 @ts-expect-error 命中,即为验收
    void [f, bad]
  })

  it('TagName:infer 抠出标签名,空标签名是空串,非 tag: 前缀是 never', () => {
    expectTypeOf<TagName<'tag:work'>>().toEqualTypeOf<'work'>()
    expectTypeOf<TagName<'tag:'>>().toEqualTypeOf<''>()
    expectTypeOf<TagName<'all'>>().toEqualTypeOf<never>()
    expectTypeOf<TagName<'done'>>().toEqualTypeOf<never>()
  })

  it('TodoHandlers:on 前缀 + 首字母大写,值是对应监听器', () => {
    expectTypeOf<TodoHandlers>().toEqualTypeOf<{
      onTodoAdded: TodoListener<'todoAdded'>
      onTodoToggled: TodoListener<'todoToggled'>
      onFilterChanged: TodoListener<'filterChanged'>
    }>()
  })

  it('TodoHandlers 的调用侧:handler 就是监听器,载荷类型自动对齐', () => {
    const onToggled: TodoHandlers['onTodoToggled'] = ({ id, status }) => {
      expectTypeOf(id).toEqualTypeOf<string>()
      expectTypeOf(status).toEqualTypeOf<'active' | 'done'>()
      return void 0
    }
    onToggled({ id: 't1', status: 'done' })
    // @ts-expect-error —— 载荷形状错误:status 不是 active/done 字面量
    onToggled({ id: 't1', status: 'finished' })
  })
})
