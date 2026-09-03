/**
 * Day 26 — 第三阶段综合:Pinia 风格 Store 的完整类型推导
 *
 * 学习目标(本周工具类型总装):
 *   1. 条件 + infer:UnwrapState / UnwrapGetters
 *   2. 元组手术:DropFirst / BoundActions(Day 24 技能回归)
 *   3. 递归:DeepReadonly(Day 23 复刻)
 *   4. 模板字面量键重映射:ActionEvents(onXxx 订阅器)
 *   5. 交叉 + 索引访问:StoreInstance 总装
 *
 * 协议(与真 Pinia 的差别是刻意简化):
 *   - actions 首参是 state,不搞 ThisType
 *   - store 顶层 = state 平铺 + getters 平铺(解包返回值)
 *     + actions 平铺(砍首参)+ $id/$state/$snapshot/$subscribe
 *
 * 规则:
 *   - never 占位处写实现;throw new Error('TODO') 处填逻辑
 *   - 不允许 any、不允许 as
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// 脚手架(已给出):业务数据
// =============================================================

/**
 * 会话 —— chipRunner 对话列表的单条数据。
 *
 * @example
 *   const c: Conversation = { id: 'c1', title: '部署讨论', updatedAt: '2026-09-03T09:00:00Z', isUnread: true }
 */
export interface Conversation {
  id: string
  title: string
  updatedAt: string
  isUnread: boolean
}

// =============================================================
// Part 1 — 🟢 state 工厂解包
// =============================================================

/**
 * UnwrapState —— state 定义允许"对象"或"返回对象的工厂函数"两种形态,
 * 这个工具统一解包出纯对象类型 S。
 *
 * @example
 *   UnwrapState<{ items: Conversation[] }>                     // => { items: Conversation[] }
 *   UnwrapState<() => { items: Conversation[] }>               // => { items: Conversation[] }
 *   UnwrapState<{ items: Conversation[] } | (() => { items: Conversation[] })>
 *   // => { items: Conversation[] }
 */
export type UnwrapState<ST> = never // ← 替换

// =============================================================
// Part 2 — 🟡 getters / actions 的参数手术
// =============================================================

/**
 * UnwrapGetters —— 把 getter 定义映射成"返回值类型"对象。
 *
 * @example
 *   UnwrapGetters<{ unreadCount: (s: { n: number }) => number }>
 *   // => { unreadCount: number }
 */
export type UnwrapGetters<G> = never // ← 替换

/**
 * DropFirst —— 元组去掉第一个元素(Day 24 元组技能回归)。
 *
 * @example
 *   DropFirst<[1, 2, 3]>  // => [2, 3]
 *   DropFirst<['x']>      // => []
 */
export type DropFirst<T extends readonly unknown[]> = never // ← 替换

/**
 * BoundActions —— actions 平铺到 store 时砍掉首参 state。
 * JSDoc 思考题:为什么 actions 要砍首参,而 getters 不用?
 *
 * @example
 *   BoundActions<{ setFilter: (s: ConvState, f: 'all') => void }>
 *   // => { setFilter: (f: 'all') => void }
 */
export type BoundActions<A> = never // ← 替换

// =============================================================
// Part 3 — 🔴 快照 + 订阅器 + 总装
// =============================================================

/**
 * DeepReadonly —— Day 23 复刻:对象 + 数组递归 readonly。
 * 用于 $snapshot 的返回类型:类型层挡住修改,运行时再配 Object.freeze 双保险。
 *
 * @example
 *   DeepReadonly<{ items: Conversation[] }>['items']
 *   // => readonly Conversation[](元素属性也全 readonly)
 */
export type DeepReadonly<T> = never // ← 替换(Day 23 复刻)

/**
 * ActionEvents —— 按 action 名生成订阅器 map:
 * 键 = `on${Capitalize<action名>}`,值 = (回调) => 取消订阅函数。
 * 回调的参数 = action 砍掉首参后的参数(DropFirst)。
 *
 * @example
 *   ActionEvents<{ markAllRead: (s: ConvState) => void }>
 *   // => { onMarkAllRead: (cb: () => void) => () => void }
 */
export type ActionEvents<A> = never // ← 替换

/**
 * StoreInstance —— definition 对象类型 D 组装成最终 store 类型:
 * state 平铺 & getters 平铺(解包)& actions 平铺(砍首参)
 * & { $id, $state, $snapshot, $subscribe }。
 *
 * @example
 *   const store = defineStore({ id: 'x', state: () => ({ n: 1 }), getters: { double: (s) => s.n * 2 }, actions: { inc: (s) => { s.n++ } } })
 *   store.double  // 类型 number
 *   store.inc     // 类型 () => void
 */
export type StoreInstance<D> = never // ← 替换

/**
 * defineStore —— 迷你 Pinia:签名已给出,填运行时实现。
 * 实现协议见 README Part 3 第 8 条(state 解包 / getters 包装 /
 * actions 注入 state 并触发订阅 / $snapshot 深拷贝冻结 / $subscribe 注册)。
 *
 * @example
 *   const store = defineStore({
 *     id: 'counter',
 *     state: () => ({ n: 1 }),
 *     getters: { double: (s) => s.n * 2 },
 *     actions: { inc: (s) => { s.n += 1 } },
 *   })
 *   store.inc()      // store.n === 2
 *   store.double     // 4
 */
export function defineStore<
  S extends Record<string, unknown>,
  G extends Record<string, (state: S) => unknown>,
  A extends Record<string, (...args: never[]) => unknown>,
>(
  def: {
    id: string
    state: S | (() => S)
    getters: G
    actions: A
  },
): StoreInstance<{ state: S | (() => S); getters: G; actions: A }> {
  void def
  throw new Error('TODO')
}
