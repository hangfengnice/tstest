# Day 11 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 11` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

> 已通过本 day 全部验收测试(vitest 20/20,`pnpm typecheck` 本 day 零错)。
> 零 `any`;`as` 恰好一次(emit 内部,带 TODO 注释)。

```ts
/**
 * Day 11 — 类型安全的发布订阅事件系统(事件名 → payload 的映射)
 *
 * 核心思路:一个"事件表"映射类型承载全部规格,
 * on / off / emit 的签名全部从这张表"查表"得出。
 */

// =============================================================
// Part 1 — 基础:事件表
// =============================================================

/**
 * 全局事件表 —— 事件名(字符串字面量)→ payload 类型的映射。
 * 事件规格(与后端/埋点组约定):
 *
 *   | 事件名 | payload |
 *   |---|---|
 *   | 'notify:success' | { title: string; message: string } |
 *   | 'notify:error' | { title: string; message: string; code: number } |
 *   | 'user:login' | { userId: string } |
 *   | 'modal:close' | undefined(无 payload) |
 *
 * 为什么必须用 type 别名而不是 interface:
 * EventBus 的泛型约束是 `E extends Record<string, unknown>`。
 * type 别名的对象类型具有**隐式索引签名**(TS 认为 `{ ping: number }`
 * 可以安全地当 `Record<string, number>` 用),而 interface 没有这层待遇 ——
 * TS 有意为之:interface 可以被"声明合并"追加任意成员,
 * 所以不敢替它承诺索引安全性。于是 interface 写的事件表
 * 不满足 `Record<string, unknown>` 约束,createEventBus<IEvents>() 直接报错。
 *
 * @example
 *   type MyEvents = {
 *     'notify:success': { title: string }
 *     'modal:close': undefined // undefined 表示该事件没有 payload
 *   }
 */
export type NotificationEvents = {
  'notify:success': { title: string; message: string }
  'notify:error': { title: string; message: string; code: number }
  'user:login': { userId: string }
  'modal:close': undefined
}

/**
 * 事件处理器 —— 处理事件 K 时收到的 payload 类型就是 E[K]。
 * "事件表 + 索引访问"让 handler 的参数类型由事件名决定,
 * 这就是 mitt 这类库类型安全的全部秘密。
 *
 * @example
 *   const h: EventHandler<NotificationEvents, 'user:login'> = (p) => p.userId
 */
export type EventHandler<E, K extends keyof E> = (payload: E[K]) => void

// =============================================================
// Part 2+3 — EventBus 接口与工厂
// =============================================================

/**
 * 事件总线 —— on / off / emit 三个方法的签名都与事件表 E 联动。
 *
 * 三个方法都靠 `K extends keyof E` 把"事件名"变成泛型参数:
 * 调用时传入字面量(如 'user:login'),K 被钉死成那个字面量,
 * E[K] 随之查出具体 payload 类型 —— 拼错事件名 = K 推不出 = 编译报错。
 *
 * emit 的压轴签名(条件元组):
 *   ...args: E[K] extends undefined ? [] : [payload: E[K]]
 * - 'modal:close' 的值是 undefined → `undefined extends undefined` 成立
 *   → args 类型是空元组 [] → 一个参数都不许传;
 * - 'notify:success' 的值是对象类型 → 走 [payload: E[K]] 分支
 *   → payload 必传,且形状必须匹配(多余字段触发 excess property check)。
 *
 * 为什么不能写成 `payload?: E[K]`:可选参数表达的是"可以少传",
 * 但它同时允许**有 payload 的事件被漏传**(运行时才炸),
 * 而且无法表达"无 payload 事件硬塞参数要报错"(可选参数照样接受一个实参)。
 *
 * @example
 *   const bus = createEventBus<NotificationEvents>()
 *   bus.on('user:login', (p) => console.log(p.userId))
 *   bus.emit('user:login', { userId: 'u-1' })
 *   bus.emit('modal:close') // 无 payload 事件:零参数调用
 */
export interface EventBus<E extends Record<string, unknown>> {
  /** 订阅事件 K;handler 参数类型自动是 E[K] */
  on<K extends keyof E>(event: K, handler: EventHandler<E, K>): void
  /** 退订:传给 on 的同一个函数引用 */
  off<K extends keyof E>(event: K, handler: EventHandler<E, K>): void
  /** 发布:参数形状由条件元组 `E[K] extends undefined ? [] : [payload: E[K]]` 决定 */
  emit<K extends keyof E>(
    event: K,
    ...args: E[K] extends undefined ? [] : [payload: E[K]]
  ): void
}

/**
 * 创建事件总线。内部用 Map<事件名, Set<handler>> 存储。
 *
 * 存储类型的死结(参数逆变):
 * 每个事件的 handler 参数类型各不相同,要找**一个**签名让所有
 * (payload: E[K]) => void 都能存进去,本实现采用 (payload: never) => void ——
 * never 是 bottom 类型,逆变规则下它是所有函数参数类型的"公共下界",
 * 所以任何 handler 都放得进去。
 * 代价:取出来调用时需要 never 实参,而 never 值不存在 ——
 * 事件名与 payload 的对应关系只存在于类型层,运行时已丢失,
 * 只能在调用点断言回单参签名(见 emit 内部唯一一次 as)。
 *
 * @example
 *   const bus = createEventBus<NotificationEvents>()
 *   bus.on('notify:success', (p) => alert(p.title))
 *   bus.emit('notify:success', { title: '保存成功', message: '配置已更新' })
 */
export function createEventBus<E extends Record<string, unknown>>(): EventBus<E> {
  /**
   * 存储公共类型:never 在参数位 = "任何 handler 都收得下"(逆变的终点)。
   * 注意 Set 声明时必须显式给类型参数,否则 new Set([handler])
   * 会把元素类型固定成某个具体 handler 的签名,存不进这层公共类型。
   */
  type StoredHandler = (payload: never) => void
  const handlers = new Map<keyof E, Set<StoredHandler>>()

  return {
    on(event, handler) {
      let set = handlers.get(event)
      if (set === undefined) {
        set = new Set<StoredHandler>()
        handlers.set(event, set)
      }
      // (payload: E[K]) => void → (payload: never) => void:
      // 参数逆变检查 never extends E[K],恒成立,这里不需要任何 as
      set.add(handler)
    },

    off(event, handler) {
      // delete 的参数同样是 (payload: never) => void,handler 逆变放行
      handlers.get(event)?.delete(handler)
    },

    emit(event, ...args) {
      const set = handlers.get(event)
      if (set === undefined) return // 无人订阅:静默返回,不抛错

      // 统一按"单实参"分发:无 payload 事件 args 是 [],args[0] === undefined,
      // 恰好就是 E['modal:close'](= undefined),handler 收到一个 undefined 实参;
      // 有 payload 事件 args[0] 就是 payload 本身。两种事件在运行时归一成同一条路径。
      // 注意:对象字面量方法体内不能引用 contextual 签名的泛型参数名 K,
      // 用 typeof event(event 的类型就是 K)达到同样效果。
      const payload = args[0]

      // TODO(reason): 参数逆变的死结绕不开这一处 ——
      // StoredHandler((payload: never) => void)是本实现用于存储任意 handler 的公共类型,
      // 但调用它需要 never 实参(never 值不存在);事件名 ↔ payload 的对应只在类型层,
      // 运行时已丢失,无法重建。只能把 Set 断言回单参签名再调用
      // (参数放宽为 E[typeof event] | undefined,把"无 payload 事件"也诚实地纳入)。
      ;(set as Set<(payload: E[typeof event] | undefined) => void>).forEach((h) =>
        h(payload),
      )
    },
  }
}
```

## 二、常见错误写法(点评人视角)

### 1. emit 的 payload 写成可选参数(最常见)

```ts
// ❌ 错误写法
emit<K extends keyof E>(event: K, payload?: E[K]): void
```

现象:
- `bus.emit('notify:success')` **不报错**(payload 可省)→ handler 运行时收到 `undefined`,访问 `p.title` 直接 TypeError,该在编译期拦下的 bug 漏到了线上;
- `bus.emit('modal:close', { force: true })` 也不报错(可选参数照样接受一个实参)→ 测试里的两个 `@ts-expect-error` 会变成 **"Unused '@ts-expect-error' directive"(TS2578)**,测试的类型部分直接红。

```ts
// ✅ 正确姿势:rest 参数 + 条件元组
emit<K extends keyof E>(
  event: K,
  ...args: E[K] extends undefined ? [] : [payload: E[K]]
): void
```

为什么条件元组能同时满足两个方向:rest 参数的个数由元组长度决定 —— `[]` 长度为 0(零参数调用合法、多传报"Expected 0 arguments"),`[payload: E[K]]` 长度为 1(必传、漏传报"Expected 1 arguments")。"可选"和"禁止"是两回事,元组长度才有"禁止"的表达力。

### 2. `'modal:close': undefined` 写成可省略的字段

```ts
// ❌ 错误写法:想让 modal:close 不写值
export type NotificationEvents = {
  'user:login': { userId: string }
  'modal:close'?: undefined // ← 可选属性
}
```

现象:`NotificationEvents` 不再等于测试断言的形状(多出 `| undefined` 的可选标记,`toEqualTypeOf` 失败);而且可选属性在 `keyof` 里照样存在,事件表本身成了"可能缺成员"的表,后续 `E[K]` 全部变 `E[K] | undefined`。

```ts
// ✅ 正确姿势:值就是 undefined,表示"该事件的 payload 是 undefined"
'modal:close': undefined
```

语义区分:`'modal:close': undefined` 说的是"这个事件存在,payload 类型是 undefined";`?:` 说的是"这个事件可能不存在"。事件表要的是前者。

### 3. 事件表用 interface 声明(测试 97-107 行的反例)

```ts
// ❌ 错误写法
interface IEvents {
  ping: number
}
createEventBus<IEvents>()
// error TS2344: Type 'IEvents' does not satisfy the constraint 'Record<string, unknown>'
```

为什么:type 别名的对象字面量类型有**隐式索引签名**(TS 认为它随时可以按 `Record<string, T>` 的方式安全访问),而 interface 是"开放的"—— 可被声明合并(declaration merging)追加任意成员,TS 不敢替它承诺索引安全,所以这里没有索引签名的 IEvents 不满足该约束。interface 显式声明 `[key: string]: unknown` 后可以满足，但 keyof 会拓宽为 string | number，不再适合本题的精确事件表。

```ts
// ✅ 正确姿势
type TEvents = { ping: number }
createEventBus<TEvents>() // OK
```

顺带:这也解释了为什么 Vue/Pinia 源码里事件表、state 形状几乎全用 type。什么时候才用 interface?需要声明合并扩展第三方类型时(比如给 `console` 加方法、Nuxt 的模块声明合并)。

### 4. on 的 handler 要求 payload 之外的字段(参数逆变)

```ts
// ❌ 错误写法:'notify:success' 的 payload 没有 code
bus.on('notify:success', (p: { title: string; message: string; code: number }) => p.code)
// error TS2345: ... Types of parameters 'payload' and 'payload' are incompatible
```

为什么报错是**对的**:emit 时只会传 `{ title, message }` 形状的实参,handler 却要读 `p.code` → 运行时必是 undefined。`strictFunctionTypes` 下函数参数按逆变检查:目标 `(payload: {title; message}) => void` 只接受"参数要求 ≤ 自己"的函数。handler 的参数类型必须**不多要**。

```ts
// ✅ 正确姿势:要 code 就订阅带 code 的事件
bus.on('notify:error', (p) => p.code)
// 或者真的只需要少数字段:handler 参数照事件表写,取值时再挑
```

### 5. emit 传多余字段(对象字面量的 excess property check)

```ts
// ❌ 错误写法
bus.emit('notify:error', { title: 't', message: 'm', code: 1, extra: 'x' })
// error TS2353: 'extra' does not exist in type ...
```

为什么能拦住:对象字面量**直接出现在参数位**时,TS 会做多余属性检查(超出结构化类型的字面量赋值被拒)。注意边界:先赋给变量再传就不拦了 —— `const p = { ...extra } ; bus.emit('notify:error', p)` 能过(结构化类型只看形状,多余字段被静默忽略)。所以"防手滑"只在字面量直传时有效,这就是为什么业务代码里 payload 尽量内联传。

### 6. 内部存储的公共类型用 any(违反本仓库铁律)

```ts
// ❌ 错误写法
const handlers = new Map<keyof E, Set<(payload: any) => void>>()
```

现象:能编译能跑,但 `any` 沿调用链传染 —— `set.add(handler)` 处失去检查,后续 anyone 误改这行也不会有任何报警。本仓库规则:动态/异构数据一律 `unknown` 或更精确的守卫类型。

```ts
// ✅ 正确姿势:never 参数位
type StoredHandler = (payload: never) => void
```

`never` 在**参数位**的妙处:逆变规则检查"never 是否可赋给源参数类型",恒成立 → **任何** handler 都能存进来且全程有类型检查;而 `any` 是关掉检查。代价是取出来时没法直接调用(没有 never 值),于是有且仅有一次 as(见下一条)。

### 7. `new Set([handler])` 没显式给类型参数

```ts
// ❌ 错误写法
handlers.set(event, new Set([handler]))
// error TS2345: Set<(payload: E[K]) => void> 不能赋给 Set<(payload: never) => void>
```

为什么:`new Set([handler])` 从数组字面量**推断**出 `Set<(payload: E[K]) => void>`(具体那个事件的 handler 签名),和公共存储类型 `Set<StoredHandler>` 之间:比较 `add` 方法时逆变方向反了(见第 6 条的反面),不兼容。

```ts
// ✅ 正确姿势:显式钉住元素类型,让数组字面量按 StoredHandler 校验(逆变放行)
set = new Set<StoredHandler>()
```

### 8. emit 实现里 spread 分发(`h(...args)`)

```ts
// ❌ 错误写法(类型能过、运行时错)
set.forEach((h) => h(...args))
```

现象:`emit('modal:close')` 时 `args` 是 `[]`,spread 后 handler 被以**零实参**调用 `handler()`;而测试 `expect(onClose).toHaveBeenCalledWith(undefined)` 要求的是**一个 undefined 实参** `handler(undefined)` —— spy 记录的调用参数是 `[]` 而非 `[undefined]`,断言失败。vitest 的报错会显示 `Received: Array []`。

```ts
// ✅ 正确姿势:统一单实参分发
const payload = args[0] // 空元组时恰好是 undefined,与 E['modal:close'] 一致
set.forEach((h) => h(payload))
```

这条坑的启示:类型系统对"零参数"和"一个 undefined 参数"一视同仁,但测试和业务语义区分它们。

### 9. 对象字面量实现里引用 contextual 签名的泛型参数名

```ts
// ❌ 错误写法
emit(event, ...args) {
  ;(set as Set<(payload: E[K]) => void>)... // error TS2304: Cannot find name 'K'
}
```

为什么:`K extends keyof E` 是**接口签名**里的类型参数;对象字面量的方法实现虽然被接口 contextual 化(参数拿到正确类型),但接口的类型参数名**不进入**实现体的作用域。

```ts
// ✅ 正确姿势:用 typeof event(event 的类型正是 K)
;(set as Set<(payload: E[typeof event] | undefined) => void>).forEach((h) => h(payload))
```

### 10. 事件名参数不设泛型,直接联合

```ts
// ❌ 错误写法
emit(event: keyof E, payload: E[keyof E]): void
```

现象:`event` 是全部事件名的**联合**,payload 是全部 payload 的**联合**,联动关系断了 —— `bus.emit('user:login', { title: 't', message: 'm' })` 不报错(那个形状属于联合里的 notify:success);`emit('modal:close')` 反而报错(缺参数)。类型检查名存实亡。

```ts
// ✅ 正确姿势:K extends keyof E,让每次调用把 K 钉死成一个字面量,E[K] 才是"这一事件的 payload"
emit<K extends keyof E>(event: K, ...args: ...): void
```

## 三、思考题参考答案

**Q1(README Part 3 提示):`'modal:close'` 的值是 `undefined` 时,为什么正好走 `[]` 分支?**

条件类型 `E[K] extends undefined ? [] : [payload: E[K]]` 检查的是 **E[K] 这个类型本身是否是 undefined(的子类型)**。`E['modal:close']` 就是 `undefined`,`undefined extends undefined` 成立 → true 分支 `[]`。而有 payload 的事件(对象类型、string)不是 undefined 的子类型 → false 分支。注意一个边界:如果某事件的 payload 是 `string | undefined` 这种**含 undefined 的联合**,`extends undefined` 为 false(联合不是 undefined 的子类型),走 `[payload]` 分支,payload 仍必传(只是值可以是 undefined)—— 条件类型不拆联合看"是否含有",只看"整体是否兼容"。

**Q2(JSDoc 必答题):本题无索引签名的 interface 为什么不满足约束?**

见"常见错误"第 3 条:type 别名的对象类型有隐式索引签名,满足 `E extends Record<string, unknown>` 约束;interface 可被声明合并、是开放结构,TS 不给它隐式索引签名,所以不满足约束(TS2344)。

**Q3(Part 2 死结):为什么"收得下所有 handler"和"可被安全调用"不可兼得?**

本实现把不同事件的处理器放入同一种容器类型，键与载荷之间的关联在存储处被擦除。
`(payload: never) => void` 可接收这些处理器，却不能直接用真实载荷调用；因此在取出时根据事件键恢复签名。
这是当前存储方案的权衡，不是所有异构容器都只能使用一种类型的证明。
如果保留逐键映射及其关联，或把类型擦除移到写入处，设计也会不同。

## 四、验收自查清单

- [ ] `pnpm check:day 11` 通过（类型检查 + 运行时测试）
- [ ] 零 `any`;`as` 全文件仅一次(emit 内部),带 `// TODO(reason)` 说明逆变死结
- [ ] `NotificationEvents` 用 type 定义;JSDoc 解释了 interface 为什么不行(隐式索引签名 / 声明合并)
- [ ] 未知事件名 on/emit 都编译报错(K extends keyof E)
- [ ] 无 payload 事件:emit 不传参合法、硬塞参数报错(条件元组 `[]`);handler 运行时收到 undefined 实参
- [ ] 有 payload 事件:漏传报错、形状不符报错、多余字段报错(excess property check)
- [ ] handler 参数类型由事件名联动;要求多余字段的 handler 报错(参数逆变)
- [ ] off 之后不再触发;off 只移除指定 handler(Set.delete 的语义)
- [ ] 想通:`never` 在参数位 = 收得下一切;`as` 只出现在"取出调用"这一处
