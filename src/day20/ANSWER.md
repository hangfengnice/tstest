# Day 20 — 参考答案 + 点评要点

> 使用规则：自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案"，是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下实现**已通过本 day 全部验收测试**（vitest 24/24 双通道全绿，运行时 + 类型检查）+
`pnpm typecheck`（day20 的 23 个骨架期错误全部消失，无新增）。
文中的错误码和"裸参数版会得到什么"全部经过本机 TS 5.6 + strict 实测。

---

## 一、参考实现

（业务数据 OrderStatus / FilterValue 骨架已给，此处省略。）

```ts
/**
 * 给联合的每个成员打类型标签(渲染层按标签选控件)。
 *
 * **为什么 TypeName<'a' | 1> 拿到两个标签而不是一个?**
 * ('a' | 1) **整体** extends string 不成立(1 不是 string)—— 不分布的话只会得到一个 else 标签。
 * 但条件类型遇到**裸类型参数**(T 直接在 extends 左边)会把联合拆开逐个判断:
 * 'a' extends string → 'string',1 extends number → 'number',再合并成联合。
 * 这就是分布式的直接证据:**问题不是"整体像不像",而是"每个成员各自像不像"**。
 * (对照实验 Probe1/Probe2:T extends string 分布,[T] extends [string] 不分布 —— 详见 IsText。)
 *
 * @example
 *   TypeName<FilterValue>  // 'string' | 'number' | 'boolean' | 'null' | 'undefined'
 *   TypeName<'a' | 1>      // 'string' | 'number'
 *   TypeName<never>        // never(空联合短路,见 IsText 的解释)
 */
export type TypeName<T> = T extends string
  ? 'string'
  : T extends number
    ? 'number'
    : T extends boolean
      ? 'boolean'
      : T extends null
        ? 'null'
        : T extends undefined
          ? 'undefined'
          : never

/**
 * 剔除联合里的 null / undefined(自实现 NonNullable)。
 *
 * **null 和 undefined 这两个成员去哪了?**
 * 它们在 true 分支里变成了 `never`。而 never 在联合里会被**吸收**:
 * 'string' | never = 'string'(空类型并进任何联合都不留痕迹)。
 * 分布 + true 分支给 never + 联合吸收 never,三件事拼起来就是"从联合里删成员"——
 * 这是下一题 ExcludeOwn 的钥匙,也是昨天 `UnwrapPromise<never> = never` 的另一半答案。
 *
 * @example
 *   DropEmpty<string | null | undefined>  // string
 *   DropEmpty<FilterValue>                // string | number | boolean
 */
export type DropEmpty<T> = T extends null | undefined ? never : T

/**
 * 从联合 T 里剔除所有可赋给 U 的成员(自实现 Exclude)。
 *
 * **它和 DropEmpty 是不是只差"判断条件"?**
 * 是。DropEmpty = `T extends null | undefined ? never : T`,
 * ExcludeOwn = `T extends U ? never : T` —— 把"判断什么"参数化成 U 而已。
 * DropEmpty 是 ExcludeOwn 在 `U = null | undefined` 时的特例:
 * `ExcludeOwn<FilterValue, null | undefined>` 和 DropEmpty 结果一模一样。
 * 内置 NonNullable / Exclude 的关系也是如此 —— **"删成员"是一个通用操作,
 * 区别只是删除条件**。
 *
 * @example
 *   ExcludeOwn<'view' | 'edit' | 'delete', 'edit' | 'delete'>  // 'view'
 *   ExcludeOwn<OrderStatus, 'cancelled'>                      // 剩四个状态
 */
export type ExcludeOwn<T, U> = T extends U ? never : T

/**
 * 元组去头:第一个元素任意,剩下的全收进洞。
 *
 * 规格:
 *   Tail<[1, 2, 3]>          // [2, 3]
 *   Tail<[]>                 // [](空元组匹配不了"至少一个元素"的模式,走 else)
 *   Tail<string[]>           // [](普通数组不是元组,走 else)
 *   Tail<readonly ['a','b']> // ['b'](readonly 写在模式的洞外面 —— Day 19 的教训)
 *
 * @example
 *   type Cmd = ['sort', 'createdAt', 'desc']
 *   Tail<Cmd>  // ['createdAt', 'desc'] —— 指令的"参数部分"
 */
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest]
  ? Rest
  : []

/**
 * 状态联合批量变成徽章对象联合。
 *
 * **true 分支里为什么直接用 T 就行?**
 * 分布式已经保证走到 true 分支时 T 是**单个成员**(联合被拆开逐个进来),
 * 此刻的 T 就是那个字面量,不需要任何"取成员"操作 —— 拿来即用。
 * 这是分布式最舒服的用法:**把"逐个加工"的循环交给类型系统,分支里只写单个的加工逻辑**。
 *
 * @example
 *   StatusBadge<'pending' | 'paid'>  // { status: 'pending' } | { status: 'paid' }
 */
export type StatusBadge<T extends string> = T extends string ? { status: T } : never

/**
 * 元组去头的运行时实现。
 * 签名设计:泛型 T 约束到 readonly unknown[](元组都满足),
 * 返回类型用 Tail<T> —— 类型和运行时是同一个"去头"语义的两层表达。
 *
 * @example
 *   tail([1, 2, 3])  // [2, 3]
 *   tail([])         // [](空数组安全)
 */
export function tail<T extends readonly unknown[]>(tuple: T): Tail<T> {
  // 唯一一处 as(题面允许):slice 是数组方法,它的签名只知道"某种数组的元素",
  // 返回类型按最宽的 unknown[] 推导 —— 它不会做"去掉第一个元素"的元组运算,
  // 那是类型层 Tail<T> 的职责。运行时形状与 Tail<T> 语义恰好一致,由这里背书。
  return tuple.slice(1) as Tail<T>
}

/**
 * 整体判断"是不是纯文本筛选值"(**阻止分布**)。
 *
 * 对照实验(README 预备知识):
 *   Probe1<T> = T extends string ? 'str' : 'other'      → 分布
 *   Probe2<T> = [T] extends [string] ? 'str' : 'other'  → 不分布
 *
 * **三个思考题的回答:**
 *
 * 1. **裸参数版 IsText<'a' | 1> 为什么得到 boolean 而不是 false?**
 *    分布式把联合拆开:'a' extends string → true;1 extends string → false;
 *    合并 true | false。布尔联合 true|false 就是 boolean(联合会坍缩成宽类型)。
 *    类型在"正确地工作"——只是你要的语义是"整体判断",得让它别分布。
 *
 * 2. **[T] 是怎么阻止分布的?**
 *    分布只发生在**裸类型参数**直接位于 extends 左侧时(T 是"未包装的"类型参数)。
 *    包进元组后,extends 左侧是 [T] 这个具体类型(一元元组),
 *    比较变成"整个元组一次性 assignable 检查":['a'|1] extends [string] 不成立 → false。
 *    元组只是最常用的包装,[T] 之外用 Promise<T>、{ v: T } 包也一样能阻止。
 *
 * 3. **IsText<never> 为什么是 true?**
 *    never 是"空联合":分布式条件类型对空联合**直接短路返回 never**(对空集分配,
 *    结果还是空集 —— 这就是昨天 UnwrapPromise<never> = never 的原因);
 *    而包进元组后 [never] 是一个普通的具体类型(长度 1 的元组,元素类型是 never),
 *    never assignable to string(底类型赋给一切),所以 [never] extends [string] 成立 → true。
 *    "空"在裸参数视角是"什么都没有",在元组视角是"有一个 never 元素的元组" —— 语义完全不同。
 *
 * @example
 *   IsText<string>     // true
 *   IsText<'a' | 'b'>  // true(整体可赋给 string)
 *   IsText<'a' | 1>    // false(混进 number,整体不再是 string)
 *   IsText<never>      // true
 */
export type IsText<T> = [T] extends [string] ? true : false

/**
 * 资源名 → REST 端点(**一个条件类型都不用写**)。
 *
 * **没写条件类型,联合为什么还是被分布了?**
 * 模板字面量类型里的占位符(`${T}`)遇到联合类型,行为和裸类型参数的分布式一样:
 * 拆开逐个代入模板再合并。它不是"分布式条件类型"(没有条件类型参与),
 * 是模板字面量自己的**联合展开规则** —— 天生分布式。
 * Day 22 整天都在用这个规则做字符串变换,今天先混个脸熟。
 *
 * @example
 *   GetEndpoint<'user' | 'order'>  // '/api/user' | '/api/order'
 */
export type GetEndpoint<T extends string> = `/api/${T}`
```

---

## 二、常见错误写法（点评人视角）

### 1. IsText 写成裸参数版（分水岭用例给出 boolean）

❌ `export type IsText<T> = T extends string ? true : false`

现象（实测）：`IsText<'a' | 1>` 是 **`boolean`**（= true | false 的坍缩），
断言 `toEqualTypeOf<false>()` 红；`IsText<never>` 是 `never`，
断言 `toEqualTypeOf<true>()` 也红。
为什么错：分布式在"正确地工作"—— 拆开逐个判断再合并。
你要的语义是"**整体**是不是纯文本"，这不是逐成员问题，是全体问题。

✅ `[T] extends [string] ? true : false` —— 包进元组，消灭分布。

### 2. DropEmpty 写成非分布式版（一个成员都删不掉）

❌ `export type DropEmpty<T> = [T] extends [null | undefined] ? never : T`

现象（实测）：`DropEmpty<string | null | undefined>` 原样返回
`string | null | undefined`（赋给 string 报 TS2322）—— 一个都没删。
为什么错：`[string | null | undefined]` 作为一个元组，
extends `[null | undefined]` 不成立（string 混在里面），整体走 else。
**删成员必须逐个审**（分布），**全体判断必须打包**（[T]）—— 两题的操作正好相反，
这也是今天"一半靠分布、一半消灭分布"的含义。

✅ `T extends null | undefined ? never : T`

### 3. TypeName 的 null 分支写成 `null | undefined` 合并判断

❌ `T extends null | undefined ? 'null' | 'undefined' : never`

现象：`TypeName<FilterValue>` 得到 `'string' | 'number' | 'boolean' | 'null' | 'undefined'`
—— 恰好对？**侥幸**。单测一下 `TypeName<null>`：得到 `'null' | 'undefined'`（两个标签），
而正确答案是 `'null'` 一个。今天测试只喂了 FilterValue 和 'a'|1，
这个写法靠"标签联合碰巧相等"蒙混过关。
为什么错：null 进来时 true 分支给的是标签**联合**，不是 null 自己的标签。

✅ null 和 undefined 各写一个分支（README 提示明说了），单成员进单标签出。

### 4. TypeName 的分支顺序随手排（boolean 放最后之外的位置）

❌ 把 `T extends boolean` 挪到 `T extends string` 之前?没事。真正的坑是:

```ts
T extends string ? 'string'
: T extends number ? 'number'
: ...               // 最后一个分支直接 never,忘了 undefined
```

现象:`TypeName<FilterValue>` 缺 `'undefined'` 标签,断言红。
点评视角:五值联合、五个分支,**用"分支数 = 成员数"自查**;
default 的 never 是给"五种之外"的输入留的,不是给漏写的成员兜底的。

✅ 嵌套条件类型五分支全写,default 给 never。

### 5. ExcludeOwn 的洞打在 U 上（删反了）

❌ `export type ExcludeOwn<T, U> = T extends infer U ? never : T`
或 `U extends T ? never : T`

现象:`ExcludeOwn<'view' | 'edit', 'edit'>` 得 `'view' | 'edit'`(U 分布成 'edit' 判断…)或
干脆不编译。删成员的方向:**拿 T 的每个成员去问"你是不是 U 那边的"**,
是 → 变 never(被吸收),不是 → 保留。U 只站在 extends 右边,永远不分布(U 不是裸参数,
分布只看 extends 左边的裸参数)。

✅ `T extends U ? never : T` —— 一行,和内置 Exclude 逐字符相同。

### 6. Tail 的模式漏了 readonly（readonly 元组进不来）

❌ `T extends [unknown, ...infer Rest] ? Rest : []`

现象:`Tail<readonly ['a', 'b']>` 走 else 得 `[]`,
断言 `toEqualTypeOf<['b']>()` 红。
为什么错:Day 19 的教训在元组上原样重现 —— 可变元组模式配不上 readonly 元组。
readonly 要写在**整个模式的洞外面**:`readonly [unknown, ...infer Rest]`。

✅ `T extends readonly [unknown, ...infer Rest] ? Rest : []`

### 7. Tail 的模式写成 `[any, ...infer Rest]` 或 `[infer First, ...infer Rest]`

❌ `T extends [infer First, ...infer Rest] ? Rest : []`（First 没人用）

现象：测试全绿。
点评视角：两个小毛病 ——
1. 挖一个用不到的洞（First），读者会以为你要用它；第一个元素"任意"用 `unknown`
   表达更直白；
2. `any` 版直接违反本仓库禁令（any 万能匹配 = 放弃检查，虽然这里检查本来就宽松）。
**洞是有语义的：用什么挖洞，就是在声明"我在乎这里的什么"**。

✅ `readonly [unknown, ...infer Rest]` —— 不在乎的位子用 unknown，在乎的才挖洞。

### 8. StatusBadge 直接写 `{ status: T }`（不拆联合）

❌ `export type StatusBadge<T extends string> = { status: T }`

现象：`StatusBadge<'pending' | 'paid'>` 得到
`{ status: 'pending' | 'paid' }` —— **一个"混入对象"**，不是两个对象的联合。
断言红（toEqualTypeOf 对这两种形状严格区分）。
为什么错（值得记住）：`{ status: 'pending' | 'paid' }` 和
`{ status: 'pending' } | { status: 'paid' }` **都是合法建模，但能力不同** ——
前者不能用判别联合收窄（status 是联合，`if (b.status === 'pending')` 后另一个字段
不会跟着锁定），后者可以。"对象联合"是 Vue/Vuex 里 map 状态到组件的常用形状，
判别能力就是它的全部意义。分布式的 true 分支 `{ status: T }` 才能把联合推出去。

✅ `T extends string ? { status: T } : never` —— 条件类型把 T 变成裸参数，
分布拆开，true 分支里 T 是单个字面量。

### 9. StatusBadge 的 true 分支写 `T extends string ? { status: Extract<T, string> }` 之类

❌ 各种"再取一次成员"的花活

现象：多数能编译，部分场景推成宽 string。
点评视角：README 提示已经说了 —— **分布式保证此刻 T 是单个成员**，
true 分支里 T 就是那个字面量，直接用。多一层 Extract 是没理解"循环变量"已经
替你做好了，反而把字面量洗掉。

✅ true 分支裸用 T。

### 10. GetEndpoint 不写约束

❌ `export type GetEndpoint<T> = \`/api/${T}\``

现象（实测）：`error TS2322: Type 'T' is not assignable to type
'string | number | bigint | boolean | null | undefined'` —— 模板占位符只收这些,
无约束 T 的上界是 unknown,直接报错。
为什么错:占位符有"可代入物"白名单;约束 `T extends string` 一石二鸟:
编译过 + `GetEndpoint<123>` 被 @ts-expect-error 精准命中(约束拦截)。

✅ `export type GetEndpoint<T extends string> = \`/api/${T}\``

### 11. tail 的返回类型手写元组

❌ `return tuple.slice(1) as T2` 里先算好 `[2, 3]` 之类的具体类型,
或返回类型写 `T`（原样返回?）

现象：`Tail<T>` 已经是现成的类型层答案，手写等于把类型层重抄一遍;
写 `T` 更是语义错误（没去头）。
点评视角：这题类型层（Tail）和运行时（slice）是**同一语义的两层表达**，
返回类型引用 Tail<T> 就是"两层对齐"的声明 —— tail 的类型不需要读者去读实现。

✅ `function tail<T extends readonly unknown[]>(tuple: T): Tail<T>` + slice + 一处 as。
as 的注释要点（参考实现）：slice 的签名只知道"某种数组"，返回按最宽的元素数组推导，
它不做元组运算；元组运算是 Tail<T> 的职责，运行时形状与语义一致由这一处背书。

---

## 三、思考题参考答案

README 的思考题都在参考实现的 JSDoc 里，这里给浓缩版：

### TypeName<'a' | 1> 为什么拿到两个标签？

('a' | 1) 整体 extends string 不成立（1 拖后腿）。但裸类型参数触发分布：
拆成 'a' 和 1 各自判断，'a' → 'string'，1 → 'number'，合并。
**分布式把"整体比较"变成"逐成员比较"** —— 这正是"按类型选控件"想要的语义。

### DropEmpty 里 null / undefined 去哪了？

true 分支给了 never，never 在联合中被吸收（X | never = X）。
"删成员 = 分布逐个判断 + 不想要的给 never + 联合自动吸收" —— Exclude 的全部原理。
昨天 `UnwrapPromise<never> = never` 是同一枚硬币的另一面：never 进分布 = 空集分配 = never。

### ExcludeOwn 和 DropEmpty 只差判断条件吗？

是：`T extends U ? never : T` vs `T extends null | undefined ? never : T`。
U 是参数化后的"删除条件"。NonNullable 是 Exclude 在 U = null | undefined 的特例。
**先认出通用操作，再看出特例** —— 内置工具类型就这么几个原型。

### IsText 三问（浓缩）

1. 裸参数版拆开逐判：'a'→true，1→false，合并 true|false 坍缩成 boolean（实测确认）。
2. 分布只认 extends 左边的**裸**类型参数；[T] 让左边变成具体元组类型，整体一次比。
3. never 是空联合，分布对空集短路返回 never；[never] 是具体的一元元组，
   never assignable to string → true。"空"在两个视角下是两种东西。

### GetEndpoint 没写条件类型，联合为什么还分布？

模板字面量的占位符有自己的联合展开规则（和分布式行为一致但机制独立）：
占位符遇到联合，逐个代入模板再合并。这是 Day 22 字符串变换的地基 ——
**今天用条件类型分布"加工类型"，明天用模板分布"加工字符串"**。

---

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错，`npx vitest run src/day20` 全绿（24/24 双通道）
- [ ] 零 any；唯一一处 as 在 tail 里，注释解释了"slice 收不窄"的原因
- [ ] 所有 export 有 JSDoc + @example
- [ ] Probe1/Probe2 的对照结论写进了 TypeName 或 IsText 的 JSDoc
- [ ] TypeName 的 null / undefined 是两个独立分支（想想 `TypeName<null>` 的正确输出）
- [ ] DropEmpty 是分布式版，IsText 是 [T] 版 —— 两个方向没有搞反
- [ ] Tail 的模式是 `readonly [unknown, ...infer Rest]`（readonly 在洞外）
- [ ] StatusBadge 是"对象联合"而不是"混入对象"（判别收窄能力不同）
- [ ] IsText 三个思考题的回答完整（boolean 坍缩 / [T] 阻止分布 / never 的两副面孔）
- [ ] GetEndpoint 一个条件类型都没写，约束是 `T extends string`
- [ ] 测试里的 `@ts-expect-error` 反例全部精准命中（没有 TS2578 unused）
- [ ] 额外自查：把你的 DropEmpty 改成 [T] 版跑一次测试，再看第 2 条 —— "删成员"和"全体判断"的方向感建立了吗？
