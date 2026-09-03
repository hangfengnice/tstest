# Day 20 — 分布式条件类型 + infer 进阶:订单筛选器的联合运算

> 昨天的条件类型一次只喂一个具体类型。今天喂它**联合类型** —— 你会发现它悄悄把联合拆开、
> 逐个加工、再合回去。这个"分布(distributivity)"行为是 `Exclude` / `Extract` / `NonNullable`
> 的共同原理,也是类型体操第一大直觉来源和第一大翻车现场。

## 业务场景

chipRunner 订单列表页的**筛选器系统**。筛选值来自三个来源:

- URL 查询参数(解析出来是 `string`)
- 本地状态(`number`,如金额区间)
- 布尔开关(`boolean`)
- 后端聚合接口对"未设置"的字段返回 `null`,可选链里还会冒出 `undefined`

于是核心类型是:`type FilterValue = string | number | boolean | null | undefined`。

页面上还有一套订单状态机(`OrderStatus` 五值联合),需要批量派生出:
"每个状态的徽章对象"、"每个资源的 REST 端点"、"筛选项元组去头"。
这些派生全都要靠今天的分布式条件类型 + infer 完成。

## 预备知识(先做实验,再做题)

在编辑器里写这两行(可以放 solution.ts 顶部实验区,写完观察):

```ts
type Probe1<T> = T extends string ? 'str' : 'other'
type A = Probe1<'a' | 'b' | 1>   // 悬停 A,猜猜是 'str' | 'other' 还是 'other'?

type Probe2<T> = [T] extends [string] ? 'str' : 'other'
type B = Probe2<'a' | 'b' | 1>   // 悬停 B,和 A 一样吗?为什么?
```

**结论(做题前必须能口头复述)**:条件类型遇到**裸类型参数**(naked type parameter,
即 `T` 直接出现在 extends 左边)且传入联合时,会把联合**拆开逐个判断**,
结果再合并成联合;把 T 包进 `[T]` 后就变成"整体一次性比较"。
今天一半的题靠这个行为工作,另一半题要**消灭**这个行为。

---

## 任务(按难度梯度)

### 🟢 基础题 1 — `TypeName<T>`:给联合的每个成员打标签

**业务动机**:筛选值渲染时,按类型选控件:文本框 / 数字输入 / 开关 / 空态占位。

**规格**(测试即判卷标准):

| 输入 | 输出 |
|---|---|
| `TypeName<FilterValue>` | `'string' \| 'number' \| 'boolean' \| 'null' \| 'undefined'` |
| `TypeName<'a' \| 1>` | `'string' \| 'number'`(分布式的直接证据) |
| `TypeName<never>` | `never`(边界观察,见 🔴 6) |

**要求**:只处理 `string / number / boolean / null / undefined` 五种,其余给 `never`。
JSDoc 回答:**`TypeName<'a' | 1>` 为什么拿到两个标签而不是一个?**(`'a' | 1` 整体 extends string 成立吗?)

**提示**:嵌套条件类型(else 分支里继续 extends),从上往下依次判断;
`null` 和 `undefined` 在条件类型里要显式各写一个分支。

### 🟢 基础题 2 — `DropEmpty<T>`:自实现 NonNullable

**业务动机**:筛选项进入渲染前要剔除 `null | undefined`(渲染层只关心有值的情况)。

**规格**:

| 输入 | 输出 |
|---|---|
| `DropEmpty<string \| null \| undefined>` | `string` |
| `DropEmpty<FilterValue>` | `string \| number \| boolean` |

**思考(写进 JSDoc)**:`null` 和 `undefined` 这两个成员去哪了?
(提示:它们在 true 分支里变成了什么类型?**`never` 在联合里会被吸收** ——
这个现象是下一题 ExcludeOwn 的钥匙,也是昨天 `UnwrapPromise<never> = never` 的答案。)

### 🟡 进阶题 3 — `ExcludeOwn<T, U>`:自实现 Exclude

**业务动机**:权限系统里"从所有操作里剔除用户无权的操作",本质是从联合里删成员。

**规格**:

| 输入 | 输出 |
|---|---|
| `ExcludeOwn<'view' \| 'edit' \| 'delete', 'edit' \| 'delete'>` | `'view'` |
| `ExcludeOwn<OrderStatus, 'cancelled'>` | 剩下四个状态 |

**要求**:JSDoc 回答:它和 `DropEmpty` 的结构是不是只差"判断条件"?
(把 `T extends U` 看成 DropEmpty 里的 `T extends null | undefined` 泛化版。)

**提示**:一行就够了。想想为什么内置 `Exclude` 也只有一行。

### 🟡 进阶题 4 — `Tail<T>` + 运行时 `tail`:元组去头

**业务动机**:批量操作指令是元组:`['sort', 'createdAt', 'desc']` —— 第一项是操作名,
`Tail` 把"参数部分"提出来。运行时函数同步实现。

**规格**:

| 输入 | 输出 |
|---|---|
| `Tail<[1, 2, 3]>` | `[2, 3]` |
| `Tail<['a']>` | `[]` |
| `Tail<[]>` | `[]` |
| `Tail<string[]>` | `[]`(普通数组不是"至少一个元素的元组",走 else 分支) |
| `Tail<readonly ['a', 'b']>` | `['b']`(readonly 元组也要能进) |

**运行时**:`tail([1, 2, 3])` → `[2, 3]`;`tail([])` → `[]`(不许对空数组报错)。

**提示**:模式是 `[unknown, ...infer Rest]` —— "第一个元素任意,剩下的全收进洞"。
注意昨天的教训:readonly 元组和可变元组是两种模式,模式里的 `readonly` 要写对位置。
运行时 `Array.prototype.slice(1)` 就是答案,类型标注才是考点。

### 🟡 进阶题 5 — `StatusBadge<T>`:把状态联合批量变成对象联合

**业务动机**:状态渲染需要 `{ status: 'pending' }` 形状的可辨识对象(后续接 label / color)。

**规格**:

| 输入 | 输出 |
|---|---|
| `StatusBadge<'pending' \| 'paid'>` | `{ status: 'pending' } \| { status: 'paid' }` |

**提示**:true 分支里直接**使用 T 本身** —— 分布式已经保证此刻的 T 是单个成员,
你不需要任何"取成员"的操作。

### 🔴 边界题 6 — `IsText<T>`:阻止分布,整体判断

**业务动机**:筛选器要判断"这个筛选值是不是**纯文本**"(所有可能值都是 string 才渲染文本框,
混进一个 number 就得渲染复合控件)。

**规格**:

| 输入 | 输出 | 注意 |
|---|---|---|
| `IsText<string>` | `true` | |
| `IsText<'a' \| 'b'>` | `true` | 全是字符串字面量,整体仍可赋给 string |
| `IsText<'a' \| 1>` | `false` | **分水岭:裸参数版这里会得到 `boolean`!** |
| `IsText<never>` | `true` | 对照:裸参数版对 never 得 `never`;`[never]` 是一个合法元组 |

**要求**:JSDoc 回答三件事:
1. 为什么裸参数版 `IsText<'a' | 1>` 得到的是 `boolean` 而不是 `false`?
2. `[T]` 是怎么阻止分布的?
3. `IsText<never>` 为什么是 `true`?(never 是"空联合",分布行为对空联合直接短路返回 never;
   包进元组后它就是一个普通的具体类型了。这也解释了昨天 `UnwrapPromise<never> = never`。)

**提示**:如果你写的版本对 `'a' | 1` 输出了 `boolean`,不是 bug,是分布式在"正确地工作" ——
你要做的是让它别工作。

### 🔴 边界题 7 — `GetEndpoint<T>`:模板字面量的"天生分布式"

**业务动机**:资源名 → REST 端点:`'user' | 'order'` → `'/api/user' | '/api/order'`。

**规格**:

| 输入 | 输出 |
|---|---|
| `GetEndpoint<'user' \| 'order'>` | `'/api/user' \| '/api/order'` |

**要求**:JSDoc 回答:这道题**一个条件类型都不用写**,联合为什么还是被分布了?
(模板字面量里的占位符遇到联合,行为和裸类型参数一样 —— 这也是 Day 22 整天的地基。)

**提示**:`/api/` 是字面量部分,占位符只有 T 自己。

---

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm test` 全绿
- [ ] 零 `any`;`tail` 运行时允许**恰好 1 处 `as`**(slice 返回的是宽的元素数组,要能解释为什么收不窄)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] "预备知识"的 Probe1/Probe2 对照结论写进 `TypeName` 或 `IsText` 的 JSDoc
- [ ] `IsText` 的三个思考题回答完整
- [ ] 测试里的 `@ts-expect-error` 反例实现后依然精准命中(不留 unused)

## 写完后

贴 `solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:预备实验 10 分钟 → 🟢 20 分钟 → 🟡 35 分钟 → 🔴 35 分钟。
卡超过 15 分钟再来问,要提示不要答案。
