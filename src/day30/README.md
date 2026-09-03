# Day 30 — 总复盘:30 天核心考点自查(快问快答)

## 项目说明

30 天到这里收官。今天不是新知识,是**自查**:14 个小任务,每个 2-3 分钟,覆盖四个阶段的核心考点。判断题看一眼就能答,但**每道题都要求你在 `solution.ts` 的注释里写一句"为什么"** —— 测试只判类型答案,解释题在对话里由我人工点评(这才是复盘的重点)。

### 判卷规则

- **测试自动判卷**:`expectTypeOf` 断言 Q1-Q14 的答案类型,Q13 另有运行时断言
- **人工判卷**:每题的"为什么"注释。判断题答对但解释写不出来的,算没掌握

### 考点覆盖表

| 题号 | 考点 | 阶段 |
|---|---|---|
| Q1 / Q2 | 判别联合收窄 / never 穷尽检查 | 一(Day 1) |
| Q3 | 泛型约束 `extends` | 二(Day 5 附近) |
| Q4 | 条件类型 + 模板字面量模式匹配 | 三 |
| Q5 | `infer` 推导 | 三 |
| Q6 / Q7 | unknown vs any | 一/二 |
| Q8 | 映射类型手写 Partial | 三 |
| Q9 | 模板字面量类型 | 三(Day 27 用过) |
| Q10 | keyof 与交叉类型 | 二 |
| Q11 | `satisfies` 与窄化 | 四 |
| Q12 | `as const` | 二/三 |
| Q13 | 类型守卫(动手 + 运行时) | 二(Day 28/29 实战) |
| Q14 | `Omit` 作用于联合的陷阱 | 二(Day 2 踩过的坑) |

## 任务

> 每题的代码片段只在这里读,不要粘贴进 solution.ts;把答案写在对应的 `Qn` 导出里。
> 判断题:`true` / `false`;求值题:写出求值结果的类型。

### 🟢 快问快答(判断 + 求值)

**Q1(判别联合收窄)**
```ts
type Shape = { kind: 'circle'; r: number } | { kind: 'square'; s: number }
declare const shape: Shape
if (shape.kind === 'circle') {
  shape.r.toFixed(2) // ← 这行能编译通过吗?
}
```
答案写 `true`(能)/ `false`(不能)。

**Q2(宽 string 判别符)**
```ts
type Shape = { kind: string; r?: number; s?: number }
declare const shape: Shape
switch (shape.kind) {
  case 'circle': break
  case 'square': break
  default: {
    const _exhaustive: never = shape // ← 这行能编译通过吗(穷尽检查还生效吗)?
  }
}
```

**Q3(泛型约束)**
```ts
function first<T extends { id: string }>(items: readonly T[]): T | undefined {
  return items[0]
}
first([42]) // ← 这行能编译通过吗?
```

**Q4(条件类型 + 模板字面量求值)**
```ts
type R = 'todoList' extends `${string}List` ? 1 : 0
```
`R` 是 `1` 还是 `0`?答案写成字面量类型。

### 🟡 判断 + 动手

**Q5(动手:infer)** —— 写 `Unwrap<T>`:Promise 挖一层,取出包裹的类型;不是 Promise 给 `never`。
```ts
Unwrap<Promise<number>>        // => number
Unwrap<Promise<Promise<string>>> // => Promise<string>(只挖一层)
Unwrap<string>                 // => never
```

**Q6(unknown)** `declare const u: unknown; u.foo` —— 这行**会**编译报错吗?(`true` = 会报错)

**Q7(any)** `declare const a: any; a.foo.bar()` —— 这行**会**编译报错吗?(`true` = 会报错)
> Q6/Q7 一起体会:unknown 把"我不知道"暴露给你逼你收窄,any 把检查器关掉 —— 同样"存不了类型信息",态度相反。

**Q8(动手:映射类型)** —— 不用内置 `Partial`,手写 `MyPartial<T>`(可选化所有属性)。
```ts
MyPartial<{ id: string; done: boolean }> // => { id?: string; done?: boolean }
```

### 🔴 边界

**Q9(动手:模板字面量)** —— 写 `Greet<S extends string>`:
```ts
Greet<'todo'>  // => 'hello-todo'
Greet<'day30'> // => 'hello-day30'
```

**Q10(求值:keyof 与交叉)**
```ts
type Keys = keyof ({ a: 1; b: 2 } & { b: 3; c: 4 })
```
`Keys` 是什么?提示:keyof 交叉 = 两边键的**并**;对比 Q14 的 Omit 陷阱(那是 keyof 联合 = **交**)。

**Q11(satisfies)** 下面写法能让 `cfg.port` 的类型是**字面量 `3000`**,且整体仍通过 `Record<string, number>` 校验吗?
```ts
const cfg = { port: 3000 } as const satisfies Record<string, number>
```
(`true` = 能)。对比:写成 `const cfg: Record<string, number> = { port: 3000 }` 时 `cfg.port` 只是 `number`。

**Q12(求值:as const)**
```ts
const arr = ['a', 'b'] as const
type Arr = typeof arr
```
`Arr` 是什么?(注意元组与 readonly)

**Q13(动手:类型守卫)** —— 写 `isNumberList(value: unknown): value is number[]`:空数组、纯数字数组返回 `true`;混入字符串/null/嵌套数组/非数组一律 `false`。注意 `noUncheckedIndexedAccess`,遍历时元素带 `undefined`,守卫里要一并挡掉。

**Q14(Omit 联合陷阱)**
```ts
type Cat = { id: string; meow: () => void }
type Dog = { id: string; bark: () => void }
type Pet = Omit<Cat | Dog, 'id'>
```
`Pet` 是 `{ meow: () => void } | { bark: () => void }` 这样的联合吗?(`true` = 是)。
> 这是 Day 2 亲手验证过的坑:Omit 先对联合取 `keyof` —— 而 keyof 联合 = 各成员键的**交集**,只剩 `'id'`,Omit 掉之后什么都剩不下。

## 验收清单

- [ ] Q1-Q14 类型答案测试全绿,Q13 运行时断言全绿
- [ ] 每题的"为什么"注释写了一句话(人工判卷项)
- [ ] `pnpm typecheck` 中 day30 错误清零;初始红全部来自 never 占位 / throw TODO
- [ ] 动手题(Q5/Q8/Q9/Q13)不用 as、不用内置 Partial

## 写完后

贴 `solution.ts` 说"判卷 + 点评"。我会:逐题对答案 → 抽 3 题让你口头解释 → 给出"30 天掌握度雷达"(判别联合 / 泛型 / 条件类型 / 映射类型 / 守卫 / 严格模式)和下一步建议。
