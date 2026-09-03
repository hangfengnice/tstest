# Day 19 — 条件类型 + infer 基础:composable 类型萃取工具箱

> 第三阶段开门题。前两个阶段你在"用类型描述数据",从今天开始学"用类型计算类型"。
> 条件类型 + infer 是后面一切(分布式 / 映射 / 模板字面量)的地基。

## 业务场景

chipRunner 的 `composables/` 目录已经堆了 20 多个 `useXxx`,code review 里反复出现三类"手抄类型":

1. `useUsers()` 返回 `Ref<User[]>`,列表组件要 `User`,有人把 `User` 定义又抄了一遍 —— 源头一改就漏改
2. 写 API 包装层时,`fetchPagedUsers: (q: string) => Promise<Paged<User>>` 的返回值被逐字复制进包装函数的签名
3. 二次包装(`withCache` / `withRetry`)的签名全靠手写,原函数一变就失同步

今天你来实现一个**类型萃取工具集**:所有"类型的零件"都从源头类型自动提取,手抄次数归零。
这也是 `ReturnType` / `Parameters` / `Awaited` 这些内置工具的共同底层 —— **条件类型里的模式匹配**。

## 心智模型(先读这段,再做题)

```ts
// 元组版示例(本题不考,但今天的每一题都是它的变体):
type Head<T> = T extends [infer F, ...unknown[]] ? F : never
//   Head<[string, number]>  →  string
```

把 extends 右侧的 `[infer F, ...unknown[]]` 看成一个**带洞的模式**:TS 拿 `T` 去对模式,
能对上就把洞填上,`infer F` 绑定到洞里的类型;对不上走 false 分支。
**infer 只能写在 extends 子句里**(模式位置),这是它和普通类型参数的唯一区别。
做题时先问自己:洞挖在哪个位置?(元素位 / 返回值位 / 参数位 / then 值位)

---

## 任务(按难度梯度)

### 🟢 基础题 1 — `ElementOf<T>`:从数组提元素

**业务动机**:`useUsers()` 返回 `Ref<User[]>`,列表组件直接需要 `User`。

**规格**(测试即判卷标准):

| 输入 | 输出 |
|---|---|
| `ElementOf<string[]>` | `string` |
| `ElementOf<readonly number[]>` | `number` |
| `ElementOf<User[]>` | `User` |
| `ElementOf<readonly ['a', 'b']>` | `'a' \| 'b'`(as const 元组提出字面量联合) |

**要求**:骨架里的约束 `readonly unknown[]` 不许删,并在 JSDoc 里回答:
**为什么约束必须带 `readonly`?** 把约束改成 `unknown[]` 后 `ElementOf<readonly number[]>` 会怎样?动手试,把结论写进 JSDoc。

**提示**:数组模式是"元素位置有个洞"。注意 `readonly number[]` 和 `number[]` 是**两种模式**,一个 `(infer E)[]` 吃不下两种 —— 想同时吃下,`readonly` 要写在洞的**外面**。

### 🟡 进阶题 2 — `ReturnOf<T>`:自实现 ReturnType

**业务动机**:包装层要原样保留被包装函数的返回类型。

**规格**:

| 输入 | 输出 |
|---|---|
| `ReturnOf<() => string>` | `string` |
| `ReturnOf<(q: string) => Promise<Paged<User>>>` | `Promise<Paged<User>>` —— **不剥 Promise** |

**要求**:JSDoc 里回答:**约束 `(...args: never[]) => unknown` 为什么能收下任意函数?**
(联想:函数参数是逆变的;`never` 是所有类型的子类型。`never[]` 在参数位起了什么作用?)
以及:为什么标准库源码用 `any[]` 也能工作,而本仓库禁 `any` 后 `never[]` 是更严的替身?

**提示**:洞挖在返回值位置;参数位置照抄约束的写法即可(参数不是今天要提的东西)。

### 🟡 进阶题 3 — `UnwrapPromise<T>`:剥一层 Promise 壳(非递归)

**业务动机**:composable 内部 `await` 之后,类型层要把 `Promise<Paged<User>>` 变成 `Paged<User>`。

**规格**:

| 输入 | 输出 |
|---|---|
| `UnwrapPromise<Promise<User>>` | `User` |
| `UnwrapPromise<Promise<Promise<User>>>` | `Promise<User>` ← **只剥一层!** |
| `UnwrapPromise<User>` | `User`(非 Promise 原样透传) |
| `UnwrapPromise<42>` | `42`(透传时字面量不许变宽) |
| `UnwrapPromise<never>` | `never`(边界观察,Day 20 揭晓原因) |

**思考(写进 JSDoc)**:`Promise<Promise<User>>` 为什么不是 `User`?
(联想运行时:`new Promise(r => r(promiseA))` 的 `.then` 拿到什么?
真正展平的 `Awaited<T>` 靠递归,那是 Day 23 的主题 —— 今天非递归版"剥一层"是它的地基。)

### 🔴 边界题 4 — `ParamsOf<T>`:自实现 Parameters

**规格**:

| 输入 | 输出 |
|---|---|
| `ParamsOf<(q: string, page: number) => void>` | `[string, number]`(参数元组,标签不参与比较) |
| `ParamsOf<() => void>` | `[]` |

**提示**:洞挖在参数位 —— `(...args: infer P)`,一个洞收下**整个**参数列表,TS 自动把它推断成元组。

### 🔴 边界题 5 — `FirstParamOf<T>`:只取第一个参数

**业务动机**:`withCache` 的简化场景里,只需要确认原函数首参是搜索词 `string`。

**规格**:

| 输入 | 输出 |
|---|---|
| `FirstParamOf<(q: string, page: number) => void>` | `string` |
| `FirstParamOf<() => void>` | `unknown` ← 边界观察:无参函数去匹配"有一个 first 参数"的模式,TS 把洞填成了什么?结论写进 JSDoc |

**提示**:第一个参数是洞,剩余参数用 rest 收走(可以是 `never[]`,反正没人用)。
**陷阱**:写成 `ParamsOf<T>[0]` 在 `noUncheckedIndexedAccess` 下会拿到 `string | undefined`,
而且那是"索引访问"不是"模式匹配" —— 今天练的是后者。

### 🔴 边界题 6 — `withCache`:组合运用(签名从测试反推)

给异步函数加一层"参数 → 结果"内存缓存。**函数签名自己设计**,测试是规格:

```ts
const cached = withCache(fetchPagedUsers)
// cached 的类型:参数列表与原函数相同,返回 Promise<已解析值>
// 即 (q: string) => Promise<Paged<User>>
```

**硬性要求**:

- 返回函数的类型**必须引用** `ParamsOf` / `ReturnOf` / `UnwrapPromise`(你的前五题成果),
  签名里出现任何一处手抄的具体类型,此题按不合格算
- 运行时:同参数第二次调用**不再触发原函数**,且拿到**同一个对象引用**;不同参数各自缓存

**提示**:T 的约束是"任意返回 Promise 的函数"(约束写法参考 `ReturnOf`,再加一层 Promise 判断);
缓存 key 用 `JSON.stringify(args)`。签名拼好后你会发现:整个函数没有一个手写类型。

---

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm test` 全绿
- [ ] 零 `any`、零 `as`(`withCache` 运行时**允许最多 1 处 `as`**,必须带注释解释为什么这里不得不用)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 三道思考题(`readonly` 约束 / `never[]` 万能约束 / 只剥一层)的回答分别写在对应类型的 JSDoc 里
- [ ] `withCache` 的返回类型引用了三个自制工具类型
- [ ] 测试里的 `@ts-expect-error` 反例实现后依然精准命中(不留 unused)

## 写完后

贴 `solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:🟢 15 分钟 → 🟡 30 分钟 → 🔴 45 分钟。卡超过 15 分钟再来问,要提示不要答案。
