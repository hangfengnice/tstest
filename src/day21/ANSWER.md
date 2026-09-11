# Day 21 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试(22/22,vitest typecheck 模式双跑 44/44)+ `pnpm typecheck` 该目录零错误。

```ts
export type UserProfile = {
  id: string
  name: string
  age: number
  email?: string
}

export type ServerOrder = {
  readonly desc: string
  readonly amt: number
  note: string
}

// —— 基础 1:自实现 Partial ——
// 值列必须是 T[K] | undefined:本仓库开着 exactOptionalPropertyTypes,
// `?: T[K]` 的语义是"出现时不能是 undefined",显式赋 { name: undefined } 会报 TS2375。
export type MyPartial<T> = {
  [K in keyof T]?: T[K] | undefined
}

// —— 基础 2:自实现 Readonly(注意:浅只读)——
export type MyReadonly<T> = {
  readonly [K in keyof T]: T[K]
}

// —— 进阶 3:-readonly 解冻(同样只解第一层)——
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

// —— 进阶 4:-? 全必填(会把 | undefined 一并减掉)——
export type RequiredAll<T> = {
  [K in keyof T]-?: T[K]
}

// —— 进阶 5:只改值列,键名和修饰符都不动 ——
export type Refs<T> = {
  [K in keyof T]: { value: T[K] }
}

// —— 边界 6:as never 剔键(全遍历 + 逐键过滤路线)——
export type OmitOwn<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}

// —— 边界 7:as 改键名(键转换本身是个条件类型)——
export type RenameKeys<T, M extends Record<string, PropertyKey>> = {
  [K in keyof T as K extends keyof M ? M[K] : K]: T[K]
}

// —— 边界 8:运行时 + 类型双实现(全文件仅有的两处 as)——
export function toRefsOwn<T extends object>(obj: T): Refs<T> {
  // 中转站:键 string、值 { value: unknown } 的宽形状
  const result: Record<string, { value: unknown }> = {}
  for (const key of Object.keys(obj)) {
    // as #1:Object.keys 的类型被 lib 定死为 string[],无法回连 keyof T;
    // 运行时 key 必然来自 obj 自身 —— 类型系统表达不了、运行时显然正确
    result[key] = { value: (obj as Record<string, unknown>)[key] }
  }
  // as #2:"逐键完整填充"是运行时事实不是静态事实,
  // 动态构建的 Record 与映射类型 Refs<T> 无法互相证明
  return result as Refs<T>
}
```

## 二、常见错误写法(点评人视角)

### 1. MyPartial 忘了 `| undefined`(本仓库必踩)

```ts
❌ export type MyPartial<T> = { [K in keyof T]?: T[K] }
```

现象:`const draft: MyPartial<UserProfile> = { name: undefined }` 直接报
**TS2375**: `Type '{ name: undefined; }' is not assignable to type 'MyPartial<UserProfile>' with 'exactOptionalPropertyTypes: true'`。
原因:`exactOptionalPropertyTypes` 把"可选"和"可为 undefined"拆成了两件事 —— `?: string`
表示"可以整个没有,但**出现**就必须是 string"。lib 源码显式写 `T[P] | undefined`,
就是为了让"字段在,但值是 undefined"的草稿合法。已实测验证,不是理论。

```ts
✅ export type MyPartial<T> = { [K in keyof T]?: T[K] | undefined }
```

### 2. readonly 写到了值的位置

```ts
❌ export type MyReadonly<T> = { [K in keyof T]: readonly T[K] }
```

现象:报 **TS1354**(`'readonly' type modifier is only permitted on array and
tuple literal types` —— readonly 类型修饰符只允许出现在数组/元组字面量前)。
`readonly` 是**属性修饰符**,只出现在属性名前面,不是值类型上的运算符 ——
`readonly string` 这种类型不存在( Readonly 是工具类型对**属性**做的事,
不是对值类型做的事)。

```ts
✅ export type MyReadonly<T> = { readonly [K in keyof T]: T[K] }
```

### 3. Mutable 只是"重新映射了一遍",没剥 readonly

```ts
❌ export type Mutable<T> = { [K in keyof T]: T[K] }
```

现象:不报任何错 —— 但测试里 `editable.name = '李四'` 这行**没有** @ts-expect-error
保护,`pnpm typecheck` 会以 **TS2540**(`Cannot assign to 'name' because it is a
read-only property`)挂掉。同构映射会**继承**原属性的全部修饰符,想改必须用 `-` 显式减。

```ts
✅ export type Mutable<T> = { -readonly [K in keyof T]: T[K] }
```

### 4. RequiredAll 以为去掉问号就够了

```ts
❌ export type RequiredAll<T> = { [K in keyof T]: T[K] }  // 没有 -?
```

现象:对 `email?: string` 这种字段**毫无作用** —— 值列没动、问号被同构映射继承了,
`RequiredAll<UserProfile>` 里 email 照样可选,测试"缺 email 必须报错"挂
(@ts-expect-error 变 unused,**TS2578**)。`-?` 是一个完整动作:去问号
**并且**把 `undefined` 从值联合里减掉 —— 这是它和"手动删问号"的本质区别。

```ts
✅ export type RequiredAll<T> = { [K in keyof T]-?: T[K] }
```

### 5. Refs 包装了整个 T

```ts
❌ export type Refs<T> = { [K in keyof T]: { value: T } }
```

现象:类型不匹配(测试 toEqualTypeOf 挂):每个属性都变成 `{ value: 整个T }`,
而不是"各自字段类型"。值列引用的是**当前键的值** `T[K]`,不是整体 `T`。
这是映射类型最常见的笔误:循环体里 K 是"当前遍历到的键"。

```ts
✅ export type Refs<T> = { [K in keyof T]: { value: T[K] } }
```

### 6. OmitOwn 的条件写反 / 用 Pick+Exclude 凑

```ts
❌ export type OmitOwn<T, K extends keyof T> = {
     [P in keyof T as P extends K ? P : never]: T[P]  // 条件反了
   }
```

现象:**所有键全部消失**,`OmitOwn<UserProfile, 'id'>` 变成 `{}` —— as never
是"这个键不要了",你把不在名单里的也 never 掉了。toEqualTypeOf 挂,而且挂得
很安静(两边都是空对象形状时错误信息反而不直观)。另外题面明令禁止
`Pick<T, Exclude<keyof T, K>>` 路线 —— 那是内置 Omit 的实现,今天练的是
"全遍历 + 逐键改名 never"这条另一条路。

```ts
✅ export type OmitOwn<T, K extends keyof T> = {
     [P in keyof T as P extends K ? never : P]: T[P]
   }
```

### 7. RenameKeys 直接索引 M[K] 不做判断

```ts
❌ export type RenameKeys<T, M extends Record<string, PropertyKey>> = {
     [K in keyof T as M[K]]: T[K]  // K 不一定在 M 里
   }
```

现象:**TS2536**(`Type 'K' cannot be used to index type 'M'`)—— M 只有部分键,
拿 T 的任意键去索引会被拦。as 子句里必须先问"这个键在映射表里吗"
(条件类型),在就换名、不在就透传:

```ts
✅ [K in keyof T as K extends keyof M ? M[K] : K]: T[K]
```

顺带的坑:映射表方向别写反 —— 是"M[K] 作为新名字",不是拿新名字找旧键。

### 8. toRefsOwn 跳过中转站直接索引

```ts
❌ const refs: Refs<T> = {}
   for (const key of Object.keys(obj)) {
     refs[key] = { value: obj[key] }  // 两个错误
   }
```

现象:两处报错 —— ① `refs[key]`:string 不能索引 `Refs<T>`(**TS7053**,
noImplicitAny 拦截);② `obj[key]`:同理,`Object.keys` 的返回类型是 `string[]`,
TS 无法知道这些 string 其实是 `keyof T`。这就是 README 提示的
"noUncheckedIndexedAccess 和键类型的第一道坎"。另注意:用 `Object.entries(obj)`
也不干净 —— 它对泛型对象走的是 `{}` 重载,返回 `[string, any][]`,会偷偷把 any
带进你的代码。规范姿势:宽类型 `Record<string, { value: unknown }>` 当中转站,
两处 as 各自注释(见参考实现)。

### 9. 以为 as 重映射会丢掉修饰符(概念坑)

有人会"预防性"地在 RenameKeys 结果上重新补 readonly。不需要:同构映射
(`[K in keyof T]` + as 改键)会**保留**原属性的 `?` 和 `readonly` ——
测试里 `RenameKeys<ServerOrder, ...>` 产出 `readonly description` 就是明证。
同理 OmitOwn 剔掉 `id` 后 `email?` 依然可选。as 只改键名,不动修饰符。

### 10. 概念坑:`{ a: 1 }` 经过 `Mutable<Readonly<...>>` 回不到字面量类型

`Mutable<Readonly<{ a: 1 }>>` 的结果是 `{ a: 1 }`,字面量 `1` 完整保留 ——
因为映射类型不动值列时,值类型原样透传。如果你发现结果变成 `{ a: number }`,
说明你在值列动了手脚(比如写了 `T[K] | undefined` 或展开重建)。
类型工厂的原则:**不相关的层不要碰**。

## 三、思考题参考答案

### 基础题 1 — 为什么值列是 `T[P] | undefined` 而不只是 `T[P]`?

见常见错误 1。核心:`exactOptionalPropertyTypes: true` 下,`?: T` 与 `?: T | undefined`
是**两个不同的类型** —— 前者禁止显式 undefined,后者允许。lib 选择后者,因为
Partial 的语义是"填了一半也算",`{ name: undefined }`(显式占位)应当合法。
动手验证:去掉 `| undefined`,赋值报 TS2375,错误信息会明确建议
"Consider adding 'undefined' to the types of the target's properties"。

### 基础题 2 — MyReadonly 是浅只读,内层为什么没冻结?

`[K in keyof T]` 只遍历 T 的**第一层键**;值列 `T[K]` 是对内层类型的**原样引用**,
没有对它再套映射。所以 `frozen.profile.name = 'x'` 编译器不拦 —— 冻住的只有
"第一层的属性槽位"。深冻结需要递归:值列写成 `DeepReadonly<T[K]>`(Day 23)。
Vue 的 `readonly()` 是运行时递归代理,和类型层 DeepReadonly 是同一件事的两个世界。

### 进阶题 4 — `-?` 为什么会同时减掉 `| undefined`?

可选属性在 TS 内部表示为"属性类型 ∪ undefined + 可缺省标记"。`-?` 的语义是
"把这个属性恢复成必填的完整动作",实现上就是把这两件事一起还原 —— 所以
`RequiredAll<Partial<{name: string}>>` 得到 `{ name: string }` 而不是
`{ name: string | undefined }`。这也是它和"手动删问号"的区别:你手动删,
联合里的 undefined 还在。

### 边界题 7 — as 子句里的键转换是什么类型?

条件类型:`K extends keyof M ? M[K] : K`。as 后面的位置可以放任何解析为
`PropertyKey` 的类型表达式;条件类型在这里做"查表,查到换名、查不到透传"。
把 Day 20 的条件类型接进 Day 21 的映射类型,正是这道题的训练目的。

### 预备知识实验(README 开头的 Probe)

- `Probe<T> = { [K in keyof T]: T[K] }` 悬停:和原类型**一模一样** ——
  同构映射 + 值列透传 = 恒等变换。Partial/Readonly 全家只是在它身上各改一处。
- 换成 `K in 'a'`:不再同构(键集合是写死的字面量),修饰符**不再继承** ——
  原来 `b?: number` 的可选性丢了。同构性是"映射类型继承修饰符"的前提。
- 值列换 `T[K] | null`:每个属性都多出 null —— 值列是任意表达式,
  这正是 Refs / DeepReadonly 能只动值列的原因。

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全绿
- [ ] 零 `any`;`as` 只出现在 `toRefsOwn`(≤2 处,每处有注释)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] `MyPartial` 值列带 `| undefined`,JSDoc 写清 TS2375 实验结论
- [ ] `MyReadonly` 的 JSDoc 写明"浅只读"事实与原因
- [ ] `OmitOwn` 走 as never 路线(没用 Pick/Exclude 凑);`RenameKeys` 用 as 改键
- [ ] 测试里的 `@ts-expect-error` 全部精准命中:readonly 赋值、缺 email、
      `OmitOwn<UserProfile, 'foo'>` 三处反例,实现后 typecheck 无 "Unused directive"(TS2578)
