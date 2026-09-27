# Day 27 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 27` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试:运行时 22/22,vitest typecheck 模式 22/22,`pnpm typecheck` 中 day27 错误清零。今天全是类型,零实现、零 `any`、零 `as`。

```ts
/**
 * Day 27 — 综合实战(一):Mini Todo 类型层设计(只有类型,零实现)
 */

// =============================================================
// 🟢 基础:待办与过滤器
// =============================================================

/**
 * 待办优先级 —— 三档字面量联合。
 *
 * 为什么不用 enum?
 * 字面量联合是"纯类型",编译后零运行时产物;enum 是"类型 + 值"的
 * 双面体,会生成一份真实对象。更要命的是类型体操消费不了它 ——
 * 模板字面量(`tag:${...}`)、条件类型匹配、映射类型的键重映射,
 * 作用的对象都是**字符串字面量**。契约层越轻,后面的工具越好使。
 *
 * @example
 *   const p: TodoPriority = 'high'
 *   // @ts-expect-error —— 不在三档内
 *   const bad: TodoPriority = 'urgent'
 */
export type TodoPriority = 'low' | 'medium' | 'high'

/**
 * 进行中的待办 —— status 判别符为 'active',绝不能有 completedAt。
 *
 * 为什么两个分支要"字段分开写"而不是一个大类型加可选 completedAt?
 * `completedAt?: string` 写在公共字段里,active 的待办也能合法带上
 * 完成时间 —— 状态不自洽的脏数据在类型层就放行了。可辨识联合把
 * "什么状态配什么字段"钉死:收窄到 active 时,completedAt 连存在
 * 都不被允许。
 *
 * @example
 *   const t: ActiveTodo = {
 *     status: 'active',
 *     id: 't1',
 *     title: '写周报',
 *     priority: 'medium',
 *     createdAt: '2026-09-03T09:00:00Z',
 *   }
 */
export type ActiveTodo = {
  status: 'active'
  id: string
  title: string
  createdAt: string
  priority: TodoPriority
  /** 标签,可选。注意:exactOptionalPropertyTypes 下"可选"意味着不能显式传 tags: undefined */
  tags?: string[]
}

/**
 * 已完成的待办 —— status 为 'done',比 ActiveTodo 多一个 completedAt。
 *
 * @example
 *   const t: DoneTodo = {
 *     status: 'done',
 *     id: 't1',
 *     title: '写周报',
 *     priority: 'medium',
 *     createdAt: '2026-09-03T09:00:00Z',
 *     completedAt: '2026-09-03T10:00:00Z',
 *   }
 */
export type DoneTodo = {
  status: 'done'
  id: string
  title: string
  createdAt: string
  priority: TodoPriority
  tags?: string[]
  /** 完成时间(ISO 字符串)。只在这个分支上存在 */
  completedAt: string
}

/**
 * 待办可辨识联合 —— 判别符是字面量 status,收窄全靠它。
 *
 * @example
 *   declare const todo: Todo
 *   if (todo.status === 'done') {
 *     todo.completedAt // OK:已收窄到 DoneTodo
 *   }
 */
export type Todo = ActiveTodo | DoneTodo

/**
 * 过滤器状态 —— 三个预设 + 模板字面量的自定义标签过滤器。
 * 注意 'tag:'(空标签名)也必须合法:`tag:${string}` 里的 string
 * 覆盖空串,所以不用额外做什么。
 *
 * @example
 *   const f1: FilterStatus = 'active'
 *   const f2: FilterStatus = 'tag:work'
 *   const f3: FilterStatus = 'tag:' // 空标签名合法
 *   // @ts-expect-error —— 大小写敏感,且必须是 tag: 前缀
 *   const bad: FilterStatus = 'TAG:work'
 */
export type FilterStatus = 'all' | 'active' | 'done' | `tag:${string}`

// =============================================================
// 🟡 进阶:存储接口与事件映射
// =============================================================

/**
 * KV 存取接口 —— 类 localStorage 的端口(Port),get/set 都是泛型方法。
 *
 * JSDoc 思考题:T 为什么声明在方法上而不是接口上(为什么不是 KVStorage<T>)?
 * 答:同一个存储实例要服务**多种**值类型 —— 这一秒 `get<Todo[]>('todos')`,
 * 下一秒 `get<number>('count')`。T 提到接口上,类型参数就得在"创建实例"
 * 时定死一次,一个实例只能存一种类型,或者被迫 `KVStorage<Todo[] | number>`
 * 这种越并越宽的大杂烩。泛型方法 = "类型由每次调用点自己声明、自己负责",
 * 实例本身只管字节流的存取。代价也要知道:它**承诺了但不校验** ——
 * 存进去的 JSON 到底是不是 T,类型层一无所知(Day 28 会把这层承诺改诚实)。
 *
 * @example
 *   declare const storage: KVStorage
 *   storage.set<Todo[]>('todos', [])
 *   const todos = storage.get<Todo[]>('todos') // Todo[] | null
 *   const count = storage.get<number>('count') // number | null —— 同一实例,另一个 T
 */
export interface KVStorage {
  /** 取值;键不存在时返回 null(而不是 undefined —— 与 localStorage 的行为对齐) */
  get<T>(key: string): T | null
  /** 存值;T 由调用方指定或由 value 推断 */
  set<T>(key: string, value: T): void
  /** 删键;不存在的键不报错 */
  remove(key: string): void
}

/**
 * 事件表 —— 事件名到载荷的映射。
 * todoToggled.status 是切换**后**的状态;'tag:work' 这类自定义过滤器
 * 也可以出现在 filterChanged 的两端。
 *
 * 为什么是一张"表"而不是三个接口?事件名 → 载荷的**映射关系本身**
 * 就是类型系统的输入:后面 EventName / TodoListener / TodoStore / TodoHandlers
 * 四个工具全部靠 keyof / 索引访问从这张表里"查"。表改一处,全家跟着变 ——
 * 这就是"单一事实源"。
 *
 * @example
 *   const payload: TodoEvents['filterChanged'] = { from: 'all', to: 'tag:work' }
 */
export type TodoEvents = {
  todoAdded: { todo: Todo }
  todoToggled: { id: string; status: Todo['status'] }
  filterChanged: { from: FilterStatus; to: FilterStatus }
}

/**
 * 全部事件名的联合 —— 用 keyof 从事件表里"查"出来,
 * 手写联合的话,加事件时两处会漂移。
 *
 * @example
 *   const name: EventName = 'todoAdded'
 */
export type EventName = keyof TodoEvents

/**
 * 监听器类型 —— K 决定载荷类型(索引查表)。
 *
 * @example
 *   const listener: TodoListener<'todoAdded'> = ({ todo }) => todo.title
 */
export type TodoListener<K extends EventName> = (payload: TodoEvents[K]) => void

/**
 * 待办仓库端口 —— on/emit 的事件名与载荷类型相关联。
 * 传 'todoAdded' 时 listener 参数自动推断为 { todo: Todo }。
 *
 * 这是"判别联合思维"的泛型版:事件名当判别符,泛型 K 当索引,
 * 去 TodoEvents 这张表里查载荷。签名一次写对,所有调用点自动对齐。
 *
 * 为什么 on/emit 是**泛型方法**而不是泛型接口(TodoStore<K>)?
 * 和 KVStorage 同一个道理:一个 store 实例要在生命周期里收发所有事件,
 * K 锁在接口上就废了。
 *
 * @example
 *   declare const store: TodoStore
 *   store.on('todoAdded', ({ todo }) => console.log(todo.title))
 *   store.emit('filterChanged', { from: 'all', to: 'tag:work' })
 *   // @ts-expect-error —— 传 todoAdded 却给 filterChanged 的载荷,编译期就拦下
 *   store.emit('todoAdded', { from: 'all', to: 'tag:work' })
 */
export interface TodoStore {
  on: <K extends EventName>(event: K, listener: TodoListener<K>) => void
  emit: <K extends EventName>(event: K, payload: TodoEvents[K]) => void
}

// =============================================================
// 🔴 边界:类型体操三连
// =============================================================

/**
 * 预设过滤器 —— 从 FilterStatus 里剔除所有 tag: 开头的自定义值。
 *
 * 原理三步:
 * 1. `'all' extends \`tag:${string}\`` 是 **false** —— 模板字面量在
 *    extends 左右两侧都是"模式",string 通配符只匹配"长得像 tag:xxx"的;
 * 2. Exclude<T, U> 的实现就是一行条件类型 `T extends U ? never : T`,
 *    而条件类型遇到**联合会分发** —— FilterStatus 的四个成员逐个问一遍;
 * 3. 'all'/'active'/'done' 答否留下,`tag:${string}` 答是删掉。
 *
 * @example
 *   const f: PresetFilter = 'all'
 *   // @ts-expect-error —— tag:work 不是预设过滤器
 *   const bad: PresetFilter = 'tag:work'
 */
export type PresetFilter = Exclude<FilterStatus, `tag:${string}`>

/**
 * 从标签过滤器里抠出标签名 —— 条件类型 + infer。
 * TagName<'tag:work'> = 'work';TagName<'tag:'> = '';TagName<'all'> = never。
 *
 * 两个细节:
 * 1. 模板字面量里的 `tag:${infer T}` 是"模式匹配":infer 站位的 T
 *    捕获前缀之后的全部内容 —— 空串也捕获,所以 'tag:' 得 '';
 * 2. 不匹配(非 tag: 前缀)走 false 分支给 never —— never 在联合里
 *    自动消失,不会污染调用方。
 *
 * @example
 *   type T1 = TagName<'tag:work'> // 'work'
 *   type T2 = TagName<'tag:'>     // ''
 *   type T3 = TagName<'all'>      // never
 */
export type TagName<S extends FilterStatus> = S extends `tag:${infer T}` ? T : never

/**
 * handler 表 —— 映射类型 + as 重映射 + Capitalize,
 * 把 TodoEvents 翻译成 Vue 组件 props 风格的 { onTodoAdded; ... }。
 *
 * 键:`on${Capitalize<K & string>}` —— K & string 排除 symbol/number 键;
 * 值:TodoListener<K> —— 注意值里的 K 还是**原始键**的 K,as 重映射
 * 只改键名,不改值对 K 的引用。
 *
 * @example
 *   declare const handlers: TodoHandlers
 *   handlers.onTodoAdded({ todo: { status: 'active', id: 't1', title: 'x', priority: 'low', createdAt: 'x' } })
 */
export type TodoHandlers = {
  [K in keyof TodoEvents as `on${Capitalize<K & string>}`]: TodoListener<K>
}
```

## 二、常见错误写法(点评人视角)

### 1. 判别符写成宽 `string`

```ts
// ❌
export type ActiveTodo = { status: string; id: string; /* ... */ }
export type DoneTodo = { status: string; /* ... */ completedAt: string }
export type Todo = ActiveTodo | DoneTodo
```

现象:一连串测试红 ——
- `probeNarrowing` 里 `t.status === 'done'` 无法收窄,`t.completedAt` 报 `TS2339: Property 'completedAt' does not exist`,收窄后的 `toEqualTypeOf<DoneTodo>` 不成立;
- `Extract<Todo, { status: 'done' }>` 挖不出 DoneTodo(宽 string 的两个分支都匹配不上字面量模式);
- 测试里那条 `expectTypeOf<{ status: string }>().not.toMatchTypeOf<Todo>()` 反着告诉你:宽 string 的对象**根本进不了 Todo**。

一句话:可辨识联合的生命线就是**字面量判别符**,`string` 会让联合退化成"两个长得像的物体"。

### 2. `completedAt` 放进公共字段(可选)

```ts
// ❌ 用 Base + 可选字段偷懒
type BaseTodo = { status: 'active' | 'done'; id: string; /* ... */ completedAt?: string }
```

现象:`keyof ActiveTodo` 断言红(多出 completedAt);收窄后 `t.completedAt` 是 `string | undefined` 而不是 `string`,断言红。
为什么错:这不仅是测试问题 —— active 的待办合法携带完成时间,状态不自洽。**"什么状态配什么字段"必须钉进类型**,收窄到 active 时 completedAt 连存在都不被允许,这才是判别联合的完整收益。

### 3. `tags` 显式写成 `tags: string[] | undefined`

```ts
// ❌
tags: string[] | undefined
```

现象:`exactOptionalPropertyTypes` 下,`tags: undefined` 能赋值了 —— 测试里 `const bad: ActiveTodo = rawWithUndefinedTags` 上方的 `@ts-expect-error` 报 **"Unused '@ts-expect-error' directive"**,测试红。
为什么错:`tags?: string[]`(可选)和 `tags: string[] | undefined`(必有、值可空)在 exact 模式是**两个不同的类型**:前者"键可以不出现,出现了就不能是 undefined",后者"键必须在、值随便空"。JSON 序列化、Vue props 透传时这个差别会实打实咬人。

```ts
// ✅
tags?: string[]
```

### 4. `KVStorage` 把 `<T>` 提到接口上

```ts
// ❌
export interface KVStorage<T> {
  get(key: string): T | null
  set(key: string, value: T): void
  remove(key: string): void
}
```

现象:测试的 `probeStorageGet(s: KVStorage)` 直接 `TS2347: Generic type 'KVStorage<T>' requires 1 type argument(s)`;就算补上 `<Todo[]>`,`get<number>('count')` 也无处安放。
为什么错:类型参数挂在接口上 = 实例创建时定死一次;挂在方法上 = 每次调用点自己实例化。**"一个实例服务多种类型"是方法级泛型的教科书场景**。

### 5. `Todo = ActiveTodo & DoneTodo`(交集)

```ts
// ❌ 两个分支用 & 拼
export type Todo = ActiveTodo & DoneTodo
```

现象:`Todo['status']` 是 `'active' and 'done'` 交出来的 `never`,断言 `'active' | 'done'` 红;判别收窄全部失效。
为什么错:状态机里两种状态是"或"不是"且" —— 一个对象**要么** active **要么** done。交集表示"同时是两个状态",status 只能是 never。判别联合的口诀:**分支用 |,分支内的字段要求用各自的类型钉死**。

### 6. `on` / `emit` 的载荷不与事件名关联

```ts
// ❌ 载荷取"所有载荷的联合"
export interface TodoStore {
  on(event: EventName, listener: (payload: TodoEvents[EventName]) => void): void
  emit(event: EventName, payload: TodoEvents[EventName]): void
}
```

现象:编译能过,但 `s.emit('todoAdded', { from: 'all', to: 'tag:work' })` **不再报错** —— 联合载荷来者不拒。测试里对应的 `@ts-expect-error` 变成 Unused directive,红。
为什么错:`TodoEvents[EventName]` 是"查表查出一整列",要查**某一行**必须让 K 在签名里流动:`<K extends EventName>(event: K, payload: TodoEvents[K])`。泛型 K 在这里扮演的角色就是判别联合里的 status —— "用一个值决定另一个值的类型"。

### 7. `TodoHandlers` 手写三个键

```ts
// ❌
export type TodoHandlers = {
  onTodoAdded: TodoListener<'todoAdded'>
  onTodoToggled: TodoListener<'todoToggled'>
  onFilterChanged: TodoListener<'filterChanged'>
}
```

现象:测试**能过**(类型值相等)。但验收清单明确要求"用了 as 重映射 + Capitalize,不是手写三个键"。
为什么错:这不是类型错误,是**维护性错误** —— 事件表加第四个事件,手写版静默漏掉一个 handler,而映射版自动长出来。类型体操的意义就在"让结构自己跟随事实源演化"。同理 `PresetFilter` 手写 `'all' | 'active' | 'done'` 也能骗过测试,但 `Exclude<FilterStatus, \`tag:${string}\`>` 才是"从事实源推导"的正解。

### 8. `Capitalize<K>` 忘了 `& string`

```ts
// ❌
[K in keyof TodoEvents as `on${Capitalize<K>}`]: ...
// error TS2344: Type 'K' does not satisfy the constraint 'string'
```

为什么错:`keyof TodoEvents` 的类型域是 `string | number | symbol`,Capitalize 只吃 string。`K & string` 把键域与 string 求交,number/symbol 键被过滤(本例键全是 string,但约束必须先满足)。Day 26 的 ActionEvents 同款坑 —— 一次踩,两次免疫。

### 9. `TagName` 的 false 分支写了 `S`

```ts
// ❌
export type TagName<S extends FilterStatus> = S extends `tag:${infer T}` ? T : S
// TagName<'all'> = 'all',而测试要求 never
```

为什么错:"抠不出标签名"和"原样返回输入"是两种语义。抠不出就该给 `never` —— never 在联合中自动消失(分配律的零元),调用方 `TagName<S>` 的结果可以直接拼进别的联合而不引入垃圾成员。**条件类型的 false 分支选 never 还是选别的,本质是在设计"失败时的代数性质"**。

## 三、思考题参考答案

**Q:为什么用字面量联合而不用 enum?**(TodoPriority 的 JSDoc 思考题)

1. **零运行时产物**:字面量联合擦除后什么都不剩;enum 编译出真实的 JS 对象(常量枚举也有一堆限制)。
2. **表达直接**：本题字符串联合直接表达允许的值，也便于组合模板字面量。字符串 enum 同样可以参与模板字面量（如 `${State}`），并非类型运算不支持 enum。
3. **边界友好**:JSON 来去的 API 载荷天然是 string,字面量联合直接对齐;enum 还要操心 `erasableSyntaxOnly`、isolatedModules 下的写法限制。
结论:契约层(类型)和值层分开 —— 需要值层枚举语义(遍历所有成员、reverse mapping)才考虑 enum 或 `as const` 对象。

**Q:`T` 为什么声明在方法上,而不是接口上?**(KVStorage 的 JSDoc 思考题)

同一个存储实例要服务多种值类型:`get<Todo[]>('todos')`、`get<number>('count')`。T 提到接口上就得在实例化时定死,一个实例一种类型;方法级泛型让**每次调用点自己声明、自己负责**。这条分界线值得记住:**"调用方知道自己要什么" → 方法级泛型;"对象创建时就确定" → 接口级泛型**。另外注意这层泛型的承诺是有水分的:localStorage 里存的字符串到底是不是 T,运行时没人验证 —— Day 28 会把这层承诺改诚实(只管 string,恢复靠 unknown + 守卫)。

**Q:`'all' extends \`tag:${string}\`` 是 true 还是 false?为什么 `Exclude` 能"识别"模板字面量?**(PresetFilter 的思考题)

false。模板字面量在 extends 两侧都是**模式**:`tag:${string}` 只匹配"以 `tag:` 开头、后面跟任意字符串(含空串)"的类型。'all' 不长这样,答否。Exclude 能识别,是因为它的实现就一行条件类型 `T extends U ? never : T`,而条件类型遇到联合**分发** —— FilterStatus 的四个成员被逐个拿出来问一遍,答"是"的(`tag:${string}` 自己)变成 never 消失,答"否"的三个预设留下。**Exclude 的"过滤"本质 = 分发 + never 归零**。

**Q(隐含):为什么事件要建成一张表(TodoEvents),而不是三个独立接口?**

EventName、TodoListener、TodoStore、TodoHandlers 四个类型全部通过 keyof / 索引访问 / 映射从这张表**查询**得出。表是单一事实源:加一个事件,四个下游类型自动跟上;拆成三个接口,每加一个事件要人肉同步五处,漏一处就是"类型说得比运行时多"的经典事故。**先建表、再查表** —— 这是事件系统类型设计的通用骨架,Day 26 的 ActionEvents 同构。

## 四、验收自查清单

- [ ] `pnpm check:day 27` 通过（类型检查 + 运行时测试）
- [ ] 零 `any`、零 `as`;所有 export 有中文 JSDoc + `@example`
- [ ] `TodoPriority` 的 JSDoc 回答了"为什么不用 enum"
- [ ] `KVStorage` 的 JSDoc 回答了"T 为什么在方法上"
- [ ] `status` 是字面量联合,不是 `string`;`ActiveTodo` 上没有 `completedAt`(keyof 断言过)
- [ ] `tags?: string[]` 是可选,不是 `string[] | undefined`(exactOptionalPropertyTypes 的差别能说清)
- [ ] `FilterStatus` 含 `` `tag:${string}` ``,且 `'tag:'` 合法
- [ ] `TodoStore` 的 on/emit 用 `<K extends EventName>` 关联事件名与载荷(错配载荷编译报错)
- [ ] `PresetFilter` 用 Exclude + 模板字面量从 FilterStatus 推导,不是手写
- [ ] `TodoHandlers` 用 as 重映射 + Capitalize,不是手写三个键
- [ ] 对照第二节:9 条常见错误,你躲过了几条?第 3、6 两条是"测试能过但语义已错"还是"测试直接红"?
