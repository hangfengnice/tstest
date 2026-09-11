# Day 14 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

> ⚠️ 关于 as 数量的说明:验收清单写"除事件存储擦除点外零 as"。实测 emitter 的擦除点
> (on 内一次)之外,**inject 内部从 unknown 恢复 T 也必须一次 as** —— 类型不携带运行时信息,
> 异构容器(一个 Map 装所有类型的值)取出时无从验证,这是数学边界不是写法问题。
> README 思考题自己也点了:"Vue 源码里 inject 的实现内部有两处 as。为什么全世界最讲类型安全的
> 框架也逃不掉?" —— 本实现共两处 as(emitter 存储一次、inject 取值一次),各带 TODO 注释。

## 一、参考实现

> 已通过本 day 全部验收测试(vitest 20/20,`pnpm typecheck` 本 day 零错)。
> 零 `any`;`as` 两次(emitter 存储擦除点、inject 取值擦除点),各带 TODO 注释。

```ts
/**
 * Day 14 — provide/inject 类型安全 + emits 事件映射(纯 TS 模拟)
 *
 * 两条主线:
 *   1. InjectionKey 模式:key(接口标注)携带值的类型
 *   2. 事件映射:事件名 → 参数元组,emit/on 全量类型检查
 */

// =============================================================
// Part 0 — InjectionKey 模式(骨架已给出,读懂即用)
// =============================================================

/**
 * 注入 key —— Vue 3 源码同款模式:接口继承 `Symbol`,泛型 T 只存在于类型层。
 * 这样 `InjectionKey<ThemeContext>` 就是一个"携带"了值类型的 key:
 * provide/inject 的泛型推断全靠它的**类型标注**完成。
 *
 * 和 Vue 原版的唯一差别:Vue 原版是 `interface InjectionKey<T> extends Symbol {}`
 * (T 不出现在任何成员里),但本仓库开了 noUnusedLocals,未使用的类型参数会报 TS6133,
 * 所以加了一个**幽灵可选属性**让 T 被"读到" —— 它运行时永远是 undefined,
 * 类型层行为与 Vue 原版完全一致(还顺带让不同 T 的 key 结构上也互不相容,见思考题 1)。
 *
 * @example
 *   const THEME_KEY: InjectionKey<ThemeContext> = Symbol('theme')
 *   // THEME_KEY 的类型标注里"藏着" ThemeContext,inject 时能推出来
 */
export interface InjectionKey<T> extends Symbol {
  /** 幽灵属性:只在类型层存在,标记 T 用,运行时永远不要赋值 */
  readonly __injectionType?: T
}

// =============================================================
// Part 1 — 基础:业务类型 + key 的声明
// =============================================================

/**
 * 主题模式 —— 三值字面量联合。
 * 用字面量联合而不是 string:主题只有这三种,写错('drak')要在编译期报错。
 *
 * @example
 *   const m: ThemeMode = 'dark'
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * 主题上下文 —— provide/inject 传递的"全局依赖"之一。
 *
 * @example
 *   const t: ThemeContext = { mode: 'dark', density: 'comfortable' }
 */
export type ThemeContext = {
  mode: ThemeMode
  density: 'comfortable' | 'compact'
}

/**
 * 当前用户 —— roles 用 ReadonlyArray:权限表不该被运行时篡改,
 * readonly 在类型层就把 push/splice 这些方法摘掉了。
 *
 * @example
 *   const u: CurrentUser = { id: 1, name: '吴杭峰', roles: ['admin'] }
 */
export type CurrentUser = {
  id: number
  name: string
  roles: ReadonlyArray<'admin' | 'editor' | 'viewer'>
}

/**
 * 通知设置 —— 通知中心的配置项。
 *
 * @example
 *   const s: NotificationSettings = { pageSize: 20, sound: true }
 */
export type NotificationSettings = {
  pageSize: number
  sound: boolean
}

/**
 * 主题服务的注入 key(写法照 Vue 官方,类型标注是关键)
 *
 * @example
 *   provide(THEME_KEY, { mode: 'dark', density: 'comfortable' })
 *   const theme = inject(THEME_KEY)  // => ThemeContext | undefined
 */
export const THEME_KEY: InjectionKey<ThemeContext> = Symbol('theme')

/**
 * 当前用户的注入 key
 *
 * @example
 *   provide(USER_KEY, { id: 1, name: '吴杭峰', roles: ['admin'] })
 *   inject(USER_KEY, guestUser)  // => CurrentUser(带默认值,无 undefined)
 */
export const USER_KEY: InjectionKey<CurrentUser> = Symbol('user')

/**
 * 通知设置的注入 key。
 *
 * 为什么 key 用 symbol 而不是 string:
 * string 是全局池子 —— 两个 npm 包都用 'theme' 当 key,后注册的会**静默覆盖**
 * 先注册的(或读到彼此的值),没有任何报错;跨包协作时这就是定时炸弹。
 * `Symbol('settings')` 每次调用都产生**全局唯一**的值,两个包各自 Symbol('theme')
 * 得到的是两个不同的 key,天然命名空间隔离,物理上不可能撞车。
 * 附带好处:symbol 键不会被 Object.keys / JSON.stringify / for...in 枚举,
 * 注入的值不会意外泄漏到序列化和遍历里。
 *
 * @example
 *   provide(SETTINGS_KEY, { pageSize: 20, sound: true })
 *   inject(SETTINGS_KEY)  // => NotificationSettings | undefined
 */
export const SETTINGS_KEY: InjectionKey<NotificationSettings> = Symbol('settings')

// =============================================================
// Part 2 — 进阶:provide / inject 运行时
// =============================================================

/** 模拟组件树的上下文栈(已实现,测试脚手架,不是练习重点) */
const contextStack: Map<InjectionKey<unknown>, unknown>[] = []

/**
 * 在新的"组件上下文"里执行 fn —— 模拟子组件的 setup 嵌套(已实现,脚手架)
 *
 * @example
 *   runWithContext(() => {
 *     provide(THEME_KEY, darkTheme)   // 写进当前上下文
 *     return inject(THEME_KEY)        // 从当前/祖先上下文读
 *   })
 */
export function runWithContext<T>(fn: () => T): T {
  contextStack.push(new Map())
  try {
    return fn()
  } finally {
    contextStack.pop()
  }
}

/**
 * 从栈顶往下找 key(已实现,脚手架)。返回可辨识联合,免去调用方的 as。
 *
 * 注意:参数类型是 `InjectionKey<unknown>` 而不是 `symbol` ——
 * 接口(InjectionKey<T>)不是 symbol 原始类型(结构化类型系统里接口是对象形状,
 * symbol 是原始类型,二者没有赋值关系),直接写 symbol 参数,
 * 你的 provide 里 `current.set(key, value)` 会因 key 对不上 Map 的键类型而编译不过。
 *
 * @example
 *   const r = lookupKey(THEME_KEY)
 *   if (r.found) console.log(r.value) // unknown,还需收窄
 */
export function lookupKey(
  key: InjectionKey<unknown>,
): { found: true; value: unknown } | { found: false; value: undefined } {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    const layer = contextStack[i]
    if (layer !== undefined && layer.has(key)) {
      return { found: true, value: layer.get(key) }
    }
  }
  return { found: false, value: undefined }
}

/**
 * 向当前组件上下文登记一个值。
 *
 * 泛型 T 完全由 key 的类型标注携带(InjectionKey<ThemeContext> → T = ThemeContext),
 * value 参数与 T 对齐 —— key 和 value 类型不匹配立刻编译报错,这就是
 * InjectionKey 模式的全部:类型信息挂在 key 上,随 key 走。
 *
 * 栈为空(在 runWithContext 之外调用)时抛错 —— 对应"组件外 provide"的误用。
 *
 * @example
 *   runWithContext(() => {
 *     provide(THEME_KEY, { mode: 'dark', density: 'comfortable' })
 *   })
 */
export function provide<T>(key: InjectionKey<T>, value: T): void {
  const current = contextStack[contextStack.length - 1]
  if (current === undefined) {
    throw new Error('provide() 只能在 runWithContext() 之内调用(等价于"组件外 provide")')
  }
  current.set(key, value)
}

/**
 * 从当前/祖先上下文读值。**两个重载,两种返回语义**:
 *
 *   inject(key)                 => T | undefined(可能没有祖先提供过)
 *   inject(key, defaultValue)   => T(保证有值 —— undefined 被 default 顶掉了)
 *
 * 为什么不能合成单签名 `inject<T>(key, defaultValue?: T): T | undefined`:
 * 可选参数无法表达"传了 default 之后就不再有 undefined" ——
 * "参数有没有传"是**调用形态**信息,只有重载能按形态分流;
 * 合并写法会让每个带 default 的调用都背上 `| undefined`,
 * 调用方被迫写非空断言,安全负担转嫁给了使用者。
 *
 * @example
 *   const theme = inject(THEME_KEY)                // ThemeContext | undefined
 *   const theme2 = inject(THEME_KEY, lightTheme)   // ThemeContext(无 undefined)
 */
export function inject<T>(key: InjectionKey<T>): T | undefined
export function inject<T>(key: InjectionKey<T>, defaultValue: T): T
export function inject<T>(
  key: InjectionKey<T>,
  defaultValue?: T,
): T | undefined {
  const result = lookupKey(key)
  if (result.found) {
    // TODO(reason): 类型擦除点(与 Vue 源码 inject 内部的两处 as 同处境)——
    // 上下文栈是异构容器(一个 Map 要装所有类型的值),值类型只能声明为 unknown;
    // "这个 key 对应这个 T"的对应关系只存在于 InjectionKey 的类型标注里,
    // 运行时无从验证。类型系统无法从 unknown 恢复 T(这不是能力不足,
    // 是"类型不携带运行时信息"的数学边界),只能断言。
    // 安全性由 provide<T>/inject<T> 的对称签名保证:存和取用的是同一个
    // key 标注,类型链条没有断点。
    return result.value as T
  }
  return defaultValue
}

// =============================================================
// Part 2b — 进阶:emits 事件映射
// =============================================================

/**
 * 事件处理器 —— 参数展开自元组 Args。
 * 和 Day 11 的 (payload: E[K]) => void 对比:元组能表达**多参数**,
 * 单参数版本只能表达"恰好一个参数"。
 *
 * @example
 *   const h: EventHandler<[number, string]> = (id, name) => console.log(id, name)
 */
export type EventHandler<Args extends unknown[]> = (...args: Args) => void

/**
 * 通知中心的事件映射 —— 事件名 → **参数元组**:
 *   'theme:change' => [mode: ThemeMode]                 (单参)
 *   'user:rename'  => [userId: number, newName: string] (双参)
 *   'panel:close'  => []                                (零参,空元组)
 *
 * 元组带标签(mode/userId/newName)不只是注释 —— 悬停提示和补全参数名会显示它们。
 *
 * @example
 *   const args: NotificationEvents['user:rename'] = [7, '新名字']
 */
export type NotificationEvents = {
  'theme:change': [mode: ThemeMode]
  'user:rename': [userId: number, newName: string]
  'panel:close': []
}

/**
 * 类型安全的 emitter —— on / emit 都是泛型方法,签名与事件映射 E 联动。
 *
 * 约束 `{ [K in keyof E]: unknown[] }` 的含义:E 的每个成员都得是元组
 * (同构映射逐字段施加约束)—— 保证 emit 的 rest 展开和
 * handler 的参数列表都能直接用 E[K]。
 *
 * emit 的签名比 Day 11 简单:值本来就是元组,直接 `...args: E[K]` 展开,
 * 不再需要条件元组(那是"单参数 payload + 无参数事件"的编码问题;
 * 元组天然表达 0~n 个参数)。
 *
 * @example
 *   const emitter = createEmitter<NotificationEvents>()
 *   const off = emitter.on('user:rename', (id, name) => console.log(id, name))
 *   emitter.emit('user:rename', 7, '新名字')
 *   off() // 取消订阅
 */
export interface Emitter<E extends { [K in keyof E]: unknown[] }> {
  /** 订阅;返回取消订阅函数(比 off 方法更轻的退订形态) */
  on<K extends keyof E>(event: K, handler: EventHandler<E[K]>): () => void
  /** 发布;参数逐个由 E[K] 元组检查 */
  emit<K extends keyof E>(event: K, ...args: E[K]): void
}

/**
 * 创建一个事件发射器。
 *
 * 内部存储是异构的(每个事件的参数元组都不同),和 Day 11 的死结同源,
 * 但擦除点的位置相反(见 StoredHandler 注释)。
 *
 * @example
 *   const emitter = createEmitter<NotificationEvents>()
 *   const off = emitter.on('user:rename', (id, name) => console.log(id, name))
 *   emitter.emit('user:rename', 7, '新名字')
 *   off() // 取消订阅
 */
export function createEmitter<E extends { [K in keyof E]: unknown[] }>(): Emitter<E> {
  /**
   * 存储公共类型:unknown[] 参数版。
   * 与 Day 11 的 (payload: never) => void 对比(有趣的不对称):
   * 单值 never 可以直接赋给任何类型,所以 Day 11 "存"零 cast、"取"才 cast;
   * rest 元组版 TS 检查更保守(never[] 享受不到 never 的直通车),
   * 存和取两个方向都过不了 —— 于是反过来:存入时一次 as 擦成 unknown[],
   * 取出调用时 E[K] → unknown[] 协变放行,零 cast。
   */
  type StoredHandler = (...args: unknown[]) => void
  const handlers = new Map<keyof E, Set<StoredHandler>>()

  return {
    on(event, handler) {
      let set = handlers.get(event)
      if (set === undefined) {
        set = new Set<StoredHandler>()
        handlers.set(event, set)
      }
      // TODO(reason): 异构存储的类型擦除点(emitter 侧唯一一次 as)——
      // 每个事件的参数元组各不相同,一个 Set 只能有一个元素类型;
      // (...args: E[K]) => void 存进 (...args: unknown[]) => void 的槽位,
      // 逆变方向(unknown[] → E[K])无法通过,只能断言。
      // 调用侧 h(...args) 依然类型安全(E[K] → unknown[] 协变),零 cast。
      const stored = handler as StoredHandler
      set.add(stored)
      // 闭包捕获 set 与 stored,退订复用同一个擦除引用,零额外断言
      return () => set.delete(stored)
    },

    emit(event, ...args) {
      const set = handlers.get(event)
      if (set === undefined) return
      // 零 cast:h 收 unknown[],args 是 E[K](元组),spread 逐元素赋给 unknown 恒成立
      set.forEach((h) => h(...args))
    },
  }
}
```

## 二、常见错误写法(点评人视角)

### 1. inject 用单签名(可选默认值),不写重载(测试 134-140 行的靶子)

```ts
// ❌ 错误写法
export function inject<T>(key: InjectionKey<T>, defaultValue?: T): T | undefined {
  ...
}
const t = inject(THEME_KEY, lightTheme)
// t 的类型:ThemeContext | undefined(实测 Equals 检验为 false 对 ThemeContext)
```

现象:传了默认值的调用也背上 `| undefined` —— 每个"保证有值"的使用点都要再收窄一次(`t!.mode` / `if (!t) throw`),**默认值白给了**。类型层等于告诉调用方"这可能是 undefined",与运行时事实(一定有值)矛盾。

```ts
// ✅ 正确姿势:两个重载按"有没有传第二个参数"分流
export function inject<T>(key: InjectionKey<T>): T | undefined
export function inject<T>(key: InjectionKey<T>, defaultValue: T): T
```

为什么只有重载能表达:"参数传没传"是**调用形态**,不是类型 —— 可选参数类型 `defaultValue?: T` 在签名上只是"T 或缺席",拿不到"缺席与否"来决定返回类型。重载是 TS 里唯一按形态分派的机制。这也回答了"为什么 Vue 的 inject 有四个重载"(含 defaultValue 工厂函数形态)。

### 2. inject 重载的实现签名写到最前 / 漏实现签名

```ts
// ❌ 错误写法:只写两个重载没有实现签名
export function inject<T>(key: InjectionKey<T>): T | undefined
export function inject<T>(key: InjectionKey<T>, defaultValue: T): T
// error TS2390: Function implementation is missing or not immediately following the declaration(实测缺失时报这个)
```

```ts
// ✅ 正确姿势:重载声明(对外可见的两种形态)+ 实现签名(宽而松,对外不可见)
export function inject<T>(key: InjectionKey<T>): T | undefined
export function inject<T>(key: InjectionKey<T>, defaultValue: T): T
export function inject<T>(key: InjectionKey<T>, defaultValue?: T): T | undefined {
  // 实现签名必须同时兼容两个重载:参数取宽(defaultValue?: T),返回取宽(T | undefined)
  ...
}
```

实现签名是"内部视角",调用方永远只能看到前两个重载 —— 这就是重载的分工:声明管对外契约,实现管运行时真相。

### 3. SETTINGS_KEY 忘写类型标注(静默退化,比报错更险)

```ts
// ❌ 错误写法(骨架的原始形态)
export const SETTINGS_KEY = Symbol('settings')  // 类型:symbol
```

现象(实测):**不报错**。`inject(SETTINGS_KEY)` 的 T 推导失败,静默掉到 **unknown** —— `inject(SETTINGS_KEY)` 返回 `unknown | undefined`,类型安全整个消失,而且没有任何提示。测试的 `expectTypeOf(SETTINGS_KEY).toEqualTypeOf<InjectionKey<NotificationSettings>>()` 抓得住。

```ts
// ✅ 正确姿势:标注是 InjectionKey 模式的灵魂 —— 类型信息就住在标注里
export const SETTINGS_KEY: InjectionKey<NotificationSettings> = Symbol('settings')
```

教训:这个模式的类型安全 100% 依赖"每个 key 认真写标注"。漏写不炸、只是失效 —— 最危险的失败模式。

### 4. emitter 照抄 Day 11 的 never 参数位存储(rest 版翻车)

```ts
// ❌ 错误写法:Day 11 的成功经验直接搬过来
type StoredHandler = (...args: never[]) => void
set.add(handler)
// error TS2718(实测): Type 'never[]' is not assignable to type 'E[K]'.
//   'never[]' is assignable to the constraint of type 'E[K]',
//   but 'E[K]' could be instantiated with a different subtype of constraint 'unknown[]'.
```

为什么 Day 11 行、这里不行:单值 `never` 在 TS 里有"可赋给一切类型"的直通车,所以 `(payload: E[K]) => void` 存进 `(payload: never) => void` 逆变检查直接放行;但 `never[]` 是**数组类型**,不是 never 本身 —— rest 参数比较走元组规则,对 `never[] → E[K]`(泛型索引)保守拒绝。反过来在调用点把 handler as 回 `(...args: E[K]) => void` 也过不了(两个方向的 overlap 都不成立,TS2349/TS2352)。

```ts
// ✅ 正确姿势:擦除点换边 —— 存入时 as 成 unknown[] 参数版,调用时零 cast
type StoredHandler = (...args: unknown[]) => void
const stored = handler as StoredHandler   // 唯一一次 as(E[K] → unknown[] 方向成立)
set.add(stored)
// emit 里:
set.forEach((h) => h(...args))  // args: E[K] → unknown[] 协变放行,零 cast
```

对比记忆:**Day 11 单参:never 收、cast 取;Day 14 元组:cast 存、unknown 调**。两个方向都算"擦除点",选能让调用侧自然 spread 的那个 —— 调用侧的类型最贴近使用真相。

### 5. 事件映射的值写成参数列表/联合,而不是元组

```ts
// ❌ 错误写法一:值写成参数类型(丢失"两个参数"的形状)
type NotificationEvents = {
  'user:rename': (userId: number, newName: string) => void
}
// emit(event, ...args: E[K]) 处 E[K] 是函数类型,rest 展开直接报错

// ❌ 错误写法二:联合(丢失参数个数与对应关系)
'user:rename': number | string
// emit('user:rename', 7, 'x') 和 emit('user:rename', 'x', 7) 都"合法",顺序检查消失
```

```ts
// ✅ 正确姿势:值是参数元组,标签写清楚
'user:rename': [userId: number, newName: string]
```

元组是 TS 里唯一同时编码"个数 + 顺序 + 每位类型"的类型;`...args: E[K]` 展开后每一位实参各就各位。Day 11 的单 payload 版其实是元组的退化形式(所以才需要条件元组补"零参"表达)。

### 6. emit/on 不设泛型 K(联动断裂,和 Day 11 坑 10 同构)

```ts
// ❌ 错误写法
emit(event: keyof E, ...args: unknown[]): void
// emitter.emit('theme:change', 123) 不报错 —— unknown[] 什么都收
```

```ts
// ✅ 正确姿势
emit<K extends keyof E>(event: K, ...args: E[K]): void
```

测试里 `emit('theme:change', 123)` / `emit('user:rename', 7)`(缺参)/ `emit('nope', 'x')` 三个 `@ts-expect-error` 全靠 K 钉死事件名后 E[K] 逐位检查。

### 7. provide 栈空时不抛错(静默丢失)

```ts
// ❌ 错误写法
export function provide<T>(key: InjectionKey<T>, value: T): void {
  contextStack[contextStack.length - 1]?.set(key, value)  // 栈空静默跳过
}
```

现象:`expect(() => provide(THEME_KEY, darkTheme)).toThrow()` 失败。组件外 provide 是**程序员错误**(对应 Vue 里在非 setup 上下文调 provide),静默跳过意味着值悄悄丢失、inject 永远 undefined,排查时只看到"注入不生效"却无任何线索。fail fast:配置错误的用法就该炸。

```ts
// ✅ 正确姿势
const current = contextStack[contextStack.length - 1]
if (current === undefined) {
  throw new Error('provide() 只能在 runWithContext() 之内调用(等价于"组件外 provide")')
}
current.set(key, value)
```

顺带:noUncheckedIndexedAccess 下 `contextStack[length - 1]` 的类型自带 `| undefined`,这个检查是被迫写的 —— 严格模式替你把边界条件显式化了。

### 8. on 返回 void 而不是退订函数 / 或者退订函数新建 Set 引用

```ts
// ❌ 错误倾向一:接口就要求返回 () => void,漏写返回
on(event, handler) { set.add(handler) }  // 返回 undefined,接口不匹配

// ❌ 错误倾向二:退订时再查一次 Map 用裸 handler
return () => handlers.get(event)?.delete(handler)
// handler 的类型是 EventHandler<E[K]>,Set<StoredHandler> 的 delete 参数对不上(逆变)
```

```ts
// ✅ 正确姿势:存入时的擦除引用存到闭包里,退订复用同一个引用
const stored = handler as StoredHandler
set.add(stored)
return () => set.delete(stored)
```

一石二鸟:退订零额外断言,还避免了"emit 前退订时 Map 里没有这个 key"的边界(as 出来的 stored 是 add 进去的同一个引用,delete 一定命中)。

## 三、思考题参考答案

**Q1:`InjectionKey<A>` 和 `InjectionKey<B>` 结构上完全相同(T 没出现在属性里),TS 却能在 inject 时区分,靠什么?**

靠的是**推断发生在"读取变量声明类型"这一步,而不是"结构比较"**。`inject(key)` 时,TS 从 key 的声明标注 `InjectionKey<ThemeContext>` 里把泛型实参读出来赋给 T —— 这是正向的信息流动,不是 A、B 两个类型的比较。要害在于:结构化类型系统里,如果接口真是空的,`InjectionKey<A>` 和 `InjectionKey<B>` **确实可以互赋**(漏洞真实存在 —— 把 A 的 key 赋给标注 `InjectionKey<B>` 的变量,TS 不会拦,Vue 原版就有这个理论漏洞)。本仓库的幽灵属性 `__injectionType?: T` 顺带把它堵上了:`{ __injectionType?: A }` 与 `{ __injectionType?: B }` 结构不相容,互赋报错 —— 测试里 `provide<CurrentUser>(THEME_KEY, 42)` 的 `@ts-expect-error` 能命中,靠的正是幽灵属性(空接口版这个调用是过的)。结论:原版区分靠"标注携带的实例化信息",幽灵属性版才有了真正的结构防线。

**Q2:Vue 源码里 inject 的实现内部有两处 as,为什么逃不掉?**

因为**类型不携带运行时信息,而存储必须是异构的**。上下文(provides)是一个要装下所有类型值的容器,它的值类型只能是最宽的 unknown/any;取出时"这个 key 对应这个类型"的对应关系只存在于 key 的**类型标注**里,运行时无从验证 —— unknown → T 没有零 cast 的通路(不是 TS 能力不足,是数学边界:任何程序都无法在运行时验证"这个值是 T"当 T 是任意泛型)。本实现在 `result.value as T` 处遇到的是同一个边界。Vue 选择 as 并保持 provide/inject 签名对称(存取同标注),让类型链条在**API 边界**上没有断点 —— 这是工程上的最优解:把不可验证的部分压缩到一个有注释的点。

**Q3(SETTINGS_KEY 的 JSDoc 必答):为什么 key 用 symbol 不用 string?**

见参考实现的 SETTINGS_KEY JSDoc:string 是全局池子,两个包都用 'theme' 会静默互相覆盖(定时炸弹);Symbol() 每次产生全局唯一值,天然命名空间隔离;symbol 键不被 Object.keys/JSON.stringify/for...in 枚举,注入值不泄漏。跨包共享 key 的正确姿势:共享的是**导出的同一个 symbol 值**(同一个模块),而不是约定字符串。

**Q4(骨架埋的点):lookupKey 的参数为什么是 `InjectionKey<unknown>` 而不是 `symbol`?**

`InjectionKey<T>` 是接口(对象形状),`symbol` 是原始类型 —— 结构化类型系统里原始类型和接口之间没有赋值关系。参数写 `symbol` 的话,`lookupKey(THEME_KEY)`(THEME_KEY 的类型是接口)直接不兼容;而 `InjectionKey<unknown>` 能收下任何 `InjectionKey<T>`(幽灵属性 T → unknown,属性协变放行)。同理 contextStack 的 Map 键类型、provide 里 `current.set(key, value)` 的参数检查,走的都是这条协变链 —— `unknown` 在这里当"任何 InjectionKey 的公共超类型"用。

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错、`pnpm vitest run src/day14` 全过(本 day 20 个用例)
- [ ] 零 `any`;as 仅两处(emitter 存储擦除、inject 取值擦除),各带 `// TODO(reason)`
- [ ] `SETTINGS_KEY` 带类型标注 `InjectionKey<NotificationSettings>`;JSDoc 回答了 symbol vs string
- [ ] inject 是重载签名;传默认值时返回类型**没有** `undefined`
- [ ] `emit('theme:change', 123)` / `emit('user:rename', 7)`(缺参)/ `emit('nope', 'x')` 都编译报错
- [ ] handler 参数类型由事件决定(逆变的 `@ts-expect-error` 反例生效)
- [ ] 事件值是**带标签元组**(含空元组零参事件)
- [ ] provide 在 runWithContext 之外抛错;子上下文覆盖父上下文、离开后恢复
- [ ] on 返回取消订阅函数,退订后不再收到事件
- [ ] 想通:擦除点两侧(cast 存 / cast 取)的选择,以及为什么调用侧零 cast 更好
