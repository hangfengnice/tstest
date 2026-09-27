# Day 26 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 26` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 题面修订说明

题面与骨架已统一：actions 约束保留首参 state；最终返回处允许一次带说明的类型断言。
参考实现通过动态循环构造泛型映射成员，编译器不能从这些赋值自动证明最终结构。
这说明本实现需要一个明确的证明边界，不代表所有可能的实现都已被证明无法零断言。
getter 对外是属性值，通过访问器在每次读取时重新计算，不是对外暴露的无参方法。

## 一、参考实现

已通过本 day 全部验收测试:运行时 13/13,vitest typecheck 模式 13/13,`pnpm typecheck` 中 day26 错误清零。

```ts
/**
 * Day 26 — 第三阶段综合:Pinia 风格 Store 的完整类型推导
 *
 * 协议(与真 Pinia 的差别是刻意简化):
 *   - actions 首参是 state,不搞 ThisType
 *   - store 顶层 = state 平铺 + getters 平铺(解包返回值)
 *     + actions 平铺(砍首参)+ $id/$state/$snapshot/$subscribe
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
 * 为什么工厂分支写在条件前面?
 * 1. 条件类型按顺序匹配,`() => S` 是更"具体"的分支,先测它;
 * 2. 遇到联合 `S | (() => S)` 时条件类型会**分发**:两个成员各算一遍,
 *    `S` 走 else 分支原样返回、`() => S` 走 infer 分支解包,
 *    最后联合回 `S | S` 自动折叠成 `S` —— 工厂和对象两种写法殊途同归。
 *
 * @example
 *   UnwrapState<{ items: Conversation[] }>                     // => { items: Conversation[] }
 *   UnwrapState<() => { items: Conversation[] }>               // => { items: Conversation[] }
 *   UnwrapState<{ items: Conversation[] } | (() => { items: Conversation[] })>
 *   // => { items: Conversation[] }(分发后联合折叠)
 */
export type UnwrapState<ST> = ST extends () => infer S ? S : ST

// =============================================================
// Part 2 — 🟡 getters / actions 的参数手术
// =============================================================

/**
 * UnwrapGetters —— 把 getter 定义映射成"返回值类型"对象。
 *
 * 为什么不直接 `ReturnType<G[K]>`?
 * `ReturnType` 的签名约束是 `T extends (...args: any) => any`,
 * 而这里的 G[K] 是**还没实例化的泛型索引**,TS 只知道它"可能是任何东西",
 * 不满足 ReturnType 的约束,直接编译报错。
 * 写成 `G[K] extends (...args: never[]) => infer R` 一石二鸟:
 * 条件类型本身承担"是不是函数"的检查,infer 顺手把返回值抠出来。
 *
 * @example
 *   UnwrapGetters<{ unreadCount: (s: { n: number }) => number }>
 *   // => { unreadCount: number }
 */
export type UnwrapGetters<G> = {
  [K in keyof G]: G[K] extends (...args: never[]) => infer R ? R : never
}

/**
 * DropFirst —— 元组去掉第一个元素(Day 24 元组技能回归)。
 *
 * 两个细节:
 * 1. 约束是 `readonly unknown[]`:既接受可变元组也接受只读元组
 *    (readonly 数组是可变数组的超类型,反过来不行);
 * 2. 空元组 `[]` 匹配不上 `[unknown, ...infer Rest]`,走 else 兜底成 `[]`
 *    —— 不兜底的话 DropFirst<[]> 会把 never 漏出去污染上层。
 *
 * @example
 *   DropFirst<[1, 2, 3]>  // => [2, 3]
 *   DropFirst<['x']>      // => []
 *   DropFirst<[]>         // => [](兜底)
 */
export type DropFirst<T extends readonly unknown[]> = T extends readonly [
  unknown,
  ...infer Rest,
]
  ? Rest
  : []

/**
 * BoundActions —— actions 平铺到 store 时砍掉首参 state。
 *
 * JSDoc 思考题:为什么 actions 要砍首参,而 getters 不用?
 * 答:平铺后两者的"暴露形态"不同 ——
 *   - action 在 store 上仍然是**函数**,调用点形如 store.setFilter('unread')。
 *     state 由 defineStore 在运行时自动注入;类型上不砍掉首参的话,
 *     调用方就得自己传 state —— 既泄漏实现,还可能传错对象;
 *   - getter 在 store 上暴露的是**计算结果**(number / 数组……),
 *     `(state) => R` 这个函数本体从不对外暴露,参数在"取值"这一步
 *     就被消费掉了,自然没有参数需要砍。
 * 一句话:action 的 state 是"运行时注入",getter 的 state 是"求值时消费"。
 *
 * 实现为什么用 `(state: never, ...args: infer Rest)` 一次 infer?
 * 参数逆变方向上 never 是万金油(never 可赋给任何类型),
 * 所以任何"首参存在"的函数都能匹配上,Rest 恰好是砍掉首参后的剩余参数,
 * infer R 顺手拿到返回值 —— 不用再组合 Parameters + DropFirst + ReturnType。
 *
 * @example
 *   BoundActions<{ setFilter: (s: ConvState, f: 'all' | 'unread') => void }>
 *   // => { setFilter: (f: 'all' | 'unread') => void }
 */
export type BoundActions<A> = {
  [K in keyof A]: A[K] extends (state: never, ...args: infer Rest) => infer R
    ? (...args: Rest) => R
    : never
}

// =============================================================
// Part 3 — 🔴 快照 + 订阅器 + 总装
// =============================================================

/**
 * DeepReadonly —— Day 23 复刻:对象 + 数组递归 readonly。
 * 用于 $snapshot 的返回类型:类型层挡住修改,运行时再配 Object.freeze 双保险。
 *
 * 本实现显式处理数组；保留同态 readonly 映射也可以得到只读数组／元组。
 * 不能把“对元素递归但外层数组仍可变”与“同态 readonly 映射”混为一谈。
 * (已知边界:函数类型也会命中对象分支,本场景 state 里没有函数,不处理。)
 *
 * @example
 *   DeepReadonly<{ items: Conversation[] }>['items']
 *   // => readonly Conversation[](元素属性也全 readonly)
 */
export type DeepReadonly<T> = T extends readonly (infer E)[]
  ? readonly DeepReadonly<E>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

/**
 * ActionEvents —— 按 action 名生成订阅器 map:
 * 键 = `on${Capitalize<action名>}`,值 = (回调) => 取消订阅函数。
 * 回调的参数 = action 砍掉首参后的参数。
 *
 * 三个知识点:
 * 1. `as 键重映射` 改的是**键**不是值(写在 in ... as 后面);
 * 2. `K & string` 把 keyof A 里可能混进的 symbol / number 键排除,
 *    否则 Capitalize 无法作用于非字符串键,编译报错;
 * 3. 回调参数复用 BoundActions 同款的 `(state: never, ...infer Rest)` 手术。
 *
 * @example
 *   ActionEvents<{ markAllRead: (s: ConvState) => void }>
 *   // => { onMarkAllRead: (cb: () => void) => () => void }
 */
export type ActionEvents<A> = {
  [K in keyof A as `on${Capitalize<K & string>}`]: A[K] extends (
    state: never,
    ...args: infer Rest
  ) => unknown
    ? (cb: (...args: Rest) => void) => () => void
    : never
}

/**
 * StoreDefinition —— StoreInstance 的入参约束(内部类型,不导出):
 * D 必须长成 defineStore 的 def 的样子,否则 D['state'] 这类索引访问
 * 在泛型未实例化时无从谈起。
 */
interface StoreDefinition {
  state: unknown
  getters: Record<string, (...args: never[]) => unknown>
  actions: Record<string, (...args: never[]) => unknown>
}

/**
 * StoreInstance —— definition 对象类型 D 组装成最终 store 类型:
 * state 平铺 & getters 平铺(解包)& actions 平铺(砍首参)
 * & { $id, $state, $snapshot, $subscribe }。
 *
 * 为什么用交叉(&)而不是一个大对象类型?
 * 三块成员来自三套独立的映射工具,交叉是"类型层面的拼接"——
 * 运行时它们本来就摊平在同一个对象上,类型层用 & 表达"同一对象的
 * 多个切面",这和真 Pinia 的 Store 类型组装思路一致。
 *
 * @example
 *   const store = defineStore({ id: 'x', state: () => ({ n: 1 }), getters: { double: (s) => s.n * 2 }, actions: { inc: (s) => { s.n++ } } })
 *   store.double  // 类型 number
 *   store.inc     // 类型 () => void
 */
export type StoreInstance<D extends StoreDefinition> =
  UnwrapState<D['state']> &
    UnwrapGetters<D['getters']> &
    BoundActions<D['actions']> & {
      $id: string
      $state: UnwrapState<D['state']>
      $snapshot: () => DeepReadonly<UnwrapState<D['state']>>
      $subscribe: ActionEvents<D['actions']>
    }

/** 首字母大写(运行时版 Capitalize) */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * 深冻结 —— 递归 Object.freeze,配合 structuredClone 的深拷贝
 * 做 $snapshot 的"双保险":类型层 DeepReadonly 挡编译期,
 * 运行时 freeze 挡手滑(比如把快照传给不受控的第三方代码)。
 *
 * @example
 *   deepFreeze({ a: { b: 1 } }).a.b = 2 // 运行时静默失败(严格模式下报错)
 */
function deepFreeze(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Array.isArray 对 unknown 收窄出的是 any[];
    // 显式向上转型到 readonly unknown[],让回调参数拿到 unknown 而非隐式 any
    const items: readonly unknown[] = value
    for (const item of items) deepFreeze(item)
    return Object.freeze(value)
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) deepFreeze(item)
    return Object.freeze(value)
  }
  return value
}

/**
 * defineStore —— 迷你 Pinia:运行时实现。
 *
 * 设计要点:
 *   - state 保持"纯数据对象":actions 全部就地改它,getter 每次读它;
 *   - store 是另起的门面(facade):平铺 state 的引用 +
 *     getter 访问器属性(defineProperty,每次访问重算)+
 *     包装后的 actions(自动注入 state,执行后触发订阅器)+ 四个 $ 方法;
 *   - $snapshot 只 clone 纯 state —— structuredClone 遇到函数会直接抛
 *     DataCloneError,所以绝不能把挂满方法的 store 整个塞进去。
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
  A extends Record<string, (state: S, ...args: never[]) => unknown>,
>(
  def: {
    id: string
    state: S | (() => S)
    getters: G
    actions: A
  },
): StoreInstance<{ state: S | (() => S); getters: G; actions: A }> {
  // ---- 1. state 解包:工厂就调用,对象原样用 ----
  // typeof 窄化把 S | (() => S) 分成两支:函数支调用得 S,对象支本来就是 S。
  // 再做一次深拷贝:工厂返回值可能只做了浅拷贝([...seed] 就是这样),
  // 内层对象仍与外部共享引用 —— 不隔离的话,一个实例的 action 会
  // 顺手污染另一个实例(乃至模块级种子数据)。这正是 README Part 1
  // "工厂避免多实例共享同一对象引用"的运行时兜底。
  const state: S = structuredClone(
    typeof def.state === 'function' ? def.state() : def.state,
  )

  // ---- 2. 订阅器注册表:action 名 → 回调集合 ----
  const listeners = new Map<string, Set<(...args: never[]) => void>>()

  // ---- 3. $subscribe:按 action 名生成 onXxx ----
  const subscribe: Record<string, (cb: (...args: never[]) => void) => () => void> = {}
  for (const key of Object.keys(def.actions)) {
    const set = new Set<(...args: never[]) => void>()
    listeners.set(key, set)
    subscribe[`on${capitalize(key)}`] = (cb) => {
      set.add(cb)
      // 返回取消订阅函数:从集合里删掉自己
      return () => {
        set.delete(cb)
      }
    }
  }

  // ---- 4. store 门面:平铺 state(浅拷贝,内部引用共享)+ 四个 $ 方法 ----
  // 注意:平铺的是"当前 state 的键";数组/对象成员与 state 共享引用,
  // 所以 action 里的 push / 就地修改在 store 顶层立即可见。
  const store = {
    ...state,
    $id: def.id,
    $state: state,
    $snapshot: () => deepFreeze(structuredClone(state)),
    $subscribe: subscribe,
  }

  // ---- 5. getters → 访问器属性:每次访问用"当时的 state"重新求值 ----
  for (const [key, getter] of Object.entries(def.getters)) {
    Object.defineProperty(store, key, {
      get: () => getter(state),
      enumerable: true,
      configurable: true,
    })
  }

  // ---- 6. actions → 自动注入 state + 触发订阅器 ----
  for (const [key, action] of Object.entries(def.actions)) {
    Object.defineProperty(store, key, {
      value: (...args: never[]) => {
        const result: unknown = action(state, ...args)
        const set = listeners.get(key)
        if (set) {
          for (const cb of set) cb(...args)
        }
        return result
      },
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }

  // ⚠️ 全文件唯一一次 as,原因(本文件开头有完整推导):
  // 上面 5/6 两步的键是运行时动态的,TS 无法从 Object.entries 的循环里
  // 还原出 UnwrapGetters<G> / BoundActions<A> 这两个泛型映射类型 ——
  // "给泛型映射类型构造值"在 TS 里除 as 外无解(已用探针逐一排除)。
  // 真 Pinia 的 defineStore 内部同样大量使用 as 收口。
  return store as StoreInstance<{ state: S | (() => S); getters: G; actions: A }>
}
```

## 二、常见错误写法(点评人视角)

### 1. UnwrapGetters 直接用 `ReturnType<G[K]>`

```ts
// ❌
export type UnwrapGetters<G> = { [K in keyof G]: ReturnType<G[K]> }
```

现象:`error TS2344: Type 'G[K]' does not satisfy the constraint '(...args: any) => any'`。
为什么错:`G[K]` 是未实例化的泛型索引,TS 对它的全部所知只是"某个未知类型",不满足 `ReturnType` 的函数约束。**泛型索引必须先用条件类型"接住"再 infer** —— 条件类型的 extends 检查本身就是守卫:

```ts
// ✅
export type UnwrapGetters<G> = {
  [K in keyof G]: G[K] extends (...args: never[]) => infer R ? R : never
}
```

### 2. DropFirst 的约束漏了 readonly,或空元组不兜底

```ts
// ❌ 约束是可变元组
export type DropFirst<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : []
// 传 readonly [1, 2] 时:TS2344 —— readonly 元组不满足 unknown[] 约束
```

```ts
// ❌ 没有兜底分支
export type DropFirst<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never
// DropFirst<[]> = never:never 是"底层类型",会顺着 BoundActions 污染整条调用链
```

测试里 `DropFirst<[]>` 明确要求 `[]`,这就是兜底分支存在的意义。

```ts
// ✅
export type DropFirst<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : []
```

### 3. DeepReadonly 的同态映射替代写法

```ts
// ✅ 本题 state 不含函数；同态映射可以处理数组和元组
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T
```

此写法会将数组变成只读数组，并保留元组结构，符合本题纯数据 state 的要求。
参考实现的显式数组分支也是合法选择。若要保留函数调用签名，应先单独识别函数；
这是函数处理的边界，不是数组映射失效。

### 4. ActionEvents 忘了 `K & string`,或忘了是"重映射键"不是"改名值"

```ts
// ❌ 直接 Capitalize<K>
export type ActionEvents<A> = {
  [K in keyof A as `on${Capitalize<K>}`]: ...
}
// error TS2344: Type 'K' does not satisfy the constraint 'string'
```

为什么错:`keyof A` 的类型是 `string | number | symbol`,`Capitalize` 只作用于 string。`K & string` 把联合与 string 求交,把 number/symbol 键过滤掉。

另一个高频混淆:把 `as` 子句当成了"给值改名"。它重映射的是**键** —— `[K in keyof A as 新键表达式]`,值部分照常写。

```ts
// ✅
export type ActionEvents<A> = {
  [K in keyof A as `on${Capitalize<K & string>}`]: A[K] extends (state: never, ...args: infer Rest) => unknown
    ? (cb: (...args: Rest) => void) => () => void
    : never
}
```

### 5. BoundActions 组合 `Parameters` 时不在条件分支里用

```ts
// ❌ Parameters<A[K]> 裸用
export type BoundActions<A> = {
  [K in keyof A]: (...args: DropFirst<Parameters<A[K]>>) => ReturnType<A[K]>
}
// error TS2344: Type 'A[K]' does not satisfy the constraint '(...args: any) => any'
```

和第 1 条同根:泛型索引不满足内置工具的函数约束。两种 ✅ 姿势:要么整套包进条件类型(README 提示的组合路线),要么用 `(state: never, ...args: infer Rest) => infer R` 一次 infer 完成(参考实现选的,少一层嵌套)。

### 6. defineStore 函数体里调用 action 编译不过(actions 约束中需要保留 state)

```ts
// ❌ 若退回旧骨架的 A extends Record<string, (...args: never[]) => unknown> 约束:
for (const [, action] of Object.entries(def.actions)) {
  action(state)   // error TS2345: Argument of type 'S' is not assignable to parameter of type 'never'
}
```

为什么错:`(...args: never[]) => unknown` 这个约束模式是为"匹配任意函数"设计的(never 在参数逆变方向上通吃),但它同时把"首参是 state"的信息抹掉了,**函数体内根本没法合法调用**。修法与修订后骨架一致:约束改成 `(state: S, ...args: never[]) => unknown`。

### 7. 想零 as 构造 store,在 `{}` 上碰壁

```ts
// ❌
const store: UnwrapGetters<G> = {}
// error TS2322: Type '{}' is not assignable to type 'UnwrapGetters<G>'
```

当前通过动态循环逐项构造的写法，编译器不能自动证明最终对象满足泛型映射返回类型。
本题允许在最终返回处集中使用一次断言，并说明构造过程如何保证返回契约。
这不等于证明“所有实现都不可能零断言”；改变接口或构造方式可能改变证明条件。

### 8. 运行时不深拷贝 state,跨实例污染(参考实现亲踩)

```ts
// ❌
const state: S = typeof def.state === 'function' ? def.state() : def.state
```

现象:测试"action 修改 state 后 getter 跟进"红 —— `unreadCount` 期望 2 实际 1。
为什么:测试工厂里 `items: [...seed]` 是**浅拷贝**,内层会话对象与模块级 `seed` 共享引用。第一个测试 `markAllRead()` 把 seed 里的对象改了,后面的测试拿到的是"已被污染的初始状态"。深拷贝(`structuredClone`)兜住"多实例不共享引用"的协议 —— README Part 1 那句"工厂避免多实例共享同一对象引用"的完整含义,工厂只保证外壳是新的,**内层引用要实现层自己隔离**。

### 9. $snapshot 直接 structuredClone(store)

```ts
// ❌
$snapshot: () => deepFreeze(structuredClone(store))
```

现象:运行时直接抛 `DataCloneError`。
为什么:`structuredClone` 不能克隆函数,而 store 上挂满了 getters/actions/$ 方法。**快照的对象只能是纯数据的 state** —— 这也是为什么参考实现让 state 全程保持"纯数据对象"、把方法都挂在门面 store 上:职责分离不只是美观,是 clone 得动的前提。

### 10. getters 平铺成"一次性求值"的普通属性

```ts
// ❌
for (const [key, getter] of Object.entries(def.getters)) {
  store[key] = getter(state)   // 求值一次,之后 state 变了它不跟着变
}
```

现象:`store.markAllRead()` 之后 `store.unreadCount` 还是 1,测试红。
为什么:README 协议说"每次访问重新计算" —— 必须**访问器属性**(`Object.defineProperty` + `get`)或 Proxy。Pinia 真身用 reactive Proxy,这里 defineProperty 是零依赖的最小实现。

## 三、思考题参考答案

**Q:BoundActions 为什么要砍首参 state,而 getters 不用?**(README 要求写进 JSDoc)

- action 平铺后**仍是函数**,`store.setFilter('unread')` 的调用点没有 state 可传 —— state 是 defineStore 在运行时注入的实现细节。类型上不砍,调用方就被迫传一个 state 进来:既泄漏实现,又留下"传别的 store 的 state"这个漏洞。
- getter 平铺后暴露的是**计算结果**(number / 数组),`(state) => R` 这个函数本体从不对外暴露。它的 state 参数在"求值"那一步就被消费掉了,不存在"调用方要不要传"的问题。
- 一句话:action 的 state 是运行时注入,getter 的 state 是求值时消费 —— 前者要"藏",后者已经"花掉了"。

**Q:为什么不直接 `ReturnType<G[K]>`?**(README 提示区)

见常见错误第 1 条:`ReturnType` 的约束是 `(...args: any) => any`,泛型索引 `G[K]` 不满足,TS2344。泛型世界里的"先检查后取值"必须由条件类型自己承担,`extends (...args: never[]) => infer R` 把守卫和推导合二为一。顺带:`never[]` 在参数位置是"万能匹配模式"(逆变方向上 never 通吃),这也是骨架约束、BoundActions、ActionEvents 反复出现它的原因。

**Q(隐含):StoreInstance 为什么用交叉类型而不是一个大映射?**

三块成员(state 平铺 / getters 解包 / actions 砍参)来自三套独立的映射工具,交叉类型表达"同一个对象的多个切面",每块都能单独复用、单独测试。合成一个大映射类型能把三个工具糅在一起,但每加一个 $ 方法都要动"总装车间" —— 交叉的模块化程度更高,这也是 Pinia 真源码的类型组装方式。

## 四、验收自查清单

- [ ] `pnpm check:day 26` 通过（类型检查 + 运行时测试）
- [ ] 六个类型工具(UnwrapState / UnwrapGetters / DropFirst / BoundActions / DeepReadonly / ActionEvents)全部实现,零 `any`
- [ ] `defineStore` 运行时的 `as` 是否压缩到最后一处 return,且注释说明了为什么
- [ ] store 顶层:`store.items` / `store.unreadCount` / `store.markAllRead()` 类型与运行时全部正确
- [ ] `store.unreadCount` 在 action 之后会"跟着变"(访问器属性,不是一次性求值)
- [ ] `store.$subscribe.onMarkAllRead` 订阅触发一次、off 后不再触发
- [ ] `$snapshot` 深拷贝:改 store 不影响已取出的快照(且 clone 的是纯 state,不是挂满方法的 store)
- [ ] state 工厂结果做了深拷贝隔离,多实例/多测试互不污染
- [ ] 所有 export 有 JSDoc + `@example`;JSDoc 里回答了"BoundActions 为什么要砍首参,而 getters 不用?"
- [ ] 对照本文第二节,数一数:10 条常见错误,你写的时候踩过/躲过几条?
