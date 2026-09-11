# TypeScript 报错自查速查表(离线版)

> **用法**:卡住超过 10 分钟 → 先来这里按错误码/主题找 → 按自查顺序逐条排除 → 还不行再查官方文档。
>
> **本手册的依据**:错误码全部在 TS 5.6.3 + 本仓库 `tsconfig.json` 下实测复现过;
> 场景与坑全部来自本仓库 Day 1-30 的题面、测试反例(`@ts-expect-error`)和 NOTES.md 踩坑记录。
>
> **本仓库的严格开关**(很多错误码只在特定开关下出现,排错前先确认开关状态):
>
> | 开关 | 带来的额外报错 |
> |---|---|
> | `strict`(含 `noImplicitAny` / `strictNullCheck`) | TS2322 系列、TS2345 系列的基础 |
> | `noUncheckedIndexedAccess` | TS2532(索引访问带 undefined) |
> | `exactOptionalPropertyTypes` | TS2375(可选属性拒收显式 undefined) |
> | `noUnusedLocals` / `noUnusedParameters` | TS6133 |
> | `useUnknownInCatchVariables` | TS18046 / TS2322(catch 变量) |
> | `noFallthroughCasesInSwitch` | switch case 不 return/break 直接红 |
> | `verbatimModuleSyntax` | TS1484(类型必须 `import type`) |

---

## 第一部分:按错误码查

> **一个元规则**:同一个"写错",报什么码取决于**报错发生的位置**——
> 赋值语句(`const x: T = y`)报 2322/2741/2375,函数实参位置报 2345/2554,
> 对象字面量的未知属性报 2353,泛型实参不满足约束报 2344。
> 看到 2322 先想"我是不是在参数/返回/赋值三个位置之一"。

### TS2322 — Type 'X' is not assignable to type 'Y'(类型不匹配,最常见)

- **什么时候出现**:字面量拓宽后赋不进字面量联合;联合两边类型对不上;泛型推断结果比预期宽。
- **本仓库踩过的场景**:
  - Day 1/2:泛型上 `Extract<Notification, { type: K }>` **不收窄**,函数体内 return 任何单个分支对象都报 2322(条件类型在未落定的 K 上挂起)
  - Day 2:`mapResult` 推出 `Result<number, unknown>`,E 落回 unknown,赋给 `Result<number, ApiError>` 报 2322(**联合推断首分支效应**)
  - Day 3:`return 'syntax'` 无上下文时拓宽成 `string`,赋给字面量联合报 2322
  - Day 3:switch 漏了分支时,`const _exhaustive: never = shape` 报 2322(穷尽检查失败的标志)
- **自查顺序**:
  1. 读报错里的**期望类型 vs 实际类型**,找到第一个不同的属性/层级(报错通常贴出 "Types of property 'x' are incompatible")
  2. 实际类型比期望**宽**(string vs 'a'|'b')→ 查主题一「字面量拓宽」
  3. 实际类型里有 **unknown/never** → 查主题四「泛型不收窄」或 TS18046
  4. 期望类型是 `never` → 你在穷尽检查里漏分支了,补 switch case

### TS2339 — Property 'x' does not exist on type 'Y'(属性不存在)

- **什么时候出现**:访问联合中**其他分支**的字段;访问类型上确实没有的键。
- **本仓库场景**:
  - Day 10:`draft.requestId`(requestId 只在 sending/failed 分支)
  - Day 12:getters 里 `s.nope`、action 里 `this.nope`(s/this 的类型 = state 的类型)
  - Day 6:泛型函数体内 `switch(name)` 后 `EventMap[K]` 不收窄,`payload.id` 报 2339(实测复现;详见主题 4)
- **自查顺序**:
  1. hover 报错行的变量,看它**当前**的类型是联合的哪个分支(还是整个联合)
  2. 字段在别的分支 → 先收窄:`switch (x.status)` / `if (x.kind === '...')` / `'key' in x`
  3. 判别符是宽 `string`(不是字面量联合)→ 收窄永远不生效,改类型定义(Day 30 Q2)

### TS2344 — Type 'X' does not satisfy the constraint 'Y'(不满足泛型约束)

- **什么时候出现**:泛型实参落在约束之外;`expectTypeOf` 类型断言不匹配。
- **本仓库场景**:
  - Day 19:`ElementOf<string>`(约束是 `readonly unknown[]`)
  - Day 8:`MyParameters<string>`(约束是函数类型)
  - Day 3:返回值拓宽成 string,`expectTypeOf` 与字面量联合对不上(typecheck 时)
- **自查顺序**:
  1. hover 约束(`<T extends ...>` 里 extends 右边是什么),对照你传的类型
  2. 常见错配:`readonly unknown[]` vs 可变数组;`Record<string, unknown>` vs interface(见 TS2344 的 interface 变体:interface 没有隐式索引签名,Day 11 踩过)
  3. expectTypeOf 报的 → 不是调用错,是**推导结果**和断言不一致,用探针法看实际推出了什么(见第三部分)

### TS2345 — Argument of type 'X' is not assignable to parameter of type 'Y'(实参不匹配)

- **什么时候出现**:函数调用时参数类型/形状不对。**和 2322 同根,只是位置在实参**。
- **本仓库场景**:
  - Day 6/8/11:`emit('nope', ...)` 事件名不在 `EventMap` 里(报错直接说 `not assignable to 'keyof EventMap'`)
  - Day 8:`bus.emit('message', { text: 'hi' })` 载荷缺 `at` 字段
  - Day 15:`useToggle('yes')` 参数类型不符
- **自查顺序**:
  1. 看报错指的第几个参数
  2. 参数是字面量字符串 → 十有八九是事件名/键名拼错或不在联合里,对照映射表
  3. 参数是对象 → 看报错内层:缺字段(它会写 "Property 'x' is missing")还是字段类型错

### TS2352 — Conversion of type 'X' to type 'Y' may be a mistake(as 强转不重叠)

- **什么时候出现**:一段式 `as` 的源/目标类型重叠度不够。
- **本仓库场景**:Day 1 NOTES 记录的一段式 `as` 强转。
- **自查顺序**:
  1. 先问:这个 as 有没有资格存在?——能说出"运行时谁在履约"才许写(Day 5 的担保/履约模型)
  2. 真要转不相干类型,TS 要求两步:`as unknown as Y`(看到这种代码要警惕,通常该用守卫)
  3. 外部数据不要 as,用 is 谓词守卫(Day 4:as 是"我发誓",守卫是"我检查过")

### TS2353 — Object literal may only specify known properties(对象字面量多余属性)

- **什么时候出现**:对象字面量里出现目标类型没有的键。**多余属性检查只对"新鲜的字面量"生效**。
- **本仓库场景**:
  - Day 9:email 注册表单里塞 `phone`(条件字段的互斥就靠它拦截)
  - Day 11:载荷里塞 `extra`
  - Day 1(复验):`Omit<EmailOrSms, 'type'>` 求交集只剩 `{ body }`,写 `subject` 报 2353 —— **Omit 作用于联合的著名陷阱**
- **自查顺序**:
  1. 目标类型如果是 `Omit<联合, ...>` / `Extract<联合, ...>` 的结果 → 先 hover 看它**实际剩什么**(交集!),别按直觉以为剩并集
  2. 普通场景 → 拼写错误 / 字段不属于这个分支(判别联合该拆开了)
  3. 想允许扩展字段 → 目标加索引签名(但先想清楚要不要)

### TS2367 — This comparison appears to be unintentional(比较双方无重叠)

- **什么时候出现**:`===` 两边的类型没有任何交集。
- **自查顺序**:
  1. 一边是 never → 上游收窄/过滤把类型算空了(Day 20:`never` 在联合里被吸收,分布条件类型对空联合短路)
  2. 字面量拼错(`'done2'` vs `'done'`,Day 28 反例)
  3. 如果比较本身合法但类型推错 → 回头查变量声明的类型

### TS2375 — Type 'X' is not assignable to type 'Y' with 'exactOptionalPropertyTypes: true'

- **什么时候出现**:给可选属性**显式传 undefined**。本仓库高频坑(Day 7/9/13/15/17/28 测试全有反例)。
- **区分三件事**:`description?: string` 意思是"键可以不存在",不是"值可以是 undefined"。
- **自查顺序**:
  1. 删掉 `description: undefined` 这一行(让键不存在),或
  2. 类型改成 `description?: string | undefined`(明确接受 undefined),或
  3. 从源对象取值时用条件展开:`...(meta.description !== undefined ? { description: meta.description } : {})`
  4. 注意:**属性**才受这个管,可选**参数**传 undefined 合法(Day 15 测试注释:`options?: X` 传 `undefined` 可以,`{ storage: undefined }` 不行)

### TS2454 — Variable 'x' is used before being assigned(使用前未赋值)

- **什么时候出现**:`let x: T` 声明后,在保证赋值的路径之外使用。
- **自查顺序**:
  1. 所有分支都赋值了吗(if/else 只赋了一半、try 里赋值 catch 里没有)
  2. 能改成"表达式直接产出"就别用 let 先声明(Day 4 的 try 包裹 parse+验证就是这个思路)

### TS2532 — Object is possibly 'undefined'(索引访问带 undefined)

- **什么时候出现**:`noUncheckedIndexedAccess` 下,`arr[0]` / `record[key]` 的类型自动带 `| undefined`。
- **本仓库场景**:Day 5 `firstOf` 必须返回 `T | undefined` 的原因;Day 10 查表结果是 `T | undefined`。
- **自查顺序**:
  1. 先判空再访问:`if (items[0] !== undefined)` / `?? 默认值` / `?.`(但 `?.` 是建模欠账的利息,见 Day 2 NOTES)
  2. 确定非空 → 收窄守卫,不用非空断言 `!`

### TS2536 — Type 'K' cannot be used to index type 'T'(泛型键不能索引)

- **什么时候出现**:`T[K]` 里 K 与 T 没有绑定约束(`K extends keyof T`)。
- **本仓库场景**:Day 13 ResolveProps 坑 a:`{ [K in keyof D]: T[K] }` 中 K 来自 `keyof D` 而非 `keyof T`,TS 拦截。
- **自查顺序**:
  1. 检查 K 的约束:必须写 `K extends keyof T`(Day 5 的双人舞)
  2. K 来自别的映射(`keyof D`)→ 加 `K extends keyof T & keyof D`,或改用条件类型守门:`T[K & keyof T]`

### TS2540 — Cannot assign to 'x' because it is a read-only property(readonly 不可写)

- **什么时候出现**:给 `readonly` 属性赋值。
- **本仓库场景**:Day 7 `frozen.name = '改名'`、Day 21 `MyReadonly` 反例、Day 24 `PERMISSIONS.push('x')`(readonly 元组)。
- **自查顺序**:
  1. readonly 来自哪:类型定义 / `Readonly<T>` / `as const`(readonly 数组没有 push)
  2. 真要改 → 建新对象(`{ ...source, key: value }`,Day 7 applyEdit 的做法),别去掉 readonly
  3. readonly 是**浅**的(Day 21:嵌套对象内层没冻结);深只读要 `DeepReadonly`(Day 23)

### TS2554 — Expected N arguments, but got M(参数个数不对)

- **什么时候出现**:实参数量与形参不符。
- **本仓库场景**:Day 11 `emit('notify:success')` 缺 payload;Day 14 `emit('user:rename', 7)` 缺第二个参数。
- **自查顺序**:
  1. 该传的没传(payload 必填)
  2. 不该传的传了(`modal:close` 零参数事件,签名是 `...args: []`)
  3. 泛型版 emit 的"有无 payload"由条件元组控制:`...args: E[K] extends undefined ? [] : [payload: E[K]]`(Day 11)

### TS2578 — Unused '@ts-expect-error' directive(压制指令落空)

- **什么时候出现**:`@ts-expect-error` 下一行**没有**类型错误。本仓库三次真实踩坑(Day 1 ×1、Day 2 ×2)。
- **根因记忆**:它不是"你写对了",而往往是**报错被别的东西擦掉了**或**建模太弱,本该报错的代码没报**:
  - Day 1:`as never` 把报错擦掉,指令落空
  - Day 2:`RequestState` 拍平成可选字段,`idle.data` / `loading.error` 这种本不该访问的代码**没有报错** → 建模弱让断言落空(该用判别联合)
- **自查顺序**:
  1. 删掉指令看这行到底报不报错
  2. 不报错 → 类型建模有问题(非法状态可表示),回类型定义,而不是删指令了事

### TS2741 — Property 'x' is missing in type 'Y'(缺必填字段)

- **什么时候出现**:对象缺目标类型要求的字段。
- **本仓库场景**:Day 13 缺 `label`;Day 21 `RequiredAll` 后缺 `email`(`-?` 把可选变必填);Day 28 `createTodo` 缺 `title`。
- **自查顺序**:
  1. 补字段,或
  2. 该字段本就该可选 → 类型加 `?`(注意 exactOptionalPropertyTypes 的语义)
  3. 出现在 `Partial`/patch 场景 → 检查是不是用错了类型(把提交类型当草稿类型用)

### TS2769 — No overload matches this call(所有重载都不匹配)

- **什么时候出现**:函数重载的每一条签名都接不下这次调用。
- **本仓库场景**:Day 10 状态机非法转移:`transition(sent, { to: 'sending' })`,四条重载都不匹配 → 这正是**用重载表达"参数组合约束"**的设计(类型层直接拒绝非法转移)。
- **自查顺序**:
  1. 报错会**逐条列出每个重载为什么失败**——逐条读,找"最接近"的那条,通常只差一个字段
  2. 参数组合本身非法(状态机/事件表)→ 这是类型层在正确拦截,不是要你绕过
  3. 重载顺序问题 → 更具体的重载放前面(TS 从上往下匹配)

### TS18046 — 'x' is of type 'unknown'(unknown 不能直接用)

- **什么时候出现**:`useUnknownInCatchVariables` 下的 catch 变量、`JSON.parse` 结果、外部数据直接取属性/调方法。
- **本仓库场景**:Day 3/4 的核心主题;Day 15 fetcher reject;Day 17 transport reject;Day 25/28 JSON 数据。
- **自查顺序**:
  1. unknown 是**正确的起点**,别改成 any
  2. 原始值 → typeof 守卫;对象形状 → `in` 或自定义 is 谓词;类实例 → instanceof(Day 3 三件套)
  3. JSON 边界数据 → 谓词逐字段验证(Day 4 isChatDraft)或 Zod safeParse(Day 25)

### TS18048 — 'x' is possibly 'undefined'(可选属性/可能空)

- **什么时候出现**:可选属性的值直接使用(不是赋值,是**用**:`v.email.length`)。
- **本仓库场景**:Day 28 `matchesFilter` 里 `todo.tags`(可能不存在)。
- **自查顺序**:
  1. `if (todo.tags !== undefined)` 或 `todo.tags?.includes(x)`
  2. 和 TS2532 区分:2532 来自**索引访问**(开了 noUncheckedIndexedAccess),18048 来自**可选属性**——修法一样,根因不同

### TS2304 — Cannot find name 'X'(找不到名字)

- **什么时候出现**:用了未声明的类型参数或未导入的名字。
- **本仓库真实踩坑**:Day 2 —— 函数体用了 T/E,但**没在函数名后声明 `<T, E>`**。类型别名的参数声明在别名后(`type Foo<T> = ...`),函数的在函数名后(`function f<T>(...)`)——两处位置不一样。
- **自查顺序**:
  1. 类型参数漏声明 → 函数名后补 `<T, E = 默认值>`
  2. 名字拼错 / 忘 import
  3. import 了类型但没写 `import type` → 那是 TS1484(见下)

### TS6133 — 'x' is declared but its value is never read(未使用)

- **什么时候出现**:`noUnusedLocals` / `noUnusedParameters` 下,声明了没用。
- **本仓库场景**:Day 14 的**幽灵属性**就是被它逼出来的——`InjectionKey<T>` 里 T 不被任何成员读到会报 6133,所以加了 `__injectionType?: T` 占位。
- **自查顺序**:
  1. 真没用 → 删
  2. 泛型 T 只出现在标注上 → 加幽灵属性读取它(Day 14 / Day 17 `_response?: Resp` 同款)
  3. 参数故意不用 → 前缀 `_`(`_p: void`)

### TS7053 — Element implicitly has an 'any' type(动态键索引无签名)

- **什么时候出现**:`obj[stringKey]` 而 obj 没有字符串索引签名。
- **本仓库场景**:Day 21 `toRefsOwn`:`Object.keys(obj)` 返回 `string[]`,而 `obj[k]` 需要 `k: keyof T`。
- **自查顺序**:
  1. 把键收窄成 `keyof T`:`Object.keys(obj) as Array<keyof T>`(此处 as 合法:keys 的运行时结果确实是键)
  2. 或用 `Record<string, unknown>` 当中转站,读完再验证

### TS1484 — 'X' is a type and must be imported using a type-only import

- **什么时候出现**:`verbatimModuleSyntax` 下,普通 `import { SomeType }` 导入纯类型。
- **本仓库场景**:Day 16 `import type { renderPie } from 'legacy-charts'`(无真实模块文件的值位置 import 会在运行时炸)。
- **自查顺序**:
  1. 纯类型 → 改 `import type { X }`
  2. 值和类型混着用 → 分两行:`import { x }` + `import type { X }`

---

## 第二部分:按主题查(卡住了但没报错 / 不知道该搜什么)

### 主题 1:字面量拓宽(literal widening)

- **现象**:`'dark'` 传进函数后变 `string`;返回值推断成宽类型;`expectTypeOf` 说 string ≠ 字面量联合。
- **常见原因**:let 声明 / 函数返回值默认拓宽 / 无上下文类型的对象属性——三种拓宽通道(Day 3 专题)。
- **最小验证**:

```ts
// 通道 1:let 拓宽,const 保鲜
let a = 'debug'          // string
const b = 'debug'        // 'debug'

// 通道 2:函数返回值无注解时拓宽
function f() { return 'syntax' }   // () => string
function g(): 'syntax' { return 'syntax' }  // 返回注解提供上下文,保鲜

// 通道 3:无约束泛型拓宽,带约束泛型保鲜(Day 16 getConfig 的考点)
declare function getByKey<T>(k: string, fb: T): T
getByKey('theme', 'auto')    // string —— T 无约束,推断时字面量拓宽
declare function getConfig<T extends string | number | boolean>(k: string, fb: T): T
getConfig('theme', 'auto')   // 'auto' —— 约束保留字面量
```

- **修法**:返回注解一次给全函数上下文(还能当场抓拼写错误)/ `as const` / `satisfies` / const 类型参数。

### 主题 2:判别联合与收窄

- **现象**:`if (n.type === 'email')` 后还是访问不了 `n.subject`;switch 里 default 拿不到 never;两分支字段互相访问报 2339。
- **常见原因**:判别符不是**字面量类型**而是 `string`(收窄永不生效,Day 30 Q2);字段堆在一个大对象的可选属性里(Day 2 V1 建模、Day 29 坏味道②)。
- **最小验证**:

```ts
// 好:判别符是字面量,if 即收窄
type Notification =
  | { type: 'email'; subject: string }
  | { type: 'sms'; phone: string }
declare const n: Notification
if (n.type === 'email') n.subject  // OK

// 坏:宽 string 判别符,穷尽检查失效
type Bad = { type: string; subject?: string; phone?: string }
declare const b: Bad
switch (b.type) {
  case 'email': break
  case 'sms': break
  default: {
    const _ex: never = b  // 报 2322 —— b 不是 never,检查失效
  }
}
```

- **自查**:hover 判别符字段,看到的是 `"email" | "sms"` 还是 `string`;是后者回类型定义改。

### 主题 3:never 与穷尽检查

- **现象**:新增联合分支后 default 的 `never` 赋值报 2322;`never` 出现在意想不到的位置(索引访问、函数返回)。
- **常见原因**:漏分支(2322 是**恩人**,它在提醒);`never` 在联合中被吸收(Day 20:`'a' | never` = `'a'`);分布条件类型对 never 短路。
- **最小验证**:

```ts
type Todo = { status: 'active' } | { status: 'done'; completedAt: string }
function render(todo: Todo): string {
  switch (todo.status) {
    case 'active': return '[ ]'
    case 'done': return '[x]'
    default: {
      const _exhaustive: never = todo  // 漏分支时这里报 2322
      return _exhaustive
    }
  }
}
// never 吸收:type X = 'a' | never  →  hover 看,只剩 'a'
```

- **自查**:看到 2322 + never 关键字 = 漏了分支,别删检查,补 case。

### 主题 4:泛型不收窄(条件类型挂起)

- **现象**:泛型函数体内,`Extract<Union, { type: K }>` / `EventMap[K]` 上的 switch 不收窄;return 任何具体分支都报 2322。
- **常见原因**:函数体内 K 是"对所有可能的调用负责"的未落定参数,条件类型 `T extends U ? T : never` 无法判定就**挂起**;只有调用点 K 落定后才会求值(Day 1/2 两次踩坑,Day 6 再验,Day 9 又见:分支里 `form.method === 'email'` 收窄了 form 但泛型 T 不跟着收窄)。
- **最小验证**:

```ts
type EventMap = { run: { id: string }; done: { ms: number } }
function format<K extends keyof EventMap>(name: K, payload: EventMap[K]) {
  switch (name) {
    case 'run':
      payload.id  // TS2339 —— payload 仍是联合视角,switch(name) 收不窄 EventMap[K]
      break
  }
}
// 正解:把"表"翻成判别联合再 switch(Day 6):
type Envelope = { [K in keyof EventMap]: { name: K; payload: EventMap[K] } }[keyof EventMap]
```

- **修法**:参数 A 决定参数 B 的形状 → 用**判别联合参数**;返回类型跟着参数组合走 → 用**函数重载**(Day 10);两者都比泛型 Extract 可靠。

### 主题 5:联合推断首分支效应(E 推成 unknown)

- **现象**:泛型函数吃联合实参,一个类型参数推对了另一个落回 unknown/默认值。
- **常见原因**:TS 从联合实参推断泛型时,只认**联合第一个分支**的类型参数(Day 2 四轮探针实锤)。
- **最小验证**:

```ts
type Result<T, E> = { ok: true; data: T } | { ok: false; error: E }
function mapResult<T, U, E>(r: Result<T, E>, fn: (d: T) => U): Result<U, E> {
  return r.ok ? { ok: true, data: fn(r.data) } : r
}
const r: Result<string, { code: number }> = { ok: true, data: 'x' }
const out = mapResult(r, (d) => d.length)
// hover out —— E 推成了 unknown!(data 分支在联合第一位,带着 T;error 分支的 E 丢了)
```

- **修法**:调用点显式类型参数 `mapResult<string, number, { code: number }>(...)`(Day 2 测试 146 行的修法);或把联合实参先存进带注解的变量。

### 主题 6:可选属性与 undefined 的三态(exactOptionalPropertyTypes)

- **现象**:`{ detail: undefined }` 报 2375;展开对象后多出 `tags: undefined` 键;`toEditForm` 里的可选字段怎么写都红。
- **常见原因**:把"`键可以不存在`"和"`值可以是 undefined`"混为一谈;`...input` 会把值为 undefined 的键**写进对象**(Day 28 createTodo 坑)。
- **最小验证**:

```ts
type Address = { city: string; detail?: string }
const a1: Address = { city: '上海', detail: undefined }  // 2375,拒收
const a2: Address = { city: '上海' }                     // OK,键不存在
const input = { city: '上海', detail: undefined as string | undefined }
const a3 = { ...input }   // 运行时 a3.detail 键存在且是 undefined —— 展开不帮你删键

// "不传就没有键"的正确构造(Day 28):
function make(input: { detail?: string }) {
  return { ...(input.detail !== undefined ? { detail: input.detail } : {}) }
}
```

- **自查**:报 2375 → 三选一(删键 / 类型加 `| undefined` / 条件展开);对象多了 undefined 键 → 别裸展开,条件展开。

### 主题 7:映射类型同态性(修饰符保留与丢失)

- **现象**:手写 Omit 后可选字段变必填(`description?: string` 变 `description: string | undefined`);readonly 不见了。
- **常见原因**:**同态映射**(`[K in keyof T]`)自动保留 `?` 和 `readonly`;**非同态映射**(`[K in Exclude<keyof T, Ks>]`,键经过运算)会丢修饰符——TS 著名大坑(Day 7 Part 2 考点)。
- **最小验证**:

```ts
type ChipMeta = { readonly id: string; description?: string }
// 同态:保留 readonly 和 ?(MyPick 与内置 Pick 对等)
type Homog = { [K in 'id' | 'description']: ChipMeta[K] }
// 非同态:丢掉 ? —— description 变成必填的 string | undefined
type NonHomog = { [K in Exclude<keyof ChipMeta, 'id'>>: ChipMeta[K] }
// 正确的手写 Omit = Pick + Exclude 组合(键运算发生在 Pick 的泛型约束位,映射本身同态):
type MyOmit<T, K extends keyof T> = MyPick<T, Exclude<keyof T, K>>
type MyPick<T, K extends keyof T> = { [P in K]: T[P] }
```

- **自查**:手写工具类型后 `description` 的 `?` 消失 → 检查 `[K in ...]` 的键是不是裸 `keyof T`;`-?` 才会显式移除可选(同时移除值里的 `| undefined`,Day 7/21)。

### 主题 8:satisfies / as / 类型注解,三者差异

- **现象**:想知道配置对象"检查归检查、字面量保鲜"该用哪个;`as const` 满足不了结构检查。
- **三者一句话**(Day 6 核心概念题):
  - 注解 `: T` —— 检查 + **拓宽**(字面量按 T 磨圆)
  - `as const` —— 保鲜 + **不检查**(结构错了不报)
  - `satisfies T` —— 检查 + **保鲜**(结构错报错,字面量保留)
- **最小验证**:

```ts
type ChipRegistry = { retries: number; logLevel: 'debug' | 'info' | 'error' }
const a = { retries: 3, logLevel: 'debug' } satisfies ChipRegistry
a.logLevel  // 'debug' —— 字面量还在
const b: ChipRegistry = { retries: 3, logLevel: 'debug' }
b.logLevel  // 'debug' | 'info' | 'error' —— 被注解拓宽
const c = { retries: 'three' } satisfies ChipRegistry  // 报错!结构检查仍在
const d = { retries: 'three' } as const  // 不报错,埋雷
// 组合拳(Day 30 Q11):readonly + 检查 + 保鲜一次到位
const cfg = { port: 3000 } as const satisfies Record<string, number>
```

- **自查**:字面量丢了 → 注解换 satisfies;没检查 → as const 换 satisfies;想要全深 readonly → `as const satisfies`。

### 主题 9:as const 与深层 readonly

- **现象**:`PERMISSIONS.push('x')` 报 2540;数组推断成 `string[]` 而不是字面量元组;推导权限联合失败。
- **常见原因**:`as const` 把对象/数组冻成**全深 readonly 字面量**;没有它,`['a', 'b']` 是 `string[]`,长度、字面量信息全丢(Day 24:一切元组运算的前提)。
- **最小验证**:

```ts
const PERMISSIONS = ['conversation:read', 'conversation:write'] as const
// typeof PERMISSIONS = readonly ['conversation:read', 'conversation:write']
type Permission = (typeof PERMISSIONS)[number]   // 联合,从值推导类型
typeof PERMISSIONS['length']  // 2(数字字面量,不是 number)
PERMISSIONS.push('x')        // 2540,readonly 数组没有 push

const noConst = ['conversation:read']
typeof noConst[number]       // string —— 字面量全丢
```

- **自查**:元组/权限表相关推导结果变宽 → 先查源头有没有 `as const`;`const T` 类型参数(Day 6 defineRoutes)是把它挪进函数签名的替代法,代价是调用方字面量被强制收窄。

### 主题 10:索引访问与键约束(T[K] / keyof)

- **现象**:`T[K]` 报 2536;`keyof` 结果和预期不符;`Omit<联合>` 结果只剩公共字段。
- **常见原因**:K 没绑定到 keyof T;**keyof 联合 = 各成员键的交集**(Day 1/2 坑,Day 30 Q14);keyof 交叉 = 并(Day 30 Q10)。
- **最小验证**:

```ts
type Cat = { id: string; meow(): void }
type Dog = { id: string; bark(): void }
type Pet = Omit<Cat | Dog, 'id'>
// Pet = {} —— keyof (Cat | Dog) = 'id'(交集),Omit 掉之后什么都不剩
type Keys = keyof ({ a: 1; b: 2 } & { b: 3; c: 4 })  // 'a' | 'b' | 'c'(并)

// 正确姿势:先 Extract 单分支再 Omit
type CatOnly = Omit<Extract<Cat | Dog, { meow(): void }>, 'id'>

// 键和值锁在一起的双人舞(Day 5):
function getValue<T, K extends keyof T>(source: T, key: K): T[K] {
  return source[key]
}
```

- **自查**:`Omit<联合>` 结果异常 → 记住"先 Extract 后 Omit";`T[K]` 红 → 检查 `K extends keyof T` 写了没。

### 主题 11:分布式条件类型(裸参数分布)

- **现象**:`IsText<'a' | 1>` 得到 `boolean` 而不是 `false`;`TypeName<never>` 是 `never`;模板字面量里的联合自动展开。
- **常见原因**:条件类型遇到**裸类型参数**(T 直接在 extends 左边)且传入联合 → 拆开逐个判断再合并(Day 20 核心);对 never(空联合)直接短路返回 never;模板占位符遇联合天生分布(Day 22)。
- **最小验证**:

```ts
type Probe<T> = T extends string ? 'str' : 'other'
type A = Probe<'a' | 1>            // 'str' | 'other'(分布了)
type B = [ 'a' | 1 ] extends [string] ? never : never  // 思路:包元组
type Block<T> = [T] extends [string] ? true : false
type C = Block<'a' | 1>            // false(整体判断,[T] 阻止分布)
type D = Probe<never>              // never(空联合短路)
type E = Block<never>              // true([never] 是合法元组,不再是空联合)
type F = `on${Capitalize<'click' | 'select'>}`  // 'onClick' | 'onSelect'(模板天生分布)
```

- **自查**:结果比预期"多出来了"(多了另一分支的标签)→ 分布在工作,要么利用它(StatusBadge),要么 `[T]` 阻止它(IsText);结果变 never → 检查是不是空联合短路。

### 主题 12:infer 与模式匹配

- **现象**:想从 `Promise<X>`、函数类型、元组、模板字符串里"抠出"零件;infer 写在哪都不对。
- **常见原因**:infer 只能出现在 **extends 子句(模式位置)**;readonly 数组和可变数组是两种模式,一个 `(infer E)[]` 吃不下两种(Day 19 教训:readonly 写在洞的外面)。
- **最小验证**:

```ts
type ElementOf<T extends readonly unknown[]> = T extends readonly (infer E)[] ? E : never
type A = ElementOf<readonly number[]>        // number
type Unwrap<T> = T extends Promise<infer V> ? V : never
type B = Unwrap<Promise<Promise<string>>>    // Promise<string>—— 只剥一层
type FirstParam<T> = T extends (first: infer F, ...rest: never[]) => unknown ? F : never
type C = FirstParam<() => void>              // unknown —— 无参函数洞填成 unknown(Day 19 边界)
type Split<S> = S extends `${infer Head}_${infer Tail}` ? `${Head}${Capitalize<Tail>}` : S
type D = Split<'user_name'>                  // 'userName'(最短匹配,第一个下划线处拆)
```

- **自查**:模式对不上走了 else 分支 → hover 检查输入的 readonly/元组形状和模式是否一致;`[0]` 索引访问拿到 `| undefined`(noUncheckedIndexedAccess)→ 改用模式匹配,不是索引访问(Day 19 FirstParamOf 的陷阱)。

### 主题 13:递归类型(DeepPartial / DeepReadonly / Path)

- **现象**:递归类型不终止或结果不对;`DeepReadonly` 后数组还能 push;DeepPartial 把原始值也搞坏了。
- **常见原因**:没有按"数组 / 对象 / 原始值"三分支处理(Day 23 骨架);数组被当对象映射(方法还在,push 可用);`children?: T[]` 的可选分支没处理 undefined。
- **最小验证**:

```ts
type DeepReadonly<T> = T extends (infer E)[] ? readonly E[] : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T
// 数组分支必须产出 readonly E[](不是递归映射数组对象——那样 push 依然可用,Day 23 @ts-expect-error 会挂)
type DeepPartial<T> = T extends (infer E)[] ? DeepPartial<E>[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T
// 注意:DeepReadonly 的数组是 readonly E[],DeepPartial 的是可变数组 —— 语义本该不同
// 自引用合法:type Node = { children?: Node[] } —— 经过对象/数组包装就不是无限展开
```

- **自查**:递归类型输出异常 → 先检查数组分支;`Path<T>` 类推导为空 → children 必须是**元组**(`FileTreeNode[]` 丢元素信息,枚举不出来)。

### 主题 14:协变与逆变(参数方向)

- **现象**:handler 要求多余字段报错(Day 11:参数逆变);`(...args: never[]) => unknown` 能收下任意函数(Day 19);存储异构 handler 必须用一次 as(Day 11/14 死结)。
- **常见原因**:函数参数是**逆变**的——`(p: { title: string; code: number }) => void` 不能当 `(p: { title: string; message: string }) => void` 用(要求的参数更具体 = 收不下更少的载荷);`never[]` 在参数位是万能约束(never 是所有类型的子类型,任何参数元组都能赋给它)。
- **最小验证**:

```ts
type Handler = (p: { title: string; message: string }) => void
const h: Handler = (p: { title: string; message: string; code: number }) => p.code
// 报错:handler 要求的参数比事件载荷更具体(逆变)—— 收到的载荷可能没有 code

declare function callFn<T extends (...args: never[]) => unknown>(f: T): T
callFn((q: string, page: number) => 1)  // OK:never[] 万能收下
```

- **自查**:handler/回调参数不匹配 → 检查要求方向(参数只能要求**更少**,返回只能给**更多**);异构存储统一调用 → 类型系统无解,一处 as + `TODO(reason)` 注释(Day 11 的死结是结构性的,不是你菜)。

### 主题 15:unknown vs any(守卫是一切的门)

- **现象**:外部数据当 any 用一时爽;`u.foo` 报 18046;catch 的 e 用不了。
- **常见原因**:any 关掉检查器(错误不再冒出来,`a.foo.bar()` 静默通过,Day 30 Q7),unknown 逼你收窄(Q6);JSON.parse 返回 any 要立刻 `: unknown` 标注。
- **最小验证**:

```ts
const parsed: unknown = JSON.parse(raw)   // 立刻标注,别让 any 流动
// 三件套:
typeof v === 'string'      // 原始值
'data' in frame            // 对象形状(无判别符的联合,Day 3 LegacyFrame)
v instanceof Date          // 原型链(子类在前!Error < SyntaxError 判断顺序反了全错)
// 自定义谓词(Day 4):T 的唯一推断锚点在谓词里
function isChatDraft(v: unknown): v is ChatDraft { /* 逐字段诚实 */ }
// is 是"声明即真相"——TS 不检查守卫实现撒没撒谎,所以必须逐字段写诚实
```

- **自查**:想写 as → 先问"数据从哪来"(外部 = 守卫);守卫里漏字段 → 回去补,守卫是唯一"人写类型、编译器照单全收"的位置。

### 主题 16:函数重载(参数组合 → 返回类型)

- **现象**:想让"传 draft + to:'sending' 得到精确返回类型";泛型做不到的组合约束。
- **常见原因**:泛型条件类型挂起(主题 4);重载才是"参数组合一一对应"的语言机制(Day 10 提示:"你在业务代码里见过,只是没往类型上想")。
- **最小验证**:

```ts
function transition(s: Draft, e: { to: 'sending'; requestId: string }): SendingMessage
function transition(s: Sending, e: { to: 'sent'; messageId: string; sentAt: string } | { to: 'failed'; reason: string }): SentMessage | FailedMessage
function transition(s: object, e: object): never { throw new Error('非法转移') }  // 实现签名
// 非法组合(sent → sending):2769,每条重载都不匹配 —— 类型层拒绝
```

- **自查**:重载列表从具体到宽泛;实现签名在最下面且**紧跟声明**(隔开报 TS2391);调用报 2769 → 逐条读报错里列出的失败原因。

### 主题 17:模板字面量类型(字符串即类型)

- **现象**:`Capitalize<string>` 没效果;转换类型推不出来;`'tag:'` 前缀匹配失败。
- **常见原因**:四个内置工具(Uppercase/Lowercase/Capitalize/Uncapitalize)**只对字面量生效**,对宽 string 无能为力(Day 22);模板里的 `${string}` 是通配且按**最短匹配**锚定。
- **最小验证**:

```ts
type A = Capitalize<string>              // string —— 没变化,对宽类型无能为力
type B = `on${Capitalize<'click'>}`      // 'onClick'
type C = '/users/:id' extends `${string}:${infer P}` ? P : never  // 'id'
type D = '/users/:uid/posts/:pid' extends `${string}:${infer P}` ? P : never
// D = 'uid/posts/:pid' —— 最短匹配,拿到第一个 : 之后的整段尾巴(Day 22 先猜后验)
// 要逐段提取必须递归 split(Day 23 Path 的思路)
```

- **自查**:转换工具没效果 → 输入被拓宽成 string 了,回源头保字面量;infer 拿多了 → 最短匹配行为,加字面量锚点(`/` 等)分段。

### 主题 18:interface vs type / 镜像映射内联

- **现象**:interface 传不进 `E extends Record<string, unknown>` 约束(Day 11 反例);反向推导(reverse mapped type)失效,泛型推成宽类型(Day 12)。
- **常见原因**:interface **没有隐式索引签名**(不可渐进索引),type 别名有;镜像映射 `{ [K in keyof G]: (state: S) => G[K] }` 必须**直接内联在参数类型里**,先定义成接口再引用会隔断推导(Day 12 明确提示)。
- **最小验证**:

```ts
interface IEvents { ping: number }
type TEvents = { ping: number }
declare function createBus<E extends Record<string, unknown>>(): void
createBus<TEvents>()   // OK:type 有隐式索引签名
createBus<IEvents>()   // 2344:interface 不满足约束 —— 事件表必须用 type

// 镜像映射(Day 12 defineStore 的地基):内联才反得动
declare function defineStore<S, G>(opts: {
  state: () => S
  getters: { [K in keyof G]: (state: S) => G[K] }  // 从实参反推 G
}): Store<S, G>
```

- **自查**:约束报 2344 且实参是 interface → 换 type;镜像映射推不动 → 检查是否内联在参数位。

### 主题 19:noUncheckedIndexedAccess(索引访问永远带 undefined)

- **现象**:`arr[0].x` 报 2532;查表 `TRANSITIONS[from]` 是 `T | undefined`;`find` 返回带 undefined。
- **常见原因**:开了这个开关,一切**索引访问**都自动加 `| undefined`——它假设键可能越界。
- **最小验证**:

```ts
const arr: string[] = ['a']
arr[0].toUpperCase()   // 2532
if (arr[0] !== undefined) arr[0].toUpperCase()  // OK

const table: { [K in 'draft' | 'sent']: string[] } = { draft: ['sending'], sent: [] }
const next = table['draft']  // string[] | undefined
// Day 10 的"窄存储宽读取":存窄(精确键),读时处理 undefined
```

- **自查**:所有索引访问先想"可能 undefined 吗";守卫里遍历数组元素也要一并挡掉 undefined(Day 28 isTodoArray 提示)。

---

## 第三部分:通用排错方法论

### 1. 读报错的三步法

1. **定位位置**:报错点是赋值(2322 族)、实参(2345/2554)、字面量属性(2353)还是泛型约束(2344)?位置决定排查入口。
2. **对比期望与实际的第一个分叉点**:报错通常层层嵌套("Types of property 'x' are incompatible. Type 'A' is not assignable to 'B'"),**从最外层往下读,找到第一个不一样的属性**——分叉点之前的层级都是对的,不用看。
3. **看差异的类型**:宽 vs 窄(拓宽问题)/ unknown(推断失败或边界数据)/ never(收窄过头或漏分支)/ 交集结果(Omit 联合陷阱)。每一种对应第二部分的一个主题。

### 2. 探针手法:逼 tsc 交代推断结果(本仓库验证过的最有用技巧)

Day 2 的四轮探针就是这么定位 E=unknown 的。想知道"这里到底推出了什么",写一行**必然报错**的赋值,报错信息会把实际类型完整吐出来:

```ts
const probe: '不许动' = someValue
// 报错:Type 'X' is not assignable to type '"不许动"'
// X 就是 someValue 的真实类型 —— 比逐层 hover 快
```

变体:类型位置用 `expectTypeOf<实际>()` 对照;`@ts-expect-error` 下一行改一改,看指令还压不压得住(压不住 = 类型变了)。

### 3. hover 逐步拆解复合类型

复合类型(`Omit<Pick<A, B>, C>`、条件类型嵌套)看不懂时:**从最内层开始,一层一层 hover**。把中间结果起个别名,让每层都可观察:

```ts
type Step1 = Pick<ChipMeta, 'id' | 'description'>   // hover 看
type Step2 = Omit<Step1, 'id'>                       // hover 看
// 而不是一口气写 Omit<Pick<...>, ...> 再猜哪层错了
```

### 4. 二分定位:拆小类型别名

一个 50 行的类型别名红了不知道哪行错 → 注释掉一半(或拆成两个别名),看错误是否消失;递归类型同理,先写一层版本跑通再递归(Day 23 的建议节奏)。

### 5. 结构对比法(Expected X, got Y)

拿期望和实际**逐字段对齐**写在一起,差异肉眼可见:

```ts
type Expected = { ok: true; data: Paged<Conversation> }
type Actual   = { ok: boolean; data: Paged<Conversation> | undefined }
//                              ↑ ok 拓宽了    ↑ 多了 undefined —— 两个根因
```

### 6. 让测试替你判卷

- 本仓库 vitest 开了 typecheck 模式:`expectTypeOf` 断言不匹配 = 用例直接红(Day 27/30 全靠这个判卷)。
- `@ts-expect-error` 是**回归探针**:修好实现后如果它报 2578(落空),说明类型行为变了——要么实现错了,要么类型建模变弱了(Day 1/2 的真实教训)。

### 7. 离线还能查什么

- **内置工具类型的源码**就在本地:`node_modules/typescript/lib/lib.es5.d.ts`(Partial/ReturnType/Record 的定义都在里面,读它们是最快的学习方式)。
- 本仓库 `tsconfig.json` 的严格开关清单(手册开头)——判断"这个错误在我这会不会出现"。
- `pnpm typecheck` 全量红屏时,先按文件分组,从**被依赖最多**的文件修起(solution.ts 通常不依赖别人,先修它)。
- 命令行单文件检查:`pnpm exec tsc --noEmit src/dayXX/solution.ts`(不带 tsconfig 的 include 过滤,快速看单文件)。

---

> 最后一条,来自 Day 2 的一句话带走:
> **判别联合拆得越细,运行时兜底越少——看到自己写 `?.` 和 `??`,先怀疑类型建模;
> 测试全绿只说明采到的点对了,不说明实现对了。**
