/**
 * Day 30 — 总复盘:30 天核心考点自查
 *
 * 学习目标:
 *   1. 判别联合 / never 穷尽 / 泛型约束 / 条件类型 / infer /
 *      映射类型 / 模板字面量 / unknown vs any / 守卫 / satisfies —— 全过一遍
 *   2. 不只是答对:每题写一句"为什么"(人工判卷项)
 *
 * 规则:
 *   - 判断题答案写成 true / false 字面量类型
 *   - 求值题答案写求值结果类型;动手题自己实现(不用 as、不用内置 Partial)
 *   - 每题下方注释写一句解释,贴给 AI 点评
 */

// =============================================================
// 🟢 快问快答
// =============================================================

/**
 * Q1:判别联合收窄 —— shape.kind === 'circle' 内访问 shape.r 能编译吗?
 * 解释:____(一句话)
 *
 * @example
 *   type Answer = Q1 // 期望 true / false
 */
export type Q1 = never // ← 替换为 true 或 false

/**
 * Q2:宽 string 判别符 —— const _exhaustive: never = shape 还能通过编译吗?
 * 解释:____
 *
 * @example
 *   type Answer = Q2 // 期望 true / false
 */
export type Q2 = never // ← 替换为 true 或 false

/**
 * Q3:泛型约束 —— first([42]) 能编译吗(T extends { id: string })?
 * 解释:____
 *
 * @example
 *   type Answer = Q3 // 期望 true / false
 */
export type Q3 = never // ← 替换为 true 或 false

/**
 * Q4:条件类型 + 模板字面量 —— 'todoList' extends `${string}List` ? 1 : 0
 * 解释:____
 *
 * @example
 *   type Answer = Q4 // 期望 1 或 0
 */
export type Q4 = never // ← 替换为 1 或 0

// =============================================================
// 🟡 判断 + 动手
// =============================================================

/**
 * Q5(动手):Unwrap<T> —— Promise 挖一层;不是 Promise 给 never。
 * 解释(为什么 infer 只挖一层):____
 *
 * @example
 *   Unwrap<Promise<number>>          // => number
 *   Unwrap<Promise<Promise<string>>> // => Promise<string>
 */
export type Unwrap<T> = never // ← 替换

/**
 * Q6:unknown —— u.foo 会编译报错吗?
 * 解释:____
 *
 * @example
 *   type Answer = Q6 // true = 会报错
 */
export type Q6 = never // ← 替换为 true 或 false

/**
 * Q7:any —— a.foo.bar() 会编译报错吗?
 * 解释:____
 *
 * @example
 *   type Answer = Q7 // true = 会报错
 */
export type Q7 = never // ← 替换为 true 或 false

/**
 * Q8(动手):MyPartial<T> —— 不用内置 Partial,可选化所有属性。
 * 解释(映射类型的 ? 修饰符):____
 *
 * @example
 *   MyPartial<{ id: string; done: boolean }> // => { id?: string; done?: boolean }
 */
export type MyPartial<T> = never // ← 替换

// =============================================================
// 🔴 边界
// =============================================================

/**
 * Q9(动手):Greet<S> —— 加 hello- 前缀的模板字面量类型。
 * 解释:____
 *
 * @example
 *   Greet<'todo'> // => 'hello-todo'
 */
export type Greet<S extends string> = never // ← 替换

/**
 * Q10:keyof ({ a; b } & { b; c }) = ?
 * 解释(keyof 交叉 = 并,对比 keyof 联合 = 交):____
 *
 * @example
 *   type Answer = Q10 // 期望具体的键联合
 */
export type Q10 = never // ← 替换为键联合

/**
 * Q11:as const + satisfies 能让 cfg.port 是字面量 3000 且整体校验通过吗?
 * 解释(satisfies 与类型注解的区别):____
 *
 * @example
 *   type Answer = Q11 // 期望 true / false
 */
export type Q11 = never // ← 替换为 true 或 false

/**
 * Q12:typeof (['a','b'] as const) = ?
 * 解释(readonly 元组):____
 *
 * @example
 *   type Answer = Q12 // 期望 readonly 元组类型
 */
export type Q12 = never // ← 替换为 readonly 元组类型

/**
 * Q13(动手):unknown 的类型守卫 —— 判断"纯数字数组"。
 * 注意 noUncheckedIndexedAccess:遍历元素时带上 undefined 一起挡。
 * 解释(predicate 收窄的原理):____
 *
 * @example
 *   isNumberList([1, 2])   // => true
 *   isNumberList([1, '2']) // => false
 */
export function isNumberList(value: unknown): value is number[] {
  void value
  throw new Error('TODO')
}

/**
 * Q14:Omit<Cat | Dog, 'id'> 是 { meow } | { bark } 的联合吗?
 * 解释(keyof 联合 = 交集,所以 Omit 掉 id 后剩不下东西):____
 *
 * @example
 *   type Answer = Q14 // 期望 true / false
 */
export type Q14 = never // ← 替换为 true 或 false
