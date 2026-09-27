# Day 24 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 24` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试(18/18,vitest typecheck 模式双跑 36/36)+ `pnpm typecheck` 该目录零错误。

一处透明说明:参考实现的 `Awaited` 里有两个 `any`(thenable 推断脚手架,
原样取自 lib.es5.d.ts)。这是深思熟虑的选择 —— 简单版 `Promise<infer V>` 能过
全部类型测试,但会让 `unwrapAll` 无法零 `as` 实现(原因见常见错误 7,
实测验证过)。两个 `any` 只出现在类型推断位置,不接触任何值。
如果你选了"简单版 Awaited + unwrapAll 里一处 as",也是合格的另一种取舍。

```ts
export const PERMISSIONS = [
  'conversation:read',
  'conversation:write',
  'admin:panel',
] as const

export type Permission = TupleToUnion<typeof PERMISSIONS>

// 🟢 #14 First:先拦空元组,再索引访问
export type First<T extends readonly unknown[]> = T extends readonly []
  ? never
  : T[0]

// 🟢 #18 Length:元组的 length 属性是编译期常量
export type Length<T extends readonly unknown[]> = T['length']

// 运行时配套:签名拆成 <F, R>,返回 F ≡ First<typeof tuple>(详见下文错误 5)
export function firstOf<F, R extends readonly unknown[]>(
  tuple: readonly [F, ...R],
): F {
  return tuple[0]
}

export function lengthOf<T extends readonly unknown[]>(tuple: T): Length<T> {
  return tuple.length
}

// 🟡 #10 TupleToUnion:数字下标取出全体元素的联合
export type TupleToUnion<T extends readonly unknown[]> = T[number]

// 🟡 #533 Concat:可变元组语法写在类型位置,readonly 进 readonly 出
export type Concat<A extends readonly unknown[], B extends readonly unknown[]> =
  readonly [...A, ...B]

// 值层 [...a, ...b] 推断出的类型恰好就是 Concat<A, B> —— 零 as
export function concatTuples<
  A extends readonly unknown[],
  B extends readonly unknown[],
>(a: A, b: B): Concat<A, B> {
  return [...a, ...b]
}

export function hasPermission(p: Permission): boolean {
  return PERMISSIONS.includes(p)
}

// 🔴 #189 Awaited:null/undefined 放行 → thenable 匹配 → 递归剥层
// (thenable 分支与 lib.es5.d.ts 同构,两个 any 是推断脚手架)
export type Awaited<T> = T extends null | undefined
  ? T
  : T extends object & {
        then(onfulfilled: infer F, ...args: infer _): any
      }
    ? F extends (value: infer V, ...args: infer _) => any
      ? Awaited<V>
      : never
    : T

// await 在类型层由内置 Awaited 拍平、在运行时递归采纳 thenable —— 一行足矣
export async function unwrapAll<T>(input: T): Promise<Awaited<T>> {
  return await input
}
```

## 二、常见错误写法(点评人视角)

以下每条现象都用 tsc 实测过(本仓库的严格 flags 下)。

### 1. First 一行流 `T[0]`,不拦空元组

```ts
❌ export type First<T extends readonly unknown[]> = T[0]
```

现象:定义处不报错,但一实例化就炸 —— `First<[]>` 展开成 `[][0]`,
报 **TS2493**(`Tuple type '[]' of length '0' has no element at index '0'`),
空元组测试挂。空元组没有第 0 位,这个事实必须在条件类型里显式处理
(先问"是不是空元组"),索引访问本身不会替你兜底。

```ts
✅ T extends readonly [] ? never : T[0]
```

### 2. 约束写成 `unknown[]` 而不是 `readonly unknown[]`

```ts
❌ export type Length<T extends unknown[]> = T['length']
```

现象:`Length<typeof FORM_FIELDS>` 报 **TS2344** —— as const 元组的类型是
`readonly ['title', 'content', 'tags']`,**不满足** `unknown[]` 约束
(readonly 数组不能赋给可变数组)。今天的输入几乎全是 as const 元组,
五个工具的约束全部要写 `readonly unknown[]` —— 少写 readonly,
所有调用点集体红灯。

### 3. TupleToUnion 用成 `keyof T`

```ts
❌ export type TupleToUnion<T extends readonly unknown[]> = keyof T & string
```

现象:拿到的是元组的**属性名**('length'、'concat'、数字下标……),
不是元素。元组的"内容"要用**数字下标**取:`T[number]` = 全体元素的联合。
记法:keyof 拿钥匙,T[number] 拿抽屉里的东西。

### 4. Concat 忘了 readonly 前缀 / 用 .concat() 实现

```ts
❌ export type Concat<A extends readonly unknown[], B extends readonly unknown[]> =
     [...A, ...B]                       // 产出可变元组
❌ return a.concat(b)                    // 运行时实现
```

现象:前者 —— 测试 `toEqualTypeOf<readonly ['src', ...]>()` 挂,
expect-type 对 readonly 与可变是**严格区分**的(可变元组能 push,
readonly 不能,它们不是同一个类型);后者 —— `.concat()` 的返回类型
是宽化的数组(`('src' | 'components' | 'App.vue')[]` 之类),精确元素
信息全丢,TS2322。值层正解就是展开:`[...a, ...b]`,TS 会推断出
恰好等于 `Concat<A, B>` 的类型 —— 这正是可变元组语法的设计目标。

### 5. firstOf 写成 `<T>(tuple: T): First<T>`

```ts
❌ export function firstOf<T extends readonly unknown[]>(tuple: T): First<T> {
     return tuple[0]   // TS2322: Type 'unknown' is not assignable to type 'First<T>'
   }
```

现象(实测):**TS2322**。`tuple[0]` 的类型是 `T[0]`,而返回类型 `First<T>`
是一个对泛型 T **尚未求值**的条件类型 —— TS 无法证明"T[0] 一定是
First<T> 的结果"(它不肯对泛型做分类讨论)。README 教的解法是 as,
但参考实现给出零 as 版:把签名拆成 `firstOf<F, R>(tuple: readonly [F, ...R]): F`
—— 参数的**形状**直接交出首元素类型,`firstOf(x)` 的返回类型与
`First<typeof x>` 在每个调用点都恒等。学到的元知识:**签名怎么写,
决定类型证明走不走得通**;参数形状里多放信息,比事后 as 更高级。

### 6. Awaited 忘了递归

```ts
❌ export type Awaited<T> = T extends Promise<infer V> ? V : T
```

现象:`Awaited<Promise<Promise<Promise<number>>>>` = `Promise<Promise<number>>`
—— 只剥了一层。必须对 V **再来一次**:`Awaited<V>`。递归条件类型
是"剥到不是 Promise 为止"的循环写法,终止条件就是 false 分支的 `T`。

### 7. 简单版 Awaited + `return await input`(本 day 最深的一个坑,实测)

```ts
❌ type Awaited<T> = T extends Promise<infer V> ? Awaited<V> : T
   async function unwrapAll<T>(input: T): Promise<Awaited<T>> {
     return await input   // TS2322: Type 'Awaited<T>' is not assignable to type 'Awaited<T>'(?!)
   }
```

现象(实测,错误码 **TS2322**):报错信息看着自相矛盾 —— 左边是**内置**
Awaited 算出的类型,右边是你的**自定义** Awaited。`await` 的类型由内置
工具计算,而 TS 对"结构不同的两个延迟条件类型"拒绝互证。出路有三条:
① unwrapAll 里加 as 桥接(本 day 禁 as);② 让自定义 Awaited 与 lib
**完全同构**(参考实现的选择,代价是 thenable 分支里保留两个推断脚手架
`any`);③ 不用 `return await`,改运行时 while 循环 —— 但返回处还是要 as。
理解这个坑的价值:知道"await 的类型是内置算的、你的类型工具管不到它",
以及**条件类型的相等是结构性的,不是语义性的**。

### 8. unwrapAll 的返回类型写成 Promise<T>

```ts
❌ async function unwrapAll<T>(input: T): Promise<T> { ... }
```

现象:能编译,但调用处 `await unwrapAll(Promise.resolve(Promise.resolve('chip')))`
拿到 `Promise<string>`(签名说的)却声称是 `Promise<Promise<string>>`……
说反了 —— 签名会说输入是 `Promise<Promise<string>>` 时输出还是它,
而运行时 await 早就拍平了。类型在**撒谎**:调用方以为还要再 await。
`Promise<Awaited<T>>` 才是把"await 拍平一切"写进签名的方式。
(同理 `return input` 不带 await,配 `Promise<Awaited<T>>` 会报 TS2322
—— T 不 assignable to Awaited<T>,这道报错其实是类型系统在帮你。)

### 9. hasPermission 里手滑一个 as

```ts
❌ export function hasPermission(p: Permission): boolean {
     return (PERMISSIONS as readonly string[]).includes(p)
   }
```

现象:编译过了,但参数 p 的类型还收着,`PERMISSIONS` 却被放宽成 string[]
—— 测试 `hasPermission('conversation:delete')` 的 **@ts-expect-error 变
unused(TS2578)**,编译期防线被你亲手拆了。as const 元组的 `includes`
参数类型就是那三个字面量的联合,与 Permission 同型,**零 as 直传**即可。

### 10. 忘了 as const(JSDoc 思考题:为什么它是"一切的前提")

```ts
❌ export const PERMISSIONS = ['conversation:read', 'conversation:write', 'admin:panel']
```

现象:类型是 `string[]` —— 连锁退化全线开始:`Permission` = TupleToUnion<string[]>
= **string**(权限校验形同虚设,TS2578);`First<typeof FORM_FIELDS>` = string
(不是 'title');`Length<...>` = number(不是 3);`concatTuples` 拼不出精确元组。
as const 做了三件事:字面量化(每个元素的类型是字面量不是 string)、
readonly 化(不能 push)、元组化(长度成为类型信息)。没有它,
今天五个工具全部退化成"对 string[] 的包装" —— 元组的一切精确性
都来自定义处的这一个后缀。

## 三、思考题参考答案

### 为什么 `T['length']` 在 `string[]` 上是 number?

元组的长度在**定义时就确定了**,类型系统把它记成一个数字字面量属性
(`readonly length: 3`);普通数组的长度运行时可变,类型系统只能诚实地说
`length: number`。这不是能力缺陷,是"信息在定义处是否存在"的差别 ——
和"为什么 keyof 字面量对象能拿到字面量联合"是同一个道理。

### `[...a, ...b]` 的推断类型和 `Concat<A, B>` 什么关系?需要 as 吗?

**恰好相同,零 as**(实测)。值层的展开表达式和类型层的可变元组语法
是同一套语言设计:TS 推断 `[...a, ...b]` 的类型就是 `[...A, ...B]`。
README 允许在 concatTuples 加 as 注释,但正解根本用不上 ——
需要 as 的场景(见错误 5 的 firstOf)是"类型系统证明不了"的场景,
这里一切都能证明。

### 为什么 unwrapAll 的返回类型是 `Promise<Awaited<T>>` 而不是 `Promise<T>`?

见常见错误 8:Promise<T> 会对嵌套 Promise 输入撒谎。深层原因:async 函数
的 return 会自动把值包进 Promise,而 **await 的类型语义就是内置 Awaited**
—— 拍平所有 thenable 层。签名 `Promise<Awaited<T>>` 是"这个函数的行为
与 await 同构"的忠实声明。顺带:运行时 JS 的 Promise 解决过程也会递归
采纳 thenable,所以 `return await input` 一行就把任意嵌套剥到底,
类型层和运行时在这一个表达式里完全对齐。

### (附)thenable 与 Promise 的关系

thenable = "任何带 then 方法的对象"(Promise 是最常见实现,fetch 的
Response、一些库的 lazy promise 都是)。内置 Awaited 匹配的是 thenable
形状而不是 Promise 构造类型,所以参考实现照做 —— 这也是它能与
`await` 的内置计算同构的原因之一(见错误 7)。

## 四、验收自查清单

- [ ] `pnpm check:day 24` 通过（类型检查 + 运行时测试）
- [ ] 五个类型工具:类型层面零 as;两个 `any` 只出现在 Awaited 的
      thenable 推断脚手架里(若你用了简单版 Awaited,unwrapAll 的 as 必须带注释)
- [ ] `First<[]>` = never;`Length<string[]>` = number;`TupleToUnion<string[]>` = string
- [ ] `Concat` 产出 readonly 元组;`concatTuples` 用 `[...a, ...b]` 零 as
- [ ] `Awaited` 四条类型断言全过(单层/嵌套/联合/透传)
- [ ] `unwrapAll` 运行时解出 'chip' 和 42,类型分别是 string / number
- [ ] `hasPermission('conversation:delete')` 与 `PERMISSIONS.push('x')` 的
      @ts-expect-error 精准命中(无 TS2578)
- [ ] 所有 export 有 JSDoc + `@example`,回答了"为什么 as const 是前提"
