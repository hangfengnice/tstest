# Day 21 — 映射类型:表单引擎的类型工厂

> 前两天你在"从类型里挖零件"(infer)和"拆联合"(分布式)。
> 今天反过来:**遍历一个类型的所有键,批量生成新类型** —— `[K in keyof T]` 一行,
> 就是 Partial / Readonly / Pick / Omit 全家的母体。再加上 `as` 重映射(改键名)和
> 修饰符增减(`+?` / `-readonly` / `-?`),你就掌握了 Vue、Pinia、组件库里
> "类型工厂"的全部原料。

## 业务场景

chipRunner 要做一个**低代码表单引擎**(运营配置 schema,前端渲染表单)。表单的业务类型
只定义一次,引擎要自动派生一整套配套类型:

| 派生类型 | 用途 | 手工写会怎样 |
|---|---|---|
| 草稿(全可选) | 自动保存,填了一半也是合法草稿 | 每加一个字段抄一遍 `?` |
| 只读快照(全 readonly) | 详情页展示、快照对比 | 每个字段抄一遍 `readonly` |
| 提交(全必填) | 提交前校验"都填了" | 手写 Required |
| 可编辑副本(去 readonly) | 把服务端 readonly 数据放进本地编辑器 | Vue `reactive` 解除 useFetch 只读数据的日常 |
| 后端字段映射(改键名) | 后端简写 `desc`,前端要 `description` | 手写一遍翻译层 |
| Refs 化(值包装) | mini-reactive 的 `toRefs` 影子 | 每个 key 包一层 `{ value }` |

给定的业务类型(不是考点):`UserProfile`(表单)和 `ServerOrder`(后端订单,含简写字段)。

## 预备知识(先做实验,再做题)

在编辑器里观察(可放 solution.ts 顶部实验区):

```ts
type Probe<T> = { [K in keyof T]: T[K] }
// Probe<{ a: string; b: number }> 悬停 —— 和原类型一模一样?
// 把 K in 换成 K in 'a' 试试;把 T[K] 换成 T[K] | null 试试。
```

`[K in keyof T]` 是一个**_for 循环_:遍历 T 的每个键 K,值列 `T[K]` 是"原值"的占位。
修饰符(`?` / `readonly`)默认**继承**自原类型,`+`/`-` 是显式开关。

---

## 任务(按难度梯度)

### 🟢 基础题 1 — `MyPartial<T>`:自实现 Partial

**规格**:

| 输入 | 输出 |
|---|---|
| `MyPartial<{ name: string; age: number }>` | `{ name?: string \| undefined; age?: number \| undefined }` |
| `MyPartial<UserProfile>` | 与内置 `Partial<UserProfile>` 完全相等 |

**思考(写进 JSDoc)**:为什么 lib 源码写的是 `T[P] | undefined` 而不只是 `T[P]`?
(本仓库开着 `exactOptionalPropertyTypes`:去掉 `| undefined` 后,
`const p: MyPartial<X> = { name: undefined }` 还能过吗?动手验证,结论写进 JSDoc。)

**提示**:循环体 `+?`(默认加,可省 `+`);值列记得处理 `undefined`。

### 🟢 基础题 2 — `MyReadonly<T>`:自实现 Readonly

**规格**:

| 输入 | 输出 |
|---|---|
| `MyReadonly<{ name: string }>` | `{ readonly name: string }` |
| `MyReadonly<UserProfile>` | 与内置 `Readonly<UserProfile>` 完全相等 |

**要求**:测试里有 `@ts-expect-error` 验证只读性(给 readonly 属性赋值必须编译报错)。
JSDoc 回答:**`MyReadonly` 是浅只读** —— 嵌套对象的内层为什么没被冻结?
(深只读 `DeepReadonly` 是 Day 23 递归类型的主题,今天先记下这个"没做到"的事实。)

**提示**:`readonly` 修饰符写在循环体的**键前面**。

### 🟡 进阶题 3 — `Mutable<T>`:解除只读(`-readonly`)

**业务动机**:详情数据是 `Readonly<UserProfile>`(来自服务端),编辑页要放进本地可变状态。

**规格**:

| 输入 | 输出 |
|---|---|
| `Mutable<MyReadonly<UserProfile>>` | 回到 `UserProfile`(可写) |
| `Mutable<Readonly<{ a: 1 }>>` | `{ a: 1 }` |

**提示**:修饰符的减法和加法是对偶:`-readonly` 放在键前面。
这是 Vue 里"把 `useFetch` 的只读 data 拷进本地 ref"的类型层影子。

### 🟡 进阶题 4 — `RequiredAll<T>`:全必填(`-?`)

**业务动机**:提交前校验 —— 草稿是 `Partial<UserProfile>`,提交必须是全必填。

**规格**:

| 输入 | 输出 |
|---|---|
| `RequiredAll<Partial<{ name: string; age: number }>>` | `{ name: string; age: number }` |
| `RequiredAll<Partial<UserProfile>>` | 与内置 `Required<Partial<UserProfile>>` 相等 |

**要求**:测试里有 `@ts-expect-error` 验证:缺 `email` 的对象赋给 `RequiredAll<UserProfile>`
必须编译报错。

**提示**:`-?` 同时会把 `| undefined` 从值里减掉(这是它和"手动去掉问号"的区别,想想为什么)。

### 🟡 进阶题 5 — `Refs<T>`:值包装(不变修饰符,变值)

**业务动机**:mini-reactive 的 `toRefs` 影子 —— 把 `{ count: 1 }` 的每个属性
变成 `{ count: { value: 1 } }`。`{ value: T }` 正是 Vue `Ref<T>` 的最小形状。

**规格**:

| 输入 | 输出 |
|---|---|
| `Refs<{ count: number; name: string }>` | `{ count: { value: number }; name: { value: string } }` |

**提示**:这题不动修饰符、不动键名,**只改值列** —— 值列可以随便写表达式。

### 🔴 边界题 6 — `OmitOwn<T, K>`:用 as 重映射剔键

**业务动机**:渲染列表时隐藏服务端内部字段(`id` 等)。

**规格**:

| 输入 | 输出 |
|---|---|
| `OmitOwn<UserProfile, 'id'>` | `{ name: string; age: number; email?: string }` |
| 与内置 `Omit<UserProfile, 'id'>` | 完全相等 |

**要求**:**必须用 `as` 重映射实现**(内置 Omit 走的是 `Pick<T, Exclude<keyof T, K>>` 路线,
今天练另一条路:遍历所有键,把要删的键**改名为 `never`** —— TS 的约定:as never 的键直接消失)。

**提示**:`[P in keyof T as P extends K ? never : P]` —— as 后面是一个**条件类型**,
你可以把昨天的技能直接接进来。

### 🔴 边界题 7 — `RenameKeys<T, M>`:用 as 重映射改键名

**业务动机**:后端字段简写(`desc` / `amt`),前端组件要全称(`description` / `amount`),
翻译层的类型不该手写。

**规格**:

| 输入 | 输出 |
|---|---|
| `RenameKeys<{ desc: string; amount: number }, { desc: 'description' }>` | `{ description: string; amount: number }`(映射表里没有的键保持原名) |
| `RenameKeys<ServerOrder, { desc: 'description'; amt: 'amount' }>` | 全称版订单 |

**要求**:M 的约束已给(`Record<string, PropertyKey>`),JSDoc 回答:
**as 子句里的键转换是一个什么类型?**(提示:还是条件类型 —— `K extends keyof M ? M[K] : K`。)

### 🔴 边界题 8 — `toRefsOwn`:运行时 + 类型双实现

**业务动机**:给 mini-reactive 补上 `toRefs`:输入普通对象,输出 `Refs<T>` 形状。

**规格**(签名从测试反推):

```ts
const refs = toRefsOwn({ count: 1, name: 'chip' })
// refs: { count: { value: number }; name: { value: string } }
// refs.count.value === 1
```

**硬性要求**:

- 返回类型必须引用 `Refs<T>`
- 运行时:每个属性包成 `{ value: 原值 }`,不共享原对象引用
- **允许最多 2 处 `as`**,每处必须注释解释(动态构建的对象,TS 无法渐进推断到映射类型的形状 ——
  想清楚哪两步是"类型系统表达不了、但运行时显然正确"的)

**提示**:`Object.keys(obj)` 返回 `string[]`,而 `obj[k]` 需要 `k` 是 `keyof T` ——
这里是 `noUncheckedIndexedAccess` 和键类型的第一道坎;用 `Record<string, { value: unknown }>`
当中转站。

---

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm test` 全绿
- [ ] 零 `any`;`as` 只允许出现在 `toRefsOwn`(≤2 处,带注释)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] `MyPartial` 的 `| undefined` 思考题、`MyReadonly` 的"浅只读"事实写进 JSDoc
- [ ] `OmitOwn` 用 as never 实现;`RenameKeys` 用 as 改键实现(不许用 Pick/Exclude 凑)
- [ ] 测试里的 `@ts-expect-error` 反例实现后依然精准命中(不留 unused)

## 写完后

贴 `solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:🟢 20 分钟 → 🟡 35 分钟 → 🔴 45 分钟。卡超过 15 分钟再来问,要提示不要答案。
