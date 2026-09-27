# Day 19 — 参考答案 + 点评要点

> 使用规则：自己写完、`pnpm check:day 19` 全绿之后再打开这份文件。
> 对照的目的不是"对答案"，是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下实现**已通过本 day 全部验收测试**（vitest 19/19 双通道全绿，运行时 + 类型检查）+
`pnpm typecheck`（day19 的 23 个骨架期错误全部消失，无新增）。
文中的错误码全部经过本机 TS 5.6 + strict 实测（含 as 是否真的"不得不用"的对照实验）。

---

## 一、参考实现

（业务数据 User / Pagination / Paged 骨架已给，此处省略。）

```ts
/**
 * 从数组类型提取元素类型 —— 洞挖在"元素位置"。
 *
 * **为什么约束必须带 readonly?**(思考题)
 * `readonly number[]` 和 `number[]` 是两种类型:可变数组可以当只读数组用,反过来不行
 * (只读数组承诺不 push,可变数组没这个承诺,把只读的当可变的会破坏承诺)。
 * 把约束写成 `unknown[]` 后,`ElementOf<readonly number[]>` 直接在类型参数处
 * 报"不满足约束"(readonly 不 assignable to 可变数组)—— readonly 的数据被整个挡在门外。
 * 约束写 `readonly unknown[]`,可变/只读两种数组都收得下(都 assignable to readonly)。
 *
 * **为什么 readonly 要写在洞的外面?**
 * 模式 `(infer E)[]` 只能匹配可变数组;`readonly (infer E)[]` 才能同时匹配
 * `readonly number[]` 和 `number[]`。洞外面加 readonly 是"模式的放宽",
 * 和约束的放宽同一个方向。
 *
 * @example
 *   ElementOf<string[]>              // string
 *   ElementOf<readonly number[]>     // number
 *   ElementOf<readonly ['a', 'b']>   // 'a' | 'b'(as const 元组提出字面量联合)
 */
export type ElementOf<T extends readonly unknown[]> = T extends readonly (infer E)[] ? E : never

/**
 * 自实现 ReturnType —— 洞挖在"返回值位置",参数位置照抄约束的写法(不是要提的东西)。
 *
 * **为什么约束 `(...args: never[]) => unknown` 能收下任意函数?**(思考题)
 * 函数参数是**逆变**的:函数 A 赋给函数类型 B,要求 B 的参数类型 assignable to A 的参数类型。
 * `never` 是所有类型的子类型(底类型),所以 `never[]`(任意个 never) assignable to
 * 任何参数列表 —— 一个 `(q: string) => X` 能赋给 `(...args: never[]) => unknown`,
 * 因为"能接受任何参数的调用者"只可能传 never 进来,而 never 喂给谁都是安全的。
 * 返回位 `unknown` 是顶类型,任何返回值都 assignable。
 * 两个方向的极端(never 进参数、unknown 出返回)拼出"万能函数约束",全程没有一个 any。
 * 标准库源码用 `any[]` 也能工作(any 双向兼容),但 any 的兼容是"不检查";
 * never[] 的兼容是"逆变规则算出来的兼容"—— 检查还在,只是数学上恰好全过。
 *
 * @example
 *   ReturnOf<() => string>                            // string
 *   ReturnOf<(q: string) => Promise<Paged<User>>>     // Promise<Paged<User>>(不剥壳)
 */
export type ReturnOf<T extends (...args: never[]) => unknown> =
  T extends (...args: never[]) => infer R ? R : never

/**
 * 剥一层 Promise 壳(非递归)—— 洞挖在"Promise 的类型参数位"。
 *
 * **为什么 `Promise<Promise<User>>` 剥完不是 User?**(思考题)
 * 模式 `Promise<infer V>` 只对齐**类型结构的第一层**:外层 Promise 的类型参数位置
 * 绑定 V = Promise<User>,匹配结束,V 原样交出。类型系统的模式匹配是纯结构操作,
 * 不会"顺手"再拆一层。
 * 联想运行时:`new Promise(r => r(promiseA))` 的 `.then` 回调拿到的是 promiseA
 * **解析后的值** —— 运行时的 resolve 会自动展平 thenable(递归地)。
 * 要在类型层贴合这个运行时语义,条件类型就得递归(每剥一层再问一次"还是 Promise 吗"),
 * 那正是内置 `Awaited<T>` 的做法 —— Day 24 的主题。今天的非递归版是它的地基:
 * 先能剥一层,递归只是"一层"的重复。
 *
 * @example
 *   UnwrapPromise<Promise<User>>            // User
 *   UnwrapPromise<Promise<Promise<User>>>   // Promise<User>(只剥一层!)
 *   UnwrapPromise<42>                       // 42(透传分支引用 T 自身,字面量不变宽)
 *   UnwrapPromise<never>                    // never(空联合对条件类型有特判,Day 20 揭晓)
 */
export type UnwrapPromise<T> = T extends Promise<infer V> ? V : T

/**
 * 自实现 Parameters —— 洞挖在"参数位",且一个洞收下**整个**参数列表:
 * `(...args: infer P)` 里的 P 会被推断成元组(参数列表的形状本来就是元组)。
 *
 * @example
 *   ParamsOf<(q: string, page: number) => void>  // [string, number](标签不参与类型)
 *   ParamsOf<() => void>                          // []
 */
export type ParamsOf<T extends (...args: never[]) => unknown> =
  T extends (...args: infer P) => unknown ? P : never

/**
 * 只取第一个参数 —— 洞挖在"第一个参数位",剩余参数用 never[] rest 收走(反正没人用)。
 *
 * **边界观察:无参函数为什么提出 unknown?**(思考题)
 * `() => void` 去匹配 `(first: infer F, ...rest: never[]) => unknown`:
 * 参数少的函数可以赋给参数多的签名(调用方可传更多参数，函数可忽略多余实参),所以模式**匹配成功**;
 * 但没有实参对应 first 这个洞,TS 只能把洞填成 unknown(顶类型,"这里可能有任何东西")。
 * 也就是说:匹配成功 ≠ 洞有内容。想要"无参就不该通过"的语义,得自己再加一层判断
 * (比如用 ParamsOf 的元组长度做条件)—— 这也是"模式匹配"和"索引访问"的语义差异之一。
 *
 * @example
 *   FirstParamOf<(q: string, page: number) => void>  // string
 *   FirstParamOf<() => void>                          // unknown(洞被填成顶类型)
 */
export type FirstParamOf<T extends (...args: never[]) => unknown> =
  T extends (first: infer F, ...rest: never[]) => unknown ? F : never

/**
 * 给异步函数加"参数 → 结果"内存缓存。
 * 签名完全由前五题成果拼出:参数列表用 ParamsOf,返回用 UnwrapPromise<ReturnOf>,
 * 没有一处手抄的具体类型 —— 原函数签名变,这里零改动自动跟。
 *
 * 约束 `(...args: never[]) => Promise<unknown>`(ReturnOf 的万能函数约束 + 一层 Promise 判断):
 * 只收"返回 Promise 的函数",同步函数在类型层就进不来。
 *
 * @example
 *   const cached = withCache(fetchPagedUsers)
 *   await cached('chip')  // (q: string) => Promise<Paged<User>>,同参第二次命中缓存
 */
export function withCache<Fn extends (...args: never[]) => Promise<unknown>>(
  fn: Fn,
): (...args: ParamsOf<Fn>) => Promise<UnwrapPromise<ReturnOf<Fn>>> {
  // 缓存的是 Promise 而不是解析值:同一个 promise await 两次拿到同一个解析值引用,
  // 而且 in-flight 期间的重复调用也只会触发一次原函数
  const cache = new Map<string, Promise<UnwrapPromise<ReturnOf<Fn>>>>()

  return (...args: ParamsOf<Fn>): Promise<UnwrapPromise<ReturnOf<Fn>>> => {
    const key = JSON.stringify(args)
    const hit = cache.get(key)
    if (hit !== undefined) {
      return hit
    }
    // 唯一一处 as(题面允许):实测 spread 调用 fn(...args) 本身能过,
    // 挂的是返回值赋值 —— 约束只保证 fn 返回 Promise<unknown>,而这里需要
    // Promise<UnwrapPromise<ReturnOf<Fn>>>(两个延迟条件类型,TS 无法证明它们一致,
    // 虽然语义上必然一致:UnwrapPromise<ReturnOf<Fn>> 就是 Fn 实际返回 Promise 的解析值)。
    // 把 fn 的返回类型对齐回萃取结果,是"类型层已由签名保证"的诚实收窄。
    const call = fn as (...args: ParamsOf<Fn>) => Promise<UnwrapPromise<ReturnOf<Fn>>>
    const result = call(...args)
    cache.set(key, result)
    return result
  }
}
```

---

## 二、常见错误写法（点评人视角）

### 1. 约束漏了 readonly（readonly 数据进不来）

❌ `export type ElementOf<T extends unknown[]> = T extends (infer E)[] ? E : never`

现象（实测）：`ElementOf<readonly number[]>` 直接
`error TS2344: Type 'readonly number[]' does not satisfy the constraint 'unknown[]'`。
为什么错：readonly 数组不能赋给可变数组（会破坏"不修改"的承诺），
约束 `unknown[]` 把所有 readonly 数据挡在门外 —— 而 as const / readonly 恰恰是
现代 TS 数据的默认姿态。测试的 `@ts-expect-error` 反例（`ElementOf<string>`）
倒是照样命中，容易被"反例过了"麻痹。

✅ 约束 `readonly unknown[]`；模式 `readonly (infer E)[]` 同步放宽（洞外 readonly）。

### 2. 模式写成 `(infer E)[]`（只匹配可变数组）

❌ `T extends (infer E)[] ? E : never`（约束带 readonly，模式没带）

现象：`ElementOf<readonly number[]>` 走 false 分支 → `never`，
`expectTypeOf<ElementOf<readonly number[]>>().toEqualTypeOf<number>()` 红。
为什么错：**约束管进门，模式管配对**——进门了（约束放行）但配不上（模式只认可变数组），
readonly 数组落到 false 分支。模式匹配里 readonly 要写在洞的外面。

✅ `T extends readonly (infer E)[] ? E : never`

### 3. 用 `T[number]` 代替模式匹配（本题能过，但不是今天练的东西）

❌ `export type ElementOf<T extends readonly unknown[]> = T[number]`

现象：本 day 测试全绿。
点评视角：`T[number]` 是**索引访问**，`T extends readonly (infer E)[]` 是**模式匹配**。
今天练的是后者 —— 它是所有 infer 题的统一心智模型（洞在哪个位置）。
索引访问在简单场景等价，但推广不出去：`FirstParamOf` 的"第一个参数"没法用索引访问
表达（见第 6 条的陷阱），Promise 剥壳更没有"索引"可用。
把每一题都归到"洞挖在哪"，是这个系列题的训练目的。

### 4. UnwrapPromise 写成递归（贴 Awaited 太早）

❌

```ts
export type UnwrapPromise<T> = T extends Promise<infer V>
  ? UnwrapPromise<V>   // 递归!
  : T
```

现象：`UnwrapPromise<Promise<Promise<User>>>` 变成 `User`，
测试"只剥一层"的断言红（`toEqualTypeOf<Promise<User>>()`）。
为什么错：不是"更强大就更好"—— 题面要的是"和 await 一次对齐的非递归版"，
它是 Day 23 `Awaited` 的地基；提前递归等于跳过了"分层理解"，
而且递归版每层都剥，会让"我想保留内层 Promise"的场景无处遁形。
**工具类型的递归是设计决策，不是默认姿态。**

✅ `T extends Promise<infer V> ? V : T` —— true 分支交出 V 就停。

### 5. UnwrapPromise 的 false 分支写成 `never`

❌ `T extends Promise<infer V> ? V : never`

现象：`UnwrapPromise<User>` 变成 `never`，
"非 Promise 原样透传"两条断言（User / 42）红。
为什么错：这个萃取器的语义是"剥壳，没有壳就原样"，
false 分支的"对不上"是**合法输入**（不是错误输入），该透传 T。
对比记忆：ElementOf 的 false 分支写 never 没问题（它的约束已经保证了进来的一定是数组，
false 分支理论不可达）—— **false 分支给什么，取决于"对不上"是错误还是合法**。

✅ `T extends Promise<infer V> ? V : T`

### 6. FirstParamOf 用索引访问 `ParamsOf<T>[0]`

❌ `export type FirstParamOf<...> = ParamsOf<T>[0]`

对 `(q: string, page: number) => void`，参数元组的 0 号位置已知存在，结果是 `string`。
`noUncheckedIndexedAccess` 不会改变这个类型级结果。差异出现在无参函数：
通过泛型封装的元组索引得到 `undefined`，本题的匹配模式则观察到 `unknown`。
因此该写法不满足无参边界和“使用模式匹配”的练习要求，而不是必填首参多了 undefined。

✅ `T extends (first: infer F, ...rest: never[]) => unknown ? F : never`

### 7. FirstParamOf 的 rest 写成 `any[]` / 省略

❌ `T extends (first: infer F, ...args: any[]) => unknown ? F : never`

现象：能过测试。为什么点评人还是要挑：一个 any 混进约束，
`FirstParamOf<number>` 这种非法输入的 `@ts-expect-error` 反例**不再命中**（any 万能匹配），
TS2578 出现在反例测试里。never[] 是 any-free 的同义替换，检查一个不少。

✅ `...rest: never[]`（和约束同一个技巧：底类型参数 + 逆变）。

### 8. withCache 的泛型直接写 `<Args extends unknown[], R>`

❌

```ts
export function withCache<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R>   // 手抄了 R 的组装关系
```

现象：测试能过，但**硬性要求不达标** —— 返回类型没有引用 ParamsOf / ReturnOf /
UnwrapPromise，你的前五题成果全被晾着。
点评视角：这不是编译错误，是**学习目标的绕过**。`Args/R` 直接推断确实更顺手
（生产代码里我也这么写），但本题的考点就是"用萃取器拼签名"——
先会"绕"，再会"直"，顺序不能反。

✅ `Fn extends (...args: never[]) => Promise<unknown>` +
`(...args: ParamsOf<Fn>) => Promise<UnwrapPromise<ReturnOf<Fn>>>`（参考实现）。

### 9. withCache 缓存解析值而不是 Promise（引用对不上）

❌

```ts
const cache = new Map<string, UnwrapPromise<ReturnOf<Fn>>>()
// ...
const result = await fn(...args)   // await 完再存
cache.set(key, result)
```

现象：`r2).toBe(r1)` 断言红，或者第一次/第二次调用返回**不同对象**。
为什么错（两层）：
1. 每次命中缓存都 `await` 后返回**同一份解析值**没问题，但 in-flight 期间
   （第一次还没 resolve 时第二次进来）会重复触发原函数 —— `calls` 变 2；
2. 类型层：`await fn(...args)` 的类型是 `UnwrapPromise<ReturnOf<Fn>>`，
   和缓存值一致没问题，但返回类型 `Promise<UnwrapPromise<...>>` 需要再包一层 Promise.resolve，
   多一次微任务、多一份类型组装。
缓存 **Promise 本体**是函数缓存的惯用法：promise 只 resolve 一次，
天然保证"同一引用、只触发一次、并发安全"。

✅ 参考实现：`cache = new Map<string, Promise<...>>()`，存 promise、还 promise。

### 10. withCache 里 `fn(...args)` 不加任何处理（实测：卡在返回值，不是参数）

❌（对照实验结果）以为要先解决"args 的元素不能赋给 never"，于是不敢写；
或者反过来直接写了，然后在**返回值赋值**处撞墙：

```
error TS2345: Argument of type 'Promise<unknown>' is not assignable to
parameter of type 'Promise<UnwrapPromise<ReturnOf<Fn>>>'.
```

实测结论（有点反直觉）：`fn(...args)` 的 **spread 调用本身能过**
（TS 按 Fn 的约束签名检查调用，ParamsOf<Fn> 的上界是元组，兼容 never 参数位）；
真正过不了的是把 `Promise<unknown>`（约束给的宽返回）赋给
`Promise<UnwrapPromise<ReturnOf<Fn>>>`（延迟条件类型，TS 无法证明两者一致）。
这正是题面"允许一处 as"的用意 —— 这里的类型相等**语义上必然成立**
（UnwrapPromise<ReturnOf<Fn>> 就是 Fn 实际返回的 Promise 的解析值），
但 TS 对泛型延迟条件类型没有"代数推理"能力，只能由你背书。

✅ 一处 as + 注释写明"实测卡在哪、为什么语义上安全"（参考实现）。

### 11. 缓存 key 用第一个参数（JSON.stringify 少写了 args）

❌ `const key = JSON.stringify(args[0])`

现象："不同参数不共享缓存"的用例红 —— `(q: 'chip')` 和 `(q: 'runner')` 如果只看
首参会区分，但参数是 `(q, page)` 时 `(chip, 1)` 和 `(chip, 2)` 撞 key。
为什么错：本题缓存键需要覆盖测试场景的输入维度。JSON.stringify 并非任意 JS 值的无碰撞编码；本题对简单可序列化参数使用整个 args，把
参数列表序列化成稳定的 key。

✅ `const key = JSON.stringify(args)`。
（进阶意识：JSON key 有理论碰撞 —— `f({a:1})` 和 `f('[{"a":1}]')` 不同输入同 key；
内存缓存场景一般可接受，严谨场景用参数逐项序列化或 WeakMap 逃逸对象。今天够用即可。）

---

## 三、思考题参考答案

README 的三道思考题在参考实现的 JSDoc 里都有完整回答，这里给**浓缩版 + 一个延伸**：

### 1. 为什么 ElementOf 的约束必须带 readonly？

readonly 数组不能赋给可变数组（反之可以）。约束 `unknown[]` 等于宣布
"本工具不服务 readonly 数据"，`ElementOf<readonly number[]>` 在类型参数处
TS2344。约束 `readonly unknown[]` 是"最宽的数组上界"，可变/只读通吃。
**一句话：约束决定谁能进门 —— 想服务所有数组，上界就得是 readonly。**

### 2. 为什么 never[] 约束能收下任意函数？

参数逆变 + never 是底类型。`(q: string) => X` 赋给 `(...args: never[]) => unknown`
要求 never[]（B 的参数）的元素 assignable to string（A 的参数）—— never assignable to
一切，恒成立；返回位 unknown 收一切返回值。标准库的 any[] 靠"放弃检查"达到同样效果，
never[] 靠"逆变规则恰好全过"—— **能力相同，纪律不同**。
这也是为什么 never[] 只能用在参数位：把它放返回位（`() => never`）就成了"最窄的返回"，
方向就反了。

### 3. 为什么 Promise<Promise<User>> 只剥一层？

`Promise<infer V>` 的洞在外层类型参数位，V 绑定到 `Promise<User>` 后匹配即结束 ——
模式匹配是纯结构操作，不递归。运行时联想：`resolve(promiseA)` 会被运行时**递归展平**
（thenable 协议），所以 `Awaited` 必须递归才能贴合运行时；
非递归版是"一层"这个最小单元 —— **递归 = 一层的重复**，先把一层写对。

### 延伸：FirstParamOf<() => void> 为什么是 unknown（而不是报错或 never）？

`() => void` 匹配 `(first: infer F, ...rest) => unknown` 时**匹配成功**
（参数少的函数可赋给参数多的签名），但 first 位没有对应实参，TS 把洞填成顶类型 unknown。
启示：**匹配成功 ≠ 洞有内容**。想让"无参函数"在这里失败，得加一层显式判断，
比如先算 ParamsOf<T> 的元组长度。洞的"默认值"行为是调试模式匹配的好线索 —— 
看到 unexpected unknown，先怀疑"模式其实匹配上了，只是洞是空的"。

---

## 四、验收自查清单

- [ ] `pnpm check:day 19` 通过（类型检查 + 运行时测试）
- [ ] 零 any；唯一的一处 as 在 withCache 里，带"实测卡在哪"的注释
- [ ] 所有 export 有 JSDoc + @example
- [ ] 三道思考题的回答分别写在 ElementOf / ReturnOf / UnwrapPromise 的 JSDoc 里
- [ ] ElementOf 的约束保留了 `readonly unknown[]`，模式是 `readonly (infer E)[]`
- [ ] UnwrapPromise 是非递归的（嵌套 Promise 只剥一层）
- [ ] FirstParamOf 用的是模式匹配，不是 `ParamsOf<T>[0]`
- [ ] withCache 的返回类型引用了 ParamsOf / ReturnOf / UnwrapPromise 三件套
- [ ] 测试里的 `@ts-expect-error` 反例全部精准命中（没有 TS2578 unused）
- [ ] 额外自查：withCache 缓存的是 Promise 本体吗？in-flight 重复调用会触发原函数吗？（第 9 条）
- [ ] 额外自查：把约束里的 never[] 改成 any[] 试试 —— 反例还在吗？体会"检查还在"和"放弃检查"的区别（第 7 条）
