import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  defineStore,
  type Conversation,
  type UnwrapState,
  type UnwrapGetters,
  type DropFirst,
  type BoundActions,
  type DeepReadonly,
  type ActionEvents,
  type StoreInstance,
} from './solution.js'

// =============================================================
// 测试数据与工厂 —— makeStore 只定义不调用,
// defineStore 的 throw 只会让 it 失败,不影响文件 collect
// =============================================================

const seed: Conversation[] = [
  { id: 'c1', title: '部署讨论', updatedAt: '2026-09-03T09:00:00Z', isUnread: true },
  { id: 'c2', title: '周会纪要', updatedAt: '2026-09-03T10:00:00Z', isUnread: false },
]

type ConvState = { items: Conversation[]; filter: 'all' | 'unread' }

type ConvGetters = {
  unreadCount: (s: ConvState) => number
  visible: (s: ConvState) => Conversation[]
}

type ConvActions = {
  addConversation: (s: ConvState, c: Conversation) => void
  markAllRead: (s: ConvState) => void
  setFilter: (s: ConvState, f: 'all' | 'unread') => void
}

function makeStore() {
  return defineStore({
    id: 'conversations',
    state: (): ConvState => ({ items: [...seed], filter: 'all' }),
    getters: {
      unreadCount: (s: ConvState) => s.items.filter((c) => c.isUnread).length,
      visible: (s: ConvState) =>
        s.filter === 'all' ? s.items : s.items.filter((c) => c.isUnread),
    },
    actions: {
      addConversation(s: ConvState, c: Conversation): void {
        s.items.push(c)
      },
      markAllRead(s: ConvState): void {
        s.items.forEach((c) => {
          c.isUnread = false
        })
      },
      setFilter(s: ConvState, f: 'all' | 'unread'): void {
        s.filter = f
      },
    },
  })
}

// =============================================================
// Part 1 — 🟢 UnwrapState
// =============================================================

describe('Day 26 — Part 1 UnwrapState', () => {
  it('对象 / 工厂函数 / 两者的联合,统一解包出纯 state 类型', () => {
    expectTypeOf<UnwrapState<ConvState>>().toEqualTypeOf<ConvState>()
    expectTypeOf<UnwrapState<() => ConvState>>().toEqualTypeOf<ConvState>()
    expectTypeOf<UnwrapState<ConvState | (() => ConvState)>>().toEqualTypeOf<ConvState>()
  })
})

// =============================================================
// Part 2 — 🟡 UnwrapGetters / DropFirst / BoundActions
// =============================================================

describe('Day 26 — Part 2 getters / actions 参数手术', () => {
  it('UnwrapGetters:getter 函数映射成返回值类型', () => {
    expectTypeOf<UnwrapGetters<ConvGetters>>().toEqualTypeOf<{
      unreadCount: number
      visible: Conversation[]
    }>()
  })

  it('DropFirst:元组去首元素,空元组兜底为 []', () => {
    expectTypeOf<DropFirst<[1, 2, 3]>>().toEqualTypeOf<[2, 3]>()
    expectTypeOf<DropFirst<['x']>>().toEqualTypeOf<[]>()
    expectTypeOf<DropFirst<[]>>().toEqualTypeOf<[]>()
  })

  it('BoundActions:action 平铺时砍掉首参 state', () => {
    expectTypeOf<BoundActions<ConvActions>>().toEqualTypeOf<{
      addConversation: (c: Conversation) => void
      markAllRead: () => void
      setFilter: (f: 'all' | 'unread') => void
    }>()
  })
})

// =============================================================
// Part 3 — 🔴 DeepReadonly / ActionEvents / StoreInstance
// =============================================================

describe('Day 26 — Part 3 快照与订阅器', () => {
  it('DeepReadonly 复刻:快照数组的元素属性全只读', () => {
    expectTypeOf<DeepReadonly<ConvState>['items']>().toEqualTypeOf<
      readonly {
        readonly id: string
        readonly title: string
        readonly updatedAt: string
        readonly isUnread: boolean
      }[]
    >()
  })

  it('ActionEvents:action 名生成 onXxx,回调参数与 action 一致', () => {
    expectTypeOf<ActionEvents<ConvActions>>().toEqualTypeOf<{
      onAddConversation: (cb: (c: Conversation) => void) => () => void
      onMarkAllRead: (cb: () => void) => () => void
      onSetFilter: (cb: (f: 'all' | 'unread') => void) => () => void
    }>()
  })

  it('StoreInstance 总装:三层平铺 + 四个 $ 方法', () => {
    type Def = {
      state: () => ConvState
      getters: ConvGetters
      actions: ConvActions
    }
    expectTypeOf<StoreInstance<Def>>().toEqualTypeOf<
      ConvState & {
        unreadCount: number
        visible: Conversation[]
      } & {
        addConversation: (c: Conversation) => void
        markAllRead: () => void
        setFilter: (f: 'all' | 'unread') => void
      } & {
        $id: string
        $state: ConvState
        $snapshot: () => DeepReadonly<ConvState>
        $subscribe: ActionEvents<ConvActions>
      }
    >()
  })
})

// =============================================================
// defineStore 运行时
// =============================================================

describe('Day 26 — defineStore 运行时', () => {
  it('state 平铺到顶层,getter 反映最新状态', () => {
    const store = makeStore()
    expect(store.items).toHaveLength(2)
    expect(store.unreadCount).toBe(1)
    store.markAllRead()
    expect(store.unreadCount).toBe(0)
    store.setFilter('unread')
    expect(store.visible).toHaveLength(0)
    expect(store.$id).toBe('conversations')
    expect(store.$state.filter).toBe('unread')
  })

  it('action 修改 state 后 getter 跟进', () => {
    const store = makeStore()
    store.addConversation({
      id: 'c3',
      title: '新对话',
      updatedAt: '2026-09-03T11:00:00Z',
      isUnread: true,
    })
    expect(store.items).toHaveLength(3)
    expect(store.unreadCount).toBe(2)
  })

  it('$subscribe.onMarkAllRead:action 后触发,off 后不再触发', () => {
    const store = makeStore()
    let fired = 0
    const off = store.$subscribe.onMarkAllRead(() => {
      fired += 1
    })
    store.markAllRead()
    expect(fired).toBe(1)
    off()
    store.markAllRead()
    expect(fired).toBe(1)
  })

  it('$snapshot:深拷贝隔离,改 store 不影响已取出的快照', () => {
    const store = makeStore()
    const snap = store.$snapshot()
    expect(snap.items).toHaveLength(2)
    store.markAllRead()
    expect(snap.items[0]?.isUnread).toBe(true)
  })

  it('store 实例各成员类型正确', () => {
    const store = makeStore()
    expectTypeOf(store.$id).toEqualTypeOf<string>()
    expectTypeOf(store.items).toEqualTypeOf<Conversation[]>()
    expectTypeOf(store.filter).toEqualTypeOf<'all' | 'unread'>()
    expectTypeOf(store.unreadCount).toEqualTypeOf<number>()
    expectTypeOf(store.visible).toEqualTypeOf<Conversation[]>()
    expectTypeOf(store.addConversation).toEqualTypeOf<
      (c: Conversation) => void
    >()
    expectTypeOf(store.markAllRead).toEqualTypeOf<() => void>()
    expectTypeOf(store.$subscribe.onMarkAllRead).toEqualTypeOf<
      (cb: () => void) => () => void
    >()
  })

  it('action 参数类型受约束', () => {
    const store = makeStore()
    // @ts-expect-error —— addConversation 需要 Conversation,不能传 string
    store.addConversation('不是会话')
  })
})
