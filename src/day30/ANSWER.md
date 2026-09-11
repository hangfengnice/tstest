# Day 30 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。
> 今天尤其如此:**测试只判 14 个答案类型,判不了你注释里的"为什么"** —— 第三节才是复盘的重点,逐题过。

## 一、参考实现

已通过本 day 全部验收测试:运行时 + 类型断言 15/15(Q13 运行时断言在内),vitest typecheck 模式 15/15,`pnpm typecheck` 中 day30 错误清零(含骨架期 3 个 TS6133 未使用类型参数)。

```ts
/**
 * Day 30 — 总复盘:30 天核心考点自查
 */

// =============================================================
// 🟢 快问快答
// =============================================================

/**
 * Q1:判别联合收窄 —— shape.kind === 'circle' 内访问 shape.r 能编译吗?
 * 解释:能。kind 是字面量判别符,=== 比较把联合收窄到 circle 分支,
 * 分支上的 r 是必有字段 —— 判别联合的收窄是控制流分析的标准能力。
 *
 * @example
 *   type Answer = Q1 // true
 */
export type Q1 = true

/**
 * Q2:宽 string 判别符 —— const _exhaustive: never = shape 还能通过编译吗?
 * 解释:不能。kind: string 时两个 case 都收窄不了联合,default 分支里
 * shape 仍是完整类型,string 不能赋给 never —— 穷尽检查随之失效,
 * 这正是"判别符必须字面量"的终极理由。
 *
 * @example
 *   type Answer = Q2 // false
 */
export type Q2 = false

/**
 * Q3:泛型约束 —— first([42]) 能编译吗(T extends { id: string })?
 * 解释:不能。约束是"调用方实参必须满足的契约",42 的数组不满足
 * { id: string },TS2322 在调用点当场拒绝 —— 约束把错误从函数体内
 * 挪到了调用点。
 *
 * @example
 *   type Answer = Q3 // false
 */
export type Q3 = false

/**
 * Q4:条件类型 + 模板字面量 —— 'todoList' extends `${string}List` ? 1 : 0
 * 解释:是 1。`${string}List` 是模式:string 通配符能匹配 'todo' 这段
 * 前缀(包括空串),所以 'todoList' 匹配成功走 true 分支。
 *
 * @example
 *   type Answer = Q4 // 1
 */
export type Q4 = 1

// =============================================================
// 🟡 判断 + 动手
// =============================================================

/**
 * Q5(动手):Unwrap<T> —— Promise 挖一层;不是 Promise 给 never。
 * 解释(为什么只挖一层):`Promise<infer U>` 的 infer U 只捕获**直接**
 * 参数位上的类型 —— 嵌套的 Promise<string> 作为整体被捕获为 U,
 * 不会再递归拆下去;想挖到底要写递归条件类型(Awaited 的原理)。
 *
 * @example
 *   Unwrap<Promise<number>>          // => number
 *   Unwrap<Promise<Promise<string>>> // => Promise<string>(只挖一层)
 *   Unwrap<string>                   // => never
 */
export type Unwrap<T> = T extends Promise<infer U> ? U : never

/**
 * Q6:unknown —— u.foo 会编译报错吗?
 * 解释:会(TS18046/TS2571)。unknown 是"类型安全的不知道":在收窄
 * 之前,任何属性访问、调用都被禁止 —— 它把不确定性显式地摆在你面前,
 * 逼你先 narrow 再用。
 *
 * @example
 *   type Answer = Q6 // true = 会报错
 */
export type Q6 = true

/**
 * Q7:any —— a.foo.bar() 会编译报错吗?
 * 解释:不会。any 直接关闭检查器:属性访问、链式调用、任意赋值
 * 全部放行(连带把周围的类型推断也污染成 any)。和 Q6 对照:
 * 同样"存不下类型信息",unknown 是拒绝服务,any 是放弃监管。
 *
 * @example
 *   type Answer = Q7 // false = 不报错
 */
export type Q7 = false

/**
 * Q8(动手):MyPartial<T> —— 不用内置 Partial,可选化所有属性。
 * 解释(映射类型的 ? 修饰符):映射类型除了重排键值,还能改**属性修饰符** ——
 * `?` 加上可选、`-?` 去掉可选、readonly 同理(+readonly / -readonly)。
 * 同态映射(键来自 keyof T)会保留原类型的修饰符,`?` 叠加即得可选化。
 *
 * @example
 *   MyPartial<{ id: string; done: boolean }> // => { id?: string; done?: boolean }
 */
export type MyPartial<T> = {
  [K in keyof T]?: T[K]
}

// =============================================================
// 🔴 边界
// =============================================================

/**
 * Q9(动手):Greet<S> —— 加 hello- 前缀的模板字面量类型。
 * 解释:S 出现在模板字面量的拼接位上,TS 把每个字面量成员代入求值;
 * 约束 S extends string 是必须的 —— 非字符串类型没法进模板。
 *
 * @example
 *   Greet<'todo'>  // => 'hello-todo'
 *   Greet<'day30'> // => 'hello-day30'
 */
export type Greet<S extends string> = `hello-${S}`

/**
 * Q10:keyof ({ a; b } & { b; c }) = ?
 * 解释:'a' | 'b' | 'c'。交叉类型是"同时是两者",能访问的键是两边
 * 键的**并集**;对比 keyof 联合 = 各成员键的**交集**(Q14 的坑)——
 * 一并一交,方向相反,这是 keyof 两副面孔。
 *
 * @example
 *   type Answer = Q10 // 'a' | 'b' | 'c'
 */
export type Q10 = 'a' | 'b' | 'c'

/**
 * Q11:as const + satisfies 能让 cfg.port 是字面量 3000 且整体通过校验吗?
 * 解释:能。`as const` 先把对象窄化成 { readonly port: 3000 },
 * `satisfies` 再拿这个窄类型去对照 Record<string, number> —— 校验通过
 * 但**不替换**推断类型,port 仍是 3000。写成类型注解则相反:
 * 注解把推断类型顶替成 number。satisfies = 校验而不丢字面量。
 *
 * @example
 *   const cfg = { port: 3000 } as const satisfies Record<string, number>
 *   typeof cfg.port // 3000(不是 number)
 */
export type Q11 = true

/**
 * Q12:typeof (['a','b'] as const) = ?
 * 解释:readonly ['a', 'b']。as const 冻结三层:数组变 readonly 元组、
 * 元素变字面量类型、对象属性变 readonly —— 数组那层从 string[] 收成
 * 具体长度的元组是最容易被忽略的一层。
 *
 * @example
 *   type Answer = Q12 // readonly ['a', 'b']
 */
export type Q12 = readonly ['a', 'b']

/**
 * Q13(动手):unknown 的类型守卫 —— 判断"纯数字数组"。
 * 解释(predicate 收窄的原理):返回类型 `value is number[]` 是给
 * 控制流分析的"承诺" —— 函数返回 true 的分支里,编译器把 value 的
 * 类型替换为谓词里的类型。承诺本身不校验,所以**函数体的每个 return
 * 都必须真的兑现它**,守卫是运行时校验和类型系统的唯一合法接头。
 *
 * @example
 *   isNumberList([1, 2])   // => true
 *   isNumberList([1, '2']) // => false
 */
export function isNumberList(value: unknown): value is number[] {
  // Array.isArray 先排掉非数组;every 逐元素 typeof —— 混进任何
  // 非数字(字符串/null/嵌套数组)都返回 false;空数组 vacuously true
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

/**
 * Q14:Omit<Cat | Dog, 'id'> 是 { meow } | { bark } 的联合吗?
 * 解释:不是。Omit 不分发:它先对联合取 keyof,而 keyof 联合 =
 * 各成员键的交集,只剩 'id';把 'id' Omit 掉后两边都什么都不剩,
 * 结果是两个近似空类型的联合。想要按分支 Omit,先分发再 Omit
 * (比如用分布式条件类型包一层)。
 *
 * @example
 *   type Answer = Q14 // false
 */
export type Q14 = false
```

## 二、常见错误写法(点评人视角)

按题号列"经典错答 + 为什么错"。答对但解释写不出来的,回到第三节补课。

### Q1 — 错答 false("要自己写守卫才行")

不需要。**字面量判别符 + `===` 是内建收窄**,控制流分析直接把联合切到对应分支;自定义守卫是给"判别符收窄不了"的场合准备的(比如 Day 28 的 unknown 逐字段校验)。

### Q2 — 错答 true("never 检查万能")

never 穷尽检查生效的前提是:**每个 case 都真的收窄掉了联合的一部分**。`kind: string` 时 case 'circle' / 'square' 只是"值可能相等"的比较,类型不为之所动,default 分支里 shape 还是原类型 → 赋给 never 报错。这一题和 Q1 是同一枚硬币的两面:**收窄能力来自字面量,不来自 switch 本身**。

### Q3 — 错答 true("42 也是值,先传进去再说")

约束在**调用点**检查:`first([42])` 里推断 T = number,不满足 `T extends { id: string }`,TS2322 当场拒绝。泛型约束的意义就是"把函数对入参的要求写进签名,错误左移到调用方"。

### Q4 — 错答 0

两个典型误解:以为 `${string}` 要匹配"整个剩余部分就不能再有字面量"(错,模式是前缀 `hello-` + 通配),或以为 'todo' 这段非空才匹配(错,`${string}` 连空串都匹配 —— Day 27 的 `'tag:'` 合法就是同一件事)。**模式匹配问的是"能不能切成这个形状",不是"相不相等"**。

### Q5 — 两个坑

```ts
// ❌ 坑 1:忘了 infer,写了个"判断"而不是"捕获"
type Unwrap<T> = T extends Promise<unknown> ? T : never
// Unwrap<Promise<number>> = Promise<number>,测试红

// ❌ 坑 2:直接用内置 Awaited
type Unwrap<T> = Awaited<T>
// Unwrap<Promise<Promise<string>>> = string —— Awaited 会递归挖到底,
// 而 Unwrap 的规格是"只挖一层"(= Promise<string>),测试红
```

坑 2 特别有教学价值:内置 `Awaited` 是**递归**条件类型,`await` 的真实语义;本题要的是"剥一层壳"。规格差一层,实现就差一个递归。

### Q6 / Q7 — 答反

记口诀:**unknown 拒绝服务(报错),any 放弃监管(不报错)**。`u.foo` 红、`a.foo.bar()` 绿 —— 同样"类型信息缺失",一个逼你收窄,一个替你签字。工程结论:入口处收 `unknown`,永远不写 `any`(过渡期必须写就紧跟 TODO 注释)。

### Q8 — 用 `| undefined` 冒充可选

```ts
// ❌
type MyPartial<T> = { [K in keyof T]: T[K] | undefined }
```

现象:类型断言红。`{ id: string | undefined }` 和 `{ id?: string }` 是**两个类型**:前者"键必须存在,值可空",后者"键可以不出现"。可选是**修饰符**(`?`),不是类型的联合成员 —— 这正是 exactOptionalPropertyTypes 严格区分的两件事(Day 27/28 的 tags 连续踩了三天)。

### Q9 — 忘了 `extends string`

```ts
// ❌
type Greet<S> = `hello-${S}`
// error TS2322: Type 'S' is not assignable to type 'string | number | bigint | boolean | null | undefined'
```

模板字面量的插值位只收字符串系基本类型;S 是"任何可能的类型",先 `S extends string` 把它按在字符串域里。和 Day 26/27 的 `K & string` 是同一课:**进模板/进 Capitalize,先证明你是 string**。

### Q10 — 错答 'b'

把 keyof 交叉记成了"公共键"。方向反了:**keyof 交叉 = 并集**(同时是两种类型,两边的键都可用),**keyof 联合 = 交集**(得对每个成员都安全,只有公共键可用)。一并一交,Q10 和 Q14 互为镜像 —— 这对题放在一起记,一辈子忘不掉。

### Q11 — 错答 false

误以为 satisfies 和类型注解一样会"顶替"推断类型。三件套分清:
- `const x: T = expr` —— 校验 + **顶替**(x 的类型是 T)
- `const x = expr satisfies T` —— 只校验,**保留** expr 的推断类型
- `as const` —— 把推断类型收窄到字面量/readonly

`as const satisfies T` = 先收窄、再校验、不顶替 —— 既要字面量又要契约检查的标准姿势(配置对象、事件表、路由表的常驻嘉宾)。

### Q12 — 丢 readonly 或丢元组

错答 `['a', 'b']`(忘了 as const 连数组一起冻)或 `readonly string[]`(冻了可变丢了具体长度)。`as const` 对数组做两件事:**readonly + 定长元组 + 元素字面量化**,三件一个都不能少写。

### Q13 — 守卫漏防线

漏 `Array.isArray` → `isNumberList('x')` 对字符串调 every 直接炸;漏逐元素 typeof → `[1, '2']` 混进来。守卫的每个 return 都在给 `value is number[]` 这个承诺作保 —— **谓词是支票,函数体是保证金**。另外测试里 `[[1]]`、`{}`、`null` 各占一条:嵌套数组 typeof 是 'object' 被拒,对象不是数组被拒,null 被 Array.isArray 拒 —— 一条防线对应一类入侵,数一数你的版本少了几条。

### Q14 — 错答 true(本题的"标准陷阱")

Omit 是"先用 keyof 取键、再映射"两步,**作用在联合上时两步都不分发**。keyof Cat | Dog = 'id'(交集),Omit 掉 'id' 后什么都不剩 —— `{ meow } | { bark }` 是"想象中的分发",实际结果是两个空壳的联合。要对联合按分支 Omit,自己包一层分布式条件类型:`type DistributedOmit<T, K> = T extends unknown ? Omit<T, K> : never`(Day 2 的坑,30 天后的今天应该已经条件反射了)。

## 三、思考题参考答案(逐题"为什么"——人工判卷的替代)

**Q1 为什么:** 判别联合的收窄不需要任何用户侧代码:字面量判别符 + `===`/`switch`/`in` 都是控制流分析的原生输入。这是整个"可辨识联合"模式的回报 —— 前提只有一个:判别符是**字面量类型**。

**Q2 为什么:** 穷尽检查的原理是"default 分支里剩余的类型应该是 never"。宽 string 判别符下每个 case 都切不掉联合,default 里 shape 还是原类型,`never` 赋值报错 —— 检查失效不是报错消失了,是**这个检查从此保护不了你**。加第三种状态时,宽判别符版静默出错,字面量版编译期爆炸。

**Q3 为什么:** 泛型约束 `T extends { id: string }` 把"函数体里要访问 t.id"的需求前移到签名;调用点推断出的 T 不满足就拒绝。对比 any 参数版:`first(42 as never)` 之类的脏数据能一路混进函数体,炸在运行时。

**Q4 为什么:** 条件类型的 extends 两侧可以都是模板字面量,此时它们是**模式**:`${string}List` 表示"任意串 + 字面量 List 结尾"。'todoList' = 'todo' + 'List',匹配。这就是 Day 27 `PresetFilter`/`TagName` 能用 `` `tag:${string}` `` 做过滤和拆包的同一机制。

**Q5 为什么只挖一层:** `T extends Promise<infer U>` 的 infer 站在 Promise 的**直接参数位**上,匹配一次、捕获一次,不会对捕获结果继续套用 —— U = Promise<string> 就到此为止。递归拆解需要条件类型引用自身(`Awaited` 内部就是这么写的)。**infer 是"捕获",不是"求值到不动点"**。

**Q6 为什么:** unknown 上访问属性是 TS18046/TS2571 —— unknown 的设计哲学是"诚实的不确定":所有操作先证明类型再谈。它和 any 的区别不是"能不能用",是**谁承担责任**:unknown 把责任留在写代码的人手里,any 把责任推给运行时。

**Q7 为什么:** any 与类型系统的约定是"别管我",属性访问、调用、赋值全绿,而且 any 还会**传染**(与任何类型的运算结果还是 any)。Q6/Q7 放一起:入口边界收 unknown、内部尽快守卫收窄、永远不主动写 any —— 30 天里 Day 4/28/29 反复练的就是这条纪律。

**Q8 为什么:** 同态映射类型 `[K in keyof T]` 逐键复制原类型的值和修饰符;`?` 修饰符叠加把每个键改成可选。修饰符家族:`?` / `-?` / `readonly` / `-readonly` —— Required、Readonly、Partial 三个内置工具全部是这个机制的直线应用。映射类型 = 键的重排 + 值的变换 + 修饰符的编辑,三件事(Day 26/27 的 as 重映射属于第一件)。

**Q9 为什么:** 模板字面量的插值位置收 `string | number | bigint | boolean | null | undefined`,S 无约束时"可能是任何类型",必须 `S extends string` 收进字符串域。泛型参数进任何"有域要求"的位置(模板、Capitalize、索引访问)都要先满足域 —— 这也是 `K & string` 惯用法的来源。

**Q10 为什么:** 交叉类型 A & B 表示"同时是 A 和 B",两边的键都在它身上,所以 keyof (A & B) = keyof A | keyof B(并);联合类型 A | B 表示"要么 A 要么 B",对它安全的键必须两边都有,所以 keyof (A | B) = keyof A & keyof B(交)。一并一交互为对偶。

**Q11 为什么:** `as const satisfies Record<string, number>` 的求值顺序:先 as const 收窄(port: 3000,全 readonly),再拿收窄结果对照 satisfies 右侧校验,校验通过则**保留收窄类型**。对比注解版 `const cfg: Record<string, number> = { port: 3000 }`:注解参与推断,变量类型就是注解类型,port 被宽化成 number。satisfies 存在的意义就是填"既要校验、又要保真"这个空档。

**Q12 为什么:** as const 作用于数组字面量时,类型是"长度固定、元素全字面量、只读"的元组:readonly ['a', 'b']。三件事缺一不可:去掉 readonly 是可变元组,去掉元组是 readonly string[],去掉字面量是普通数组 —— 测试断言的正是完整三件套。

**Q13 为什么:** 谓词 `value is number[]` 是控制流分析的输入:守卫返回 true 的分支里 value 被替换为 number[]。但**编译器不检查函数体是否兑现承诺** —— 写 `return true` 也能编译(然后在所有 false 该出现的地方炸)。所以守卫纪律:每个 return 路径都人工核对"此刻 value 真的是谓词说的那样"。守卫是 unknown 世界里唯一合法的"类型赋予点",Day 28 的 isTodoArray 用 20 行换一个 Todo[],这笔交易的本钱就是逐字段的诚实。

**Q14 为什么:** `Omit<T, K>` 的实现是 `{ [P in Exclude<keyof T, K>]: T[P] }` —— 作用在联合上,第一步 keyof 就塌成交集 'id',第二步把 'id' 排掉,两边都剩空。**Omit/Umit/Pick 这类"基于 keyof 的工具"天生对联合不友好**;要按分支处理,先让条件类型分发:`T extends unknown ? Omit<T, K> : never`。Day 2 踩过的坑,今天应该能一眼识别并顺手写出分发版 —— 这就是 30 天的复利。

## 四、验收自查清单

- [ ] Q1-Q14 类型答案测试全绿,Q13 运行时断言全绿
- [ ] 每题的"为什么"注释都写了一句**自己**的话(不是抄题面)
- [ ] `pnpm typecheck` 中 day30 错误清零
- [ ] 动手题(Q5/Q8/Q9/Q13)没用 as、没用内置 Partial/Awaited 偷懒
- [ ] Q10 和 Q14 能互为镜像地讲清楚(keyof 一并一交)
- [ ] Q11 的 satisfies 三件套(注解 / satisfies / as const)能各举一个使用场景
- [ ] 第三节 14 条"为什么",哪条讲不出来,回对应 Day 补:Q1/Q2/Q3 → Day 1;Q4/Q5/Q9 → Day 21-25(第三阶段);Q6/Q7 → Day 4;Q8 → Day 22 附近;Q10/Q12/Q14 → Day 2;Q11 → 第四阶段;Q13 → Day 28/29
