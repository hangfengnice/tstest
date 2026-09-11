# Day 6 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下参考实现已通过本 day 全部验收测试(`npx vitest run src/day06` 28/28 全绿,`pnpm typecheck` 本 day 零错误)。

## 一、参考实现

```ts
/**
 * Day 6 — 泛型进阶:默认类型参数 / satisfies / const 类型参数
 *
 * 规则:零 any、零 as;所有 export 带 JSDoc + @example
 */

// =============================================================
// Part 1 — 事件映射表
// =============================================================

/**
 * 事件映射表 —— 事件名 → 载荷 的对应关系。
 *
 * 为什么先写"表"再翻"联合":表是**唯一数据源**。
 * 载荷形状只在这一处声明,EventEnvelope / Handler / formatEvent
 * 全部从它推导;新增事件只需加一行,下游类型自动跟着变。
 *
 * @example
 *   const p: EventMap['chip:run'] = { chipId: 'c1', arg: 'deploy' }
 */
export type EventMap = {
  'chip:run': { chipId: string; arg: string }
  'chip:done': { chipId: string; durationMs: number }
  'chip:error': { chipId: string; message: string }
}

/**
 * 事件信封 —— 把映射表"翻"成带 name 判别符的可辨识联合。
 *
 * 写法分两步读:
 *   1. `{ [K in keyof EventMap]: { name: K; payload: EventMap[K] } }`
 *      先得到"每个事件一行信封"的对象类型;
 *   2. `[keyof EventMap]` 立刻做索引访问,把所有行摊平成联合。
 *
 * 关键细节:同一行里 `name: K` 和 `payload: EventMap[K]` 用的是**同一个 K**,
 * 键和载荷的对应关系在映射内部锁死 —— 'chip:done' 行的 payload 只能是
 * durationMs 那个形状,不可能出现错配成员。
 *
 * @example
 *   const e: EventEnvelope = { name: 'chip:run', payload: { chipId: 'c1', arg: 'x' } }
 *   if (e.name === 'chip:done') e.payload.durationMs  // 判别符收窄,精确到行
 */
export type EventEnvelope = {
  [K in keyof EventMap]: { name: K; payload: EventMap[K] }
}[keyof EventMap]

// =============================================================
// Part 2 — 安全分发 + 默认类型参数 + satisfies
// =============================================================

/**
 * 渲染事件为日志行。
 *
 * 【实验结论:为什么不用泛型签名
 *  `<E extends keyof EventMap>(name: E, payload: EventMap[E])`?】
 *
 * 函数体里 `switch (name)` 时,`name: E` 是泛型,E 只是
 * "keyof EventMap 的某个子类型",case 只能把 name 收窄到 E & 'chip:run'
 * 这种交集;而 `payload: EventMap[E]` 是**延迟求值**的索引访问类型,
 * 不会跟着 name 的 case 收窄成 EventMap['chip:run'] ——
 * 于是在 case 'chip:run' 里 `payload.arg` 报 TS2339,逻辑写不下去。
 * (Day 2"泛型上 Extract 不收窄"是同一件事的另一面。)
 *
 * 判别联合参数没这个问题:e.name 和 e.payload 在**同一个对象成员**里,
 * switch e.name 是"按成员收窄整个对象",载荷自动到位。
 * 结论:多个值有依赖关系时,打包成判别联合再收窄,
 * 不要用泛型在参数之间拉关系。
 *
 * @example
 *   formatEvent({ name: 'chip:done', payload: { chipId: 'c1', durationMs: 5 } })
 *   // => '[chip:done] c1 耗时 5ms'
 */
export function formatEvent(e: EventEnvelope): string {
  // e.name 是判别符,每个 case 里 e.payload 精确收窄到该行载荷
  switch (e.name) {
    case 'chip:run':
      return `[chip:run] ${e.payload.chipId}(${e.payload.arg})`
    case 'chip:done':
      return `[chip:done] ${e.payload.chipId} 耗时 ${e.payload.durationMs}ms`
    case 'chip:error':
      return `[chip:error] ${e.payload.chipId}:${e.payload.message}`
  }
}

/**
 * 事件处理器类型 —— 带默认类型参数。
 *
 * 【默认参数解决了什么便利性问题?】
 * 不给默认时,"什么事件都能处理"的处理器必须显式写
 * `Handler<'chip:run' | 'chip:done' | 'chip:error'>` —— 把映射表的键抄一遍。
 * 以后映射表加事件,所有全事件处理器的标注都要手动同步,抄漏即 bug。
 * 默认参数让 `Handler` 裸用等价于全键版,"单事件"和"全事件"
 * 两种用法都只需写类型名本身。
 *
 * 裸用 Handler 的 payload 是 EventMap[keyof EventMap](载荷联合):
 * 全事件处理器拿到的是所有载荷的并集,函数体里想用具体字段
 * 还得运行时分支 —— 这是"宽处理器"的固有代价。
 *
 * @example
 *   // 单事件:参数精确
 *   const onDone: Handler<'chip:done'> = (name, p) => { void name; void p.durationMs }
 *   // 裸用:走默认参数,变全事件处理器
 *   const onAny: Handler = (name, p) => { void name; void p }
 */
export type Handler<E extends keyof EventMap = keyof EventMap> = (
  name: E,
  payload: EventMap[E],
) => void

/**
 * chip 运行配置 —— satisfies 的主角(对比实验在 solution.test.ts)。
 *
 * 【三种写法的行为差异(本 day 核心概念)】
 *
 * | 写法 | 结构检查 | 推断结果 |
 * |---|---|---|
 * | `satisfies ChipRegistry` | ✅(retries 传 string 报 TS2322) | ✅ 字面量保留(logLevel: 'debug') |
 * | `: ChipRegistry`(注解) | ✅ | ❌ 拓宽(logLevel: 'debug'\|'info'\|'error') |
 * | `as const` | ❌ 完全不查 | ✅ 字面量全保留(连 retries 都变 3) |
 *
 * 一句话:satisfies = 检查归检查,推断归推断。
 * 右边只当考试卷,不当下限类型的来源。
 *
 * @example
 *   const config = { retries: 3, logLevel: 'debug' } satisfies ChipRegistry
 *   config.logLevel  // 类型 'debug',不是联合
 */
export type ChipRegistry = {
  retries: number
  logLevel: 'debug' | 'info' | 'error'
}

// =============================================================
// Part 3 — const 类型参数
// =============================================================

/**
 * 路由注册 —— 出参保留全部字面量类型,path 约束仍然生效。
 *
 * 签名从测试反推:
 *   - `routes.home.path` 必须是 '/',不是 string
 *     → 普通泛型 T 会对字面量做拓宽推断,不达标;
 *   - `routes.chip.lazy` 必须是 true,不是 boolean;
 *   - `path: 123` 必须编译报错 → T 的约束要含 `path: string`。
 *   三条合起来唯一解:`<const T extends Record<string, { path: string }>>`。
 *
 * 【老办法 as const vs 新办法 const 类型参数,各有什么代价?】
 * - 调用端 `as const`:每个调用点都要记得加,漏一处字面量就拓宽;
 *   整个对象变 deep readonly,消费端可能要再解;
 *   且 as const 是断言,拼错字段名类型层不兜底。
 * - 签名端 `const T`:调用方零负担,约束照常生效(它是推断修饰,不是断言);
 *   代价是出参属性带 readonly 修饰,下游若要求可变对象会不合,
 *   且"推断规则被改"这件事要求函数作者有意识。
 *   取舍 = 心智负担放库作者(const T)还是每个调用者(as const)。
 *
 * @example
 *   const routes = defineRoutes({ home: { path: '/' } })
 *   routes.home.path  // 类型 '/',不是 string
 */
export function defineRoutes<const T extends Record<string, { path: string }>>(
  routes: T,
): T {
  // 注册函数只做登记:原样返回,字面量信息在返回值里继续活着
  return routes
}
```

## 二、常见错误写法(点评人视角)

### 1. EventEnvelope 写成"笛卡尔积"(本 day 头号坑)

```ts
// ❌ name 和 payload 各自独立取联合
export type EventEnvelope = {
  name: keyof EventMap
  payload: EventMap[keyof EventMap]
}
```

现象:测试里 `formatEvent({ name: 'chip:done', payload: { chipId: 'c1', message: 'x' } })`
这条 `@ts-expect-error` 反例**直接失效**(报 "Unused '@ts-expect-error' directive"),
vitest typecheck 红。为什么:name 是三键联合、payload 是三载荷联合,
`{ name: 'chip:done'; payload: { message } }` 恰好是这两个集合的合法组合,
类型层认为它可赋值 —— 名字和载荷的**对应关系**被拆没了,剩下 3×3 的笛卡尔积。

✅ 正确姿势:在映射内部用同一个 `K` 把行锁死(见参考实现)。

### 2. keyof 和索引访问"分离"写法(丢关联性的变种)

```ts
// ❌ payload 分行对了,但 name 写成了整表键联合
export type EventEnvelope = {
  [K in keyof EventMap]: { name: keyof EventMap; payload: EventMap[K] }
}[keyof EventMap]
```

现象:比上一条更隐蔽 —— payload 看起来是分行的,但每个成员的 `name`
都是 `keyof EventMap`,不是字面量判别符。`formatEvent` 里 `switch (e.name)`
后 **payload 完全不收窄**:

```
error TS2339: Property 'arg' does not exist on type
'{ chipId: string; arg: string } | { chipId: string; durationMs: number } | ...'
```

(已用 tsc 实证。)判别联合的"判别"必须靠**字面量类型的判别符**,
`keyof EventMap` 这种宽联合当判别符等于没有。

✅ `name: K` —— 判别符必须引用当前行的键。

### 3. formatEvent 用泛型签名(README 预告的 Day 2 坑复刻)

```ts
// ❌ 参数之间用泛型拉关系
export function formatEvent<E extends keyof EventMap>(
  name: E,
  payload: EventMap[E],
): string {
  switch (name) {
    case 'chip:run':
      return `[chip:run] ${payload.chipId}(${payload.arg})`  // ← payload.arg 报错
    ...
```

现象:`payload` 的类型是延迟求值的 `EventMap[E]`,switch `name` 收窄不了它:

```
error TS2339: Property 'arg' does not exist on type
'{ chipId: string; arg: string } | { chipId: string; durationMs: number } | ...'
```

(已用 tsc 实证。)注意:**调用端**这个泛型签名是安全的(传错组合会报错),
不安全的是**函数体内部** —— 这就是"收窄"和"约束"的区别。
多个参数有依赖 → 打包成判别联合对象;依赖关系只在一层 → 泛型才合适。

### 4. Handler 忘写默认参数

```ts
// ❌
export type Handler<E extends keyof EventMap> = (name: E, payload: EventMap[E]) => void

declare const onAny: Handler  // 裸用
```

现象:

```
error TS2314: Generic type 'Handler' requires 1 type argument(s).
```

(已用 tsc 实证。)测试"裸用:走默认参数"那条直接红。
想裸用就得写 `Handler<'chip:run' | 'chip:done' | 'chip:error'>`,
把映射表抄一遍 —— 映射表加事件时所有抄写处都要手动同步。

✅ `= keyof EventMap` 默认参数,一处声明,全键自动跟随。

### 5. satisfies 的两个反面

```ts
// ❌ a. 以为 satisfies 等价 as const,不查结构
const badConfig = { retries: 'three', logLevel: 'debug' } satisfies ChipRegistry
```

现象:

```
error TS2322: Type 'string' is not assignable to type 'number'.
```

(已用 tsc 实证;satisfies 的结构检查是真实的。)

```ts
// ❌ b. 该用 satisfies 的地方用了注解,字面量被拓宽
const annotated: ChipRegistry = { retries: 3, logLevel: 'debug' }
annotated.logLevel  // 'debug' | 'info' | 'error' —— 再也回不到 'debug'
```

之后把 `annotated.logLevel` 传给只收 `'debug'` 的 API 会莫名报错,
只能到处 `as`。记忆法:**注解改推断,satisfies 只验收**。

### 6. defineRoutes 的普通泛型版(测试红的原因)

```ts
// ❌ 版本一:非泛型 —— path 保住 string,字面量全丢
export function defineRoutes(routes: Record<string, { path: string }>) {
  return routes
}
// routes.home.path => string,expectTypeOf<'/'>() 红

// ❌ 版本二:普通泛型 —— 字面量照样被拓宽推断
export function defineRoutes<T extends Record<string, { path: string }>>(routes: T): T {
  return routes
}
// T 推成 { home: { path: string; ... } },path: '/' 依旧拓宽成 string
```

泛型的**约束**只管下限,不管推断时的拓宽 —— 字面量默认拓宽是 TS 的推断习惯,
`const T` 才是改推断习惯的那个开关。
另一个方向:只写 `const T` 不写约束也不行,`path: 123` 那条反例就抓不住了
(const 下 123 推成字面量 `123`,没有 `path: string` 约束就没有报错理由)。

### 7. (顺手一记)`as const` 老办法的坑

```ts
const routes = defineRoutes({ home: { path: '/' } } as const)
```

能过字面量断言,但:每个调用点都要记得加;出参 deep readonly;
而且如果 defineRoutes 的约束写得不严,`as const` 是断言不是检查,错了不兜底。
对比之下 `const T` 把这件事收进签名,调用方无感。

## 三、思考题参考答案

### Part 2 第 3 题:泛型签名版 formatEvent 为什么不行?

要点(参考实现 JSDoc 同款):
- `name: E` 在 switch 里每个 case 收窄的是 `E & 'chip:xxx'` 交集,但 `payload: EventMap[E]` 是延迟求值的索引访问,**不会跟着收窄**;
- 函数体里 `payload.arg` / `payload.durationMs` 全部 TS2339(已实证);
- 根因:泛型表达的是**参数之间**的关系,而 switch 收窄只发生在**同一值内部**(判别联合);
- 结论:依赖关系跨参数 → 判别联合;依赖关系只在类型层面 → 泛型。

### Part 2 第 4 题:默认类型参数解决了什么便利性问题?

- 没默认时"全事件处理器"必须写 `Handler<'chip:run' | 'chip:done' | 'chip:error'>`,键抄一遍;
- 映射表是活的(会加事件),抄写处是死的 —— 默认参数 `= keyof EventMap` 让裸 `Handler` 永远等于当下的全键版;
- 类比:`React.FC<Props = {}>`、`Record<K, V>` 家族里大量默认参数都是同一动机:**常用姿势零样板**。

### Part 2 第 5 题:satisfies / 注解 / as const 三者差异

| | 结构检查 | 推断 |
|---|---|---|
| `satisfies T` | ✅ | 保留字面量 |
| `: T` 注解 | ✅ | 拓宽到声明类型 |
| `as const` | ❌(纯断言) | 全部字面量 + deep readonly |

satisfies 的价值场景:**对象字面量既要过验收,又要以最精确的类型继续活下去**(配置对象、映射表、路由表)。

### Part 3 第 6 题:as const(调用端)vs const 类型参数(签名端)的代价

- as const:调用方每人记一遍;deep readonly 出参;断言不查错;
- const T:签名一次搞定;约束仍生效(它不是断言);出参带 readonly;推断规则被改这件事是库作者的心智负担;
- 工程直觉:**你控制签名且调用点很多** → const T;**函数不能改(第三方)** → 只能调用端 as const。

## 四、验收自查清单

- [ ] 零 `any`、零 `as`(测试里的 satisfies 对比实验也没用 as 模拟)
- [ ] 所有 `export` 有 JSDoc + `@example`
- [ ] `formatEvent` 的 JSDoc 写下了"泛型签名版为什么不行"的实验结论
- [ ] `Handler` 的 JSDoc 回答了默认类型参数的便利性
- [ ] `ChipRegistry` 的 JSDoc 说清 satisfies / 注解 / as const 三者差异
- [ ] `defineRoutes` 签名从测试反推,字面量全部保留
- [ ] 测试里 @ts-expect-error 反例保持生效(没删、也没因实现错误而失效)
- [ ] `npx vitest run src/day06` 全绿、`pnpm typecheck` 本 day 零错误
