# Day 12 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 12` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

> 已通过本 day 全部验收测试(vitest 11/11,`pnpm typecheck` 本 day 零错)。
> 零 `any`;`as` 恰好两次(store 整体一次、actions 动态键写入一次,各带 TODO 注释)。

```ts
/**
 * Day 12 — 迷你 Store:state / getters / actions 的类型推导(纯 TS 模拟 Pinia)
 *
 * 核心思路:defineStore 的参数类型里放"镜像映射"——
 * { [K in keyof G]: (state: S) => G[K] } —— TS 能从传入的函数对象
 * 反着推出 G(反向推导),这就是 Pinia / Vue 类型工程的地基。
 */

// =============================================================
// Part 1 — 基础:两个小泛型 + 业务状态
// =============================================================

/**
 * 状态工厂 —— 为什么 state 是函数不是对象:
 * store 可能被创建多次(SSR 每个请求一份、测试里每个用例一份),
 * 对象字面量会让所有实例**共享同一个引用** —— A 实例的 action 改了 items,
 * B 实例也跟着变(浅拷贝陷阱)。工厂函数保证每次调用都产出全新的对象。
 * Pinia 的 `state: () => ({ ... })` 同款原因;Vue 的 data 是函数也是它。
 *
 * @example
 *   const f: StateFactory<CartState> = () => ({ items: [], coupon: null })
 */
export type StateFactory<S> = () => S

/**
 * getter 函数 —— 输入 state,输出派生值。
 * R 独立于 S 存在,是因为"返回什么类型"由函数体决定,不由 state 决定。
 *
 * @example
 *   const g: GetterFn<CartState, number> = (s) => s.items.length
 */
export type GetterFn<S, R> = (state: S) => R

/**
 * 购物车状态(测试用的具体业务):items 是商品名列表,
 * coupon 是优惠券码,没有时是 null。
 *
 * 为什么不用 undefined 表示"没有优惠券":undefined 在 TS 里是"系统级缺省"
 * (字段没赋值、参数没传都是 undefined),用它表达业务语义"无券"会和
 * "这个字段根本没被赋过值"混淆;null 是**显式**的"无值"。
 * exactOptionalPropertyTypes 下两者区别还会被放大(可选属性连显式
 * undefined 都不让传)。JSON 里也只存在 null(undefined 序列化会被丢掉)。
 *
 * @example
 *   const s: CartState = { items: ['芯片A'], coupon: 'SALE10' }
 */
export interface CartState {
  items: string[]
  coupon: string | null
}

// =============================================================
// Part 2 — StoreInstance:实例形状
// =============================================================

/**
 * store 实例的形状(state / getters / actions 三块)。
 *
 * 关键理解:A 的语义是"action 名 → **payload 类型**",
 * 实例上的 actions 是**绑定好 state 的调用器**,只剩 payload 参数:
 *   type A = { addItem: string; clear: void }
 *   // void 表示 clear 无参数(调用时可省略 —— void 在参数位的独有待遇:
 *   //   (payload: void) => void 既可以 f() 也可以 f(undefined),
 *   //   其他类型都没有这个待遇)
 *
 * getters 在实例上是"求值结果"而不是函数 —— 为什么:
 * 使用方(组件)想要的是 `store.getters.count` 直接拿到 number,
 * 而不是 `store.getters.count()` 每次手动调;重算的时机交给响应式系统
 * (本题用 defineProperty 惰性求值模拟),类型层只需要保证"拿到的是结果类型"。
 * 所以 G 推的是结果形状 { count: number },StoreInstance 原样转述它。
 *
 * @example
 *   const inst: StoreInstance<CartState, { count: number }, { addItem: string }> = {
 *     state: { items: [], coupon: null },
 *     getters: { count: 0 },
 *     actions: { addItem: (p) => {} },
 *   }
 */
export interface StoreInstance<S, G, A> {
  state: S
  getters: G
  /** A 是"action 名 → payload 类型"的映射,实例上每个 action 只剩 payload 参数 */
  actions: { [K in keyof A]: (payload: A[K]) => void }
}

// =============================================================
// Part 3 — defineStore(签名从测试反推)
// =============================================================

/**
 * 创建迷你 store(签名是本题主角,从 solution.test.ts 反推)。
 *
 * 签名设计思路:
 *   - `state: StateFactory<S>` → S 由 state 工厂推出,显式标注返回类型时就是它;
 *   - `getters: { [K in keyof G]: GetterFn<S, G[K]> }` ← **镜像映射**:
 *     参数要的是"函数对象",泛型 G 却想拿到"结果形状"——
 *     在参数位写一个 G 的镜像(每个字段变成 (state: S) => G[K]),
 *     TS 从传入的 { count: (s) => s.items.length } 反推出
 *     G = { count: number; ... }。这叫反向推导(reverse mapped type)。
 *   - `actions: { [K in keyof A]: (this: S, payload: A[K]) => void }` ← 同款镜像,
 *     只是多一个 this 参数位:action 里的 this(即 S)由这里注入类型,
 *     运行时由 fn.call(state) 注入值。
 *
 * G/A 加 `extends Record<string, unknown>` 约束:表达"getters/actions
 * 就是字符串键的对象"的语义,同时让 Object.entries 这类字符串索引 API 接受它。
 *
 * 运行时:
 *   - getters 用 Object.defineProperty 做成"每次访问重算"(模拟响应式);
 *   - actions 包装一层,fn.call(state, payload) 把 state 绑到 this。
 *
 * @example
 *   const cart = defineStore({
 *     state: (): CartState => ({ items: [], coupon: null }),
 *     getters: { count: (s) => s.items.length },
 *     actions: {
 *       addItem(this: CartState, item: string) { this.items.push(item) },
 *     },
 *   })
 *   cart.actions.addItem('芯片A')
 *   cart.getters.count // => 1(每次访问重算)
 */
export function defineStore<
  S,
  G extends Record<string, unknown>,
  A extends Record<string, unknown>
>(options: {
  state: StateFactory<S>
  getters: { [K in keyof G]: GetterFn<S, G[K]> }
  actions: { [K in keyof A]: (this: S, payload: A[K]) => void }
}): StoreInstance<S, G, A> {
  const state = options.state()

  // TODO(reason): 动态键构建,类型系统无能为力 ——
  // getters/actions 的实际成员要到运行时 Object.entries 才知道,
  // 静态层面无法证明"空对象最终会被填成 StoreInstance 要求的形状",
  // 只能整体断言一次(之后 defineProperty / 循环填键都在这次断言的庇护下进行)。
  const store = {
    state,
    getters: {},
    actions: {},
  } as StoreInstance<S, G, A>

  // getters:defineProperty + get 访问器 → 每次访问都对当前 state 重算(模拟响应式)
  for (const [key, fn] of Object.entries(options.getters)) {
    Object.defineProperty(store.getters, key, {
      enumerable: true,
      get: () => fn(state),
    })
  }

  // actions:包装成"只剩 payload 参数"的调用器,this 由 call 注入
  for (const [key, fn] of Object.entries(options.actions)) {
    // TODO(reason): 动态键写入 —— key 来自 Object.entries(运行时字符串),
    // 而左侧 actions 的 mapped type 只接受 keyof A 的字面量键;
    // "循环变量 key ↔ A 的某个字段"的对应关系类型系统表达不了,只能按联合签名写入。
    const target = store.actions as Record<string, (payload: A[keyof A]) => void>
    target[key] = (payload) => fn.call(state, payload)
  }

  return store
}
```

## 二、常见错误写法(点评人视角)

### 1. getters 直接写 `G`,不做镜像(今天的头号坑)

```ts
// ❌ 错误写法:参数直接要求 G
export function defineStore<S, G extends Record<string, unknown>>(options: {
  state: StateFactory<S>
  getters: G
}): StoreInstance<S, G>
```

现象(实测 TS 5.6):
- 调用处 `getters: { count: (s) => s.items.length }` 直接报 **TS7006: Parameter 's' implicitly has an 'any' type** —— G 是裸泛型,TS 无法从它给 `s` 提供 contextual 类型;
- 强行标上 `(s: CartState)` 后不报错了,但 G 推成**函数对象的形状** `{ count: (s: CartState) => number }`,于是 `cart.getters.count` 是一个函数而不是 `number`,测试 `expectTypeOf(cart.getters.count).toEqualTypeOf<number>()` 失败。

```ts
// ✅ 正确姿势:参数位放 G 的"镜像"——每个字段翻折成 (state: S) => G[K]
getters: { [K in keyof G]: GetterFn<S, G[K]> }
```

为什么有效:传入 `{ count: (s) => s.items.length }` 时,TS 拿它和镜像逐字段对齐——`count` 要满足 `(state: S) => G['count']`,函数返回 `number`,于是 `G['count'] = number`。**从值反解出类型**,这就是 reverse mapped type。

### 2. 镜像可以通过别名与接口引用

```ts
type GetterDefs<S, G> = { [K in keyof G]: GetterFn<S, G[K]> }
```

当前编译器中，别名化的镜像以及包含它的 options 接口仍可反向推导 G。
内联可帮助读者直接看到对应关系，但不是推导成立的必要条件。
旧文案关于“隔一层必失效”以及未核实的旧版本归因已移除。

### 3. actions 的镜像漏掉 `this: S`

```ts
// ❌ 错误写法
actions: { [K in keyof A]: (payload: A[K]) => void }
```

现象:action 内一旦用到 `this`(比如 `this.items.push(item)`),报 **TS2683: 'this' implicitly has type 'any'**——镜像没有 this 参数位,this 的类型无处可推。调用方被迫每个 action 手写 `this: CartState` 标注,而这份标注和 S 完全脱钩:哪天 state 换了形状,手写标注不会跟着变,错误推迟到运行时。

```ts
// ✅ 正确姿势:this 是第一个"虚拟参数",镜像里必须给它留位
actions: { [K in keyof A]: (this: S, payload: A[K]) => void }
// 调用方甚至可以省略 this 标注,由镜像 contextual 注入
```

### 4. StoreInstance 的 actions 直接写 `A`(混淆"传入形状"和"实例形状")

```ts
// ❌ 错误写法
export interface StoreInstance<S, G, A> {
  state: S
  getters: G
  actions: A // ← A 是"payload 类型映射",不是可调用的函数
}
```

现象:A = `{ addItem: string }` 时,实例上 `cart.actions.addItem` 的类型是 `string` —— 类型不能调用,`cart.actions.addItem('芯片A')` 报 **TS2349: This expression is not callable**。

```ts
// ✅ 正确姿势:实例上的 action 是"绑定好 state 的调用器",由映射类型现做
actions: { [K in keyof A]: (payload: A[K]) => void }
```

同一个 A 在本题出现两次、两种身份:参数位是 `(this: S, payload: A[K]) => void`(用户写的原始 action),实例位是 `(payload: A[K]) => void`(绑定后的调用器)。分清这两张"脸",defineStore 的签名就通了。

### 5. 无参 action 的 payload 写成可选/省略

```ts
// ❌ 错误写法
type CartActionPayloads = { addItem: string; clear?: undefined }
// 或者 actions: { clear(this: CartState) {} } ← 镜像对不上
```

现象:`{ clear?: undefined }` 与测试断言的 `{ clear: void }` 不相等(`toEqualTypeOf` 失败);而且可选化之后 `StoreInstance.actions` 映射出 `(payload: undefined) => void`,与 `(payload: void) => void` 语义不同——后者调用时可省参数,前者不行(可选不等于 void 待遇)。

```ts
// ✅ 正确姿势:无参 action 的 payload 就是 void
type A = { addItem: string; clear: void }
// clear(): 合法(void 可省);clear('x'): 报错(void 参数位不吃 string)
```

### 6. 运行时:getters 只求值一次(没过"惰性求值"关)

```ts
// ❌ 错误写法:创建时就求值,之后 state 变了 getter 不动
const getters = {} as G
for (const [key, fn] of Object.entries(options.getters)) {
  ;(getters as Record<string, unknown>)[key] = fn(state) // ← 求值一次
}
```

现象:`cart.actions.addItem('芯片A')` 之后再读 `cart.getters.count`,还是 0 —— 测试"getter 基于当前 state 求值,action 修改后自动反映"失败。这就是 Pinia 需要响应式系统的原因:**派生值的失效重算不是普通对象能免费提供的**。

```ts
// ✅ 正确姿势:Object.defineProperty + get 访问器,每次访问重算
Object.defineProperty(store.getters, key, {
  enumerable: true,
  get: () => fn(state), // 读一次算一次
})
```

### 7. 运行时:把 state 当第一个参数传(`fn(state, payload)`)

```ts
// ❌ 错误写法:JS 的 this 不是参数!
target[key] = (payload) => fn(state, payload)
```

现象:调用 `cart.actions.addItem('芯片A')` 时,action 里的 `item` 收到的是 state 对象,`this` 是 undefined —— 严格模式下 `this.items.push(...)` 直接 TypeError。类型层也可能抓不到(取决于拿到 fn 的路径)。

```ts
// ✅ 正确姿势:call 把 state 注入 this 位,payload 回到参数位
target[key] = (payload) => fn.call(state, payload)
```

顺带:从对象上**点出来再调用**带 this 标注的函数(`options.actions.addItem(...)`)会被 TS 报 **TS2684**(this 上下文不符)—— 这类错误类型层能抓;但解构出来作为裸函数调用时,this 悄悄变 undefined,类型层不再追问。这也是为什么 Pinia 的 action 必须经由 store 实例调用。

### 8. 动态键循环的 as 越写越多

```ts
// ❌ 错误倾向:每一步都 cast 一次
const getters = {} as G                                   // as ×1
for (const key of Object.keys(m) as (keyof G)[]) {        // as ×2
  const fn = m[key as keyof G]                            // as ×3 …
```

现象:单看每处都"能编译",但 as 是**按行计价的信任透支**——每一处都在关掉一段检查。本 day 的验收是全文件至多两次。

```ts
// ✅ 正确姿势:把 cast 集中到"类型真正擦除"的两处 ——
// 1) 空对象 → StoreInstance 整体断言一次(运行时填键的模板)
// 2) 动态字符串键写入 mapped type(联合签名写入)
// 其余路径(Object.entries 解构出的 fn、defineProperty 的 key)都不需要 cast。
```

`Object.entries` 返回 `[string, 值类型联合][]`,key 是 string 但 defineProperty 本来就收 string;值是联合类型但 `fn.call(state, payload)` 对联合签名照样合法 —— 这两处天然零 cast。

## 三、思考题参考答案

**Q1:为什么 Pinia 的 state 是函数而不是对象?**

多个 store 实例共享同一份 state 引用的问题(SSR、测试隔离)。`() => ({ ... })` 每次调用产新对象。Vue 的 `data()` 同理。反例:对象字面量传进去,模块加载时求值一次,之后所有实例共用。

**Q2:`clear: void` 为什么就能 `cart.actions.clear()` 无参调用?**

`void` 在**参数位**有独有待遇:`(payload: void) => void` 的调用可以省掉实参(TS 对 void 参数特殊处理,历史原因是事件回调 `setTimeout(cb)`、`Array.forEach(cb)` 这类"回调少写参数"的惯例)。换成 `(payload: undefined) => void` 就必须传 `clear(undefined)`,换成本来可选的 `clear?: x` 又拦不住 `clear('x')`。所以"无参 action"在 payload 映射里的标准编码就是 `void`。

**Q3:getters 在实例上是"求值结果"而不是函数,为什么?**

组件里要的是 `store.getters.count` 这个值本身;调用仪式(`()`)对使用者是噪音。重算时机是响应式系统的职责(本题用 defineProperty 的 get 访问器模拟;真 Pinia 里是 computed)。类型层的分工:G 推"结果形状",StoreInstance 原样转述 —— 于是 `cart.getters.count` 直接是 `number`。

**Q4：镜像必须内联吗？**

不必。类型别名与 options 接口可以保留反向推导；新增勘误探针使用当前 TypeScript 验证。
若具体签名推断失败，应检查映射和上下文约束，而不是仅根据“隔了几层”判断。

**Q5:两个 as 分别在哪个"类型系统无能为力"的点?**

- 第一次(整体):空对象 `{ getters: {}, actions: {} }` 要被填成 StoreInstance —— "运行时循环会填满所有键"这个事实,类型系统无法证明(它只能看到静态形状,空的就是空的)。
- 第二次(actions 写入):`entries` 给的 key 是 string,而 mapped type 只认字面量键 —— "循环变量此刻对应哪个字段"运行时才知道。
两处都是 Day 11 主题(异构存储的逆变死结)的近亲:**动态性是类型断言的正当理由,静态能推的地方一个都不要 cast**。

## 四、验收自查清单

- [ ] `pnpm check:day 12` 通过（类型检查 + 运行时测试）
- [ ] 零 `any`;全文件 `as` 至多两次(动态键处),各带 `// TODO(reason)`
- [ ] getters / actions 类型**全部自动推导**,测试直接 `defineStore({...})` 不带泛型参数
- [ ] 镜像映射写在参数位:`{ [K in keyof G]: GetterFn<S, G[K]> }` + `{ [K in keyof A]: (this: S, payload: A[K]) => void }`
- [ ] getter 的 `s`、action 的 `this` 类型来自 S;访问不存在字段编译报错(TS2339)
- [ ] 实例 actions 只剩 payload 参数;`clear()` 可无参调用、`clear('x')` 报错(void 参数位)
- [ ] action 修改 state 后 getter 再访问反映新值(defineProperty 惰性求值)
- [ ] `StoreInstance` 的 actions 用映射类型 `(payload: A[K]) => void`,不是裸 `A`
- [ ] 想通:镜像映射 = "把想要的输出形状翻折成输入的形状,让 TS 反着解出来"
