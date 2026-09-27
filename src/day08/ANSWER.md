# Day 8 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 08` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下参考实现已通过本 day 全部验收测试(`npx vitest run src/day08` 44/44 全绿,`pnpm typecheck` 本 day 零错误)。

## 一、参考实现

```ts
/**
 * Day 8 — 手写 Extract / Exclude / ReturnType / Parameters + 综合复盘
 *
 * 规则:四个 My* 手写、事件总线零 any / 零 as,export 带 JSDoc + @example
 */

// =============================================================
// Part 1 — 条件类型入门
// =============================================================

/**
 * MyExtract —— 从联合 T 里挑出能赋给 U 的成员。
 *
 * 【实验结论:条件类型什么时候"分发"(distribute)?】
 * 分发只发生在**裸类型参数**上:检查对象写的是 T 本身(不是 T[]、
 * [T]、Promise<T> 这类包了一层的形态),且 T 当场是联合时,
 * TS 把联合拆开逐成员判断再合并:
 *   MyExtract<'a' | 'b' | 'c', 'b'>
 *     → ('a' extends 'b' ? 'a' : never) | ('b' extends 'b' ? ...) | ...
 *     → never | 'b' | 'c' → 'b' | 'c'
 * 包进数组后 T 是元组不是联合,没有成员可拆,整体一次判断 ——
 * 所以"想禁止分发,就把 T 包一层"反过来也是常用技巧。
 *
 * @example
 *   type A = MyExtract<'a' | 'b' | 'c', 'b' | 'c'>  // => 'b' | 'c'
 *   type B = MyExtract<['a' | 'b'], ['a' | 'b']>    // => ['a' | 'b'](不分发)
 */
export type MyExtract<T, U> = T extends U ? T : never

/**
 * MyExclude —— 踢掉能赋给 U 的成员。
 *
 * 和 MyExtract 镜像:一个用 never 换走成员、一个留 never 换走成员。
 * Day 7 的 MyOmit 里 `Exclude<keyof T, K>` 就是它。
 * 联合 | never = 联合本身,"分发给 never"是天然的过滤机制。
 *
 * @example
 *   type A = MyExclude<'a' | 'b' | 'c', 'c'>  // => 'a' | 'b'
 */
export type MyExclude<T, U> = T extends U ? never : T

// =============================================================
// Part 2 — infer 推断
// =============================================================

/**
 * MyReturnType —— 从函数类型里抠出返回值。
 *
 * 约束 `(...args: never[]) => unknown` 只放函数进门(传 string 报 TS2344)。
 * 参数写 never[] 是惯用姿势:never 是 bottom,任何参数列表都兼容,
 * 等于"参数随便,只看返回"。infer R = 在匹配位置声明类型变量让 TS 推。
 *
 * @example
 *   MyReturnType<() => 'a' | 'b'>  // => 'a' | 'b'
 */
export type MyReturnType<T extends (...args: never[]) => unknown> =
  T extends (...args: never[]) => infer R ? R : never

/**
 * MyParameters —— 抠出参数元组。
 *
 * infer 放在剩余参数上,推出的是**元组**(带标签、带可选性):
 * `(a: string, b?: number) => void` → `[a: string, b?: number]`,不是数组。
 *
 * @example
 *   MyParameters<(a: string, b?: number) => void>  // => [a: string, b?: number]
 */
export type MyParameters<T extends (...args: never[]) => unknown> =
  T extends (...args: infer P) => unknown ? P : never

// =============================================================
// Part 3 — 类型安全的事件总线(综合)
// =============================================================

/**
 * 聊天事件映射表 —— 事件名 → 载荷(唯一数据源)。
 *
 * @example
 *   const p: ChatEventMap['done'] = { reason: 'stop' }
 */
export type ChatEventMap = {
  message: { text: string; at: number }
  typing: { userId: string }
  done: { reason: 'stop' | 'length' }
  error: { message: string }
}

/**
 * 聊天事件名 —— `keyof ChatEventMap & string`。
 *
 * & string 的作用:把这批键钉在 string 家族 ——
 * 既是语义声明(以后有人用 symbol 当键,这里立刻收紧),
 * 也让 emitRaw 的 string 入口和它方向衔接清楚。
 *
 * @example
 *   const n: ChatEventName = 'message'
 */
export type ChatEventName = keyof ChatEventMap & string

/**
 * 验证事件名是否在映射表里(emitRaw 的第一道闸)。
 *
 * Set.has 语义就是"属于",也避开数组 includes 的参数型别纠纷。
 * 谓词是声明不是证明 —— 实现者对它负责:加事件要同步这里。
 *
 * @example
 *   isChatEventName('message')  // => true
 *   isChatEventName('nope')     // => false
 */
const chatEventNames: ReadonlySet<string> = new Set([
  'message',
  'typing',
  'done',
  'error',
])

export function isChatEventName(v: unknown): v is ChatEventName {
  return typeof v === 'string' && chatEventNames.has(v)
}

/**
 * message 载荷守卫 —— typeof object + in + typeof 字段(Day 4 三件套)。
 *
 * `in` 是关键一步:unknown 经检查后是 object,但 object 上取属性不行;
 * `'text' in v` 收窄到"带 text 键的对象",v.text 才合法。
 *
 * @example
 *   isMessagePayload({ text: 'hi', at: 1 })  // => true
 *   isMessagePayload({ text: 'hi' })         // => false(缺 at)
 */
export function isMessagePayload(v: unknown): v is ChatEventMap['message'] {
  return (
    typeof v === 'object' &&
    v !== null &&
    'text' in v &&
    typeof v.text === 'string' &&
    'at' in v &&
    typeof v.at === 'number'
  )
}

/**
 * typing 载荷守卫 —— { userId: string }。
 *
 * @example
 *   isTypingPayload({ userId: 'u1' })  // => true
 *   isTypingPayload({ userId: 1 })     // => false
 */
export function isTypingPayload(v: unknown): v is ChatEventMap['typing'] {
  return (
    typeof v === 'object' &&
    v !== null &&
    'userId' in v &&
    typeof v.userId === 'string'
  )
}

/**
 * done 载荷守卫 —— reason 是闭集,必须逐字面量比。
 *
 * `typeof v.reason === 'string'` 不够:字符串可以是任何串,
 * 闭集语义只有逐个 === 能守住。
 *
 * @example
 *   isDonePayload({ reason: 'stop' })    // => true
 *   isDonePayload({ reason: 'timeout' }) // => false
 */
export function isDonePayload(v: unknown): v is ChatEventMap['done'] {
  return (
    typeof v === 'object' &&
    v !== null &&
    'reason' in v &&
    (v.reason === 'stop' || v.reason === 'length')
  )
}

/**
 * error 载荷守卫 —— { message: string }。
 *
 * @example
 *   isErrorPayload({ message: 'x' })  // => true
 *   isErrorPayload(null)              // => false
 */
export function isErrorPayload(v: unknown): v is ChatEventMap['error'] {
  return (
    typeof v === 'object' &&
    v !== null &&
    'message' in v &&
    typeof v.message === 'string'
  )
}

/**
 * 事件总线接口 —— on / emit 在调用点用 K 锁载荷;emitRaw 收 unknown。
 *
 * 对比 Day 6 formatEvent 的结论:调用点泛型没问题,
 * 问题只出在函数体内要 switch 收窄时 —— emit 只转发不 switch,所以安全。
 *
 * @example
 *   const bus: ChatBus = createChatBus()
 *   bus.on('message', (p) => console.log(p.text))  // p 自动是 { text; at }
 */
export type ChatBus = {
  on<K extends ChatEventName>(
    event: K,
    handler: (payload: ChatEventMap[K]) => void,
  ): () => void
  emit<K extends ChatEventName>(event: K, payload: ChatEventMap[K]): void
  emitRaw(event: string, payload: unknown): boolean
}

/**
 * 创建事件总线 —— 第一阶段综合题。
 *
 * 【存储的坑:可选属性 vs 全量初始化(实测两种报错)】
 * 声明成 `{ [K in ChatEventName]?: Set<...> }` 后:
 *   1. `handlers[event].add(handler)` → TS2532: Object is possibly 'undefined';
 *   2. 想先补 `handlers[event] ??= new Set()` → TS2322:
 *      延迟求值的 `OptionalStore[K]` 被展开成四种 Set 的**交集**
 *      `Set<message 处理器> & Set<typing 处理器> & ...`,
 *      new Set() 推不出这个交集 —— 这就是 README 说的"泛型交集难题"。
 * 全量初始化(键必存在)两层全绕开:索引结果永远是 Set;
 * 且映射类型在泛型键 K 上保持同态实例化,
 * `handlers[event]` 的元素类型精确是 `(payload: ChatEventMap[K]) => void`,
 * 与 handler 严丝合缝,零 as。
 * 工程含义:类型系统不认识"运行时一定是全的",它只认声明 ——
 * 想要非可选的保证,就把非可选写进声明并付出初始化代价。
 *
 * @example
 *   const bus = createChatBus()
 *   const off = bus.on('message', (p) => console.log(p.text))
 *   bus.emit('message', { text: 'hi', at: 1 })
 *   off()
 */
export function createChatBus(): ChatBus {
  // 存储是本题最难点:映射类型 + 全量初始化(四个键一个不少)
  const handlers: { [K in ChatEventName]: Set<(payload: ChatEventMap[K]) => void> } = {
    message: new Set(),
    typing: new Set(),
    done: new Set(),
    error: new Set(),
  }

  // 泛型键 K 上的同态实例化:handlers[event] 的元素类型精确跟随 K
  function on<K extends ChatEventName>(
    event: K,
    handler: (payload: ChatEventMap[K]) => void,
  ): () => void {
    handlers[event].add(handler)
    return () => {
      handlers[event].delete(handler)
    }
  }

  function emit<K extends ChatEventName>(event: K, payload: ChatEventMap[K]): void {
    handlers[event].forEach((h) => h(payload))
  }

  function emitRaw(event: string, payload: unknown): boolean {
    // 第一道闸:事件名必须在表里
    if (!isChatEventName(event)) return false
    // 第二道闸:switch 收窄 event,逐事件用对应守卫验载荷 —— 事件和守卫配对
    switch (event) {
      case 'message':
        if (!isMessagePayload(payload)) return false
        emit(event, payload) // 双重收窄后 K 推为 'message'
        return true
      case 'typing':
        if (!isTypingPayload(payload)) return false
        emit(event, payload)
        return true
      case 'done':
        if (!isDonePayload(payload)) return false
        emit(event, payload)
        return true
      case 'error':
        if (!isErrorPayload(payload)) return false
        emit(event, payload)
        return true
    }
  }

  return { on, emit, emitRaw }
}
```

## 二、常见错误写法(点评人视角)

### 1. 存储声明成可选属性(本题最深的坑,两个报错都实测过)

```ts
// ❌ 第一报错:直接用
const handlers: { [K in ChatEventName]?: Set<(p: ChatEventMap[K]) => void> } = {}
function on<K extends ChatEventName>(event: K, handler: (p: ChatEventMap[K]) => void) {
  handlers[event].add(handler)
}
```

现象:

```
error TS2532: Object is possibly 'undefined'.
```

```ts
// ❌ 第二报错:想先补一个 Set 再用(??= / 条件赋值)
store[event] ??= new Set()
```

现象:

```
error TS2322: Type 'Set<(p: ChatEventMap[K]) => void>' is not assignable to type 'OptionalStore[K]'.
  Type 'Set<(p: ChatEventMap[K]) => void>' is not assignable to type
  'Set<(p: { message: string; }) => void> & Set<(p: { text: string; at: number; }) => void> & ...'
```

看仔细:目标被展开成四种 Set 的**交集**(README 说的"泛型交集难题")——
延迟求值的 `Store[K]` 在写入校验时用约束的交集垫底,而 `new Set()`
推不出交集。到这里通常就有人掏 `as` 了。

✅ 全量初始化:声明不带 `?`,四个键当场写满。键必存在 → 没有 undefined 分支;
映射类型在泛型键上保持同态实例化 → `handlers[event].add(handler)` 严丝合缝(实测零报错)。

### 2. 存储声明放宽成"联合处理器"

```ts
// ❌ 看起来省事:所有 Set 元素统一成联合载荷的处理器
type LooseStore = Record<ChatEventName, Set<(p: ChatEventMap[ChatEventName]) => void>>
loose[event].add(handler)  // event: K, handler: (p: ChatEventMap[K]) => void
```

现象(实测):

```
error TS2345: Argument of type '(p: ChatEventMap[K]) => void' is not assignable to
parameter of type '(p: { text: string; at: number; } | { userId: string; } | ...) => void'.
```

方向反了(函数参数逆变):联合处理器必须**什么载荷都能收**,
单事件处理器只收一种 —— 前者是后者的超类型,塞不进去。
"窄存储、宽读取"在 Day 10 的 isTransitionAllowed 还会再出现一次。

### 3. 载荷守卫缺 `in` 这一步

```ts
// ❌
function badGuard(v: unknown): v is ChatEventMap['message'] {
  return typeof v === 'object' && v !== null && typeof v.text === 'string'
}
```

现象(实测):

```
error TS2339: Property 'text' does not exist on type 'object'.
```

`object` 类型的值取任意具名属性都不行;`'text' in v` 才把 v 收窄成
"带 text 键的对象"。这是 Day 4 三件套(`typeof object` + `in` + `typeof 字段`)
缺一不可的原因。

### 4. reason 用 typeof string 验(运行时洞,测试抓)

```ts
// ❌
v.reason === 'string' 的判断写成 typeof v.reason === 'string'
```

现象:`emitRaw('done', { reason: 'timeout' })` 返回 true,守卫形同虚设 ——
测试 'reason 闭集外的值:false' 红。类型层的 `'stop' | 'length'` 是**闭集**,
运行时没有闭集这回事,只能逐字面量 `===`。
(顺带:写成 `typeof` 还会顺手放行多余字段的 reason。)

### 5. emitRaw 的守卫各自为战(没有把"事件名 × 守卫"配成对)

```ts
// ❌ 编译能过,运行时错配
if (!isChatEventName(event)) return false
if (!isMessagePayload(payload)) return false
emit(event, payload)  // event 可能是 'typing',payload 却是 message 形状
```

现象:编译器不报错(payload 是联合成员,赋给联合参数合法),
但 `emitRaw('typing', { text: 'x', at: 1 })` 会返回 **true**,
把 message 载荷发给 typing 处理器 —— 两个守卫各自验各自的,
没人保证**这一对**是匹配的。测试里 `on('typing', (p) => p.userId)`
的处理器拿到 `{ text, at }` 直接运行时炸。

✅ switch (event) 收窄事件名,每个 case 里用**对应的**守卫 ——
配对关系由控制流锁定(见参考实现)。

### 6. emitRaw 里 unknown 直接转发(偷懒版)

```ts
// ❌
function badEmitRaw<K extends ChatEventName>(event: K, payload: unknown) {
  emit(event, payload)
}
```

现象(实测):

```
error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'ChatEventMap[K]'.
```

类型系统在这里是讲理的:unknown 就是不能进类型化世界,
**必须**经过守卫收窄 —— 这正是 Day 4 "unknown + 守卫"的用武之地,
也是 emitRaw 存在的意义(外部数据不是你定义的,别信它)。

### 7. MyParameters / MyReturnType 忘写约束

```ts
// ❌
export type MyParameters<T> = T extends (...args: infer P) => unknown ? P : never
```

现象:`MyParameters<string>` 不报错(条件类型对不匹配者返回 never,
安静通过)—— 测试的 `@ts-expect-error`(要求 TS2344)反例失效,
"Unused '@ts-expect-error' directive" 让 typecheck 红。
约束 `T extends (...args: never[]) => unknown` 是**报错的触发器**,
不加约束时条件类型是"温柔失败",错误被吞成 never。

## 三、思考题参考答案

### Part 1 第 1/2 题:条件类型什么时候分发?包进数组还分发吗?

- 分发条件(两条缺一不可):检查对象是**裸类型参数**(写 `T extends U`,
  不是 `T[] extends U` / `[T] extends U`);该参数当场是**联合**;
- `MyExtract<'a' | 'b', 'b'>` → 逐成员判断 → 'b';
- `MyExtract<['a' | 'b'], ['a' | 'b']>` → T 是元组,无成员可拆,
  整体一次判断,原样返回 —— 测试第 4 条断言锁死的就是这个边界;
- 用途:想分发就裸写;想对一个联合"整体"做判断(比如判断是不是数组),
  先包一层再 extends。
- 阶段闭环:`MyExtract<Notification, { type: 'email' }> === EmailNotification`
  —— Day 1 踩的"泛型上 Extract 不收窄",今天看到了 Extract 的内部就是分发,
  不收窄的原因也清楚了:泛型参数不是"当场的联合",没有可拆的成员。

### Part 3 第 8 题:可选存储 vs 全量初始化(见第二节第 1 条)

- TS2532(undefined)+ TS2322(泛型交集)两个实测报错;
- 全量初始化 = 把"运行时必然"写进"类型声明";
- 记进 NOTES 的版本:**声明里的 `?` 是给类型系统看的求饶,
  不是给运行时看的乐观。**

## 四、验收自查清单

- [ ] 四个 My* 全部手写,与内置版本对等断言全绿
- [ ] `MyExtract` / `MyExclude` 的 JSDoc 写下"分发条件"的实验结论
- [ ] 事件总线:零 `any`、零 `as`
- [ ] `createChatBus` 的 JSDoc 记下"可选存储 vs 全量初始化"的坑(含真实报错)
- [ ] `emitRaw` 对坏数据返回 false 且不触发任何处理器
- [ ] 测试里 @ts-expect-error 反例保持生效
- [ ] (复盘)Day 1 的 switch 穷尽、Day 4 的守卫现在还卡吗?卡点记进 NOTES.md
- [ ] `pnpm check:day 08` 通过（类型检查 + 运行时测试）
