/**
 * Day 24 — type-challenges easy 精选:元组操作 + Awaited
 *
 * 学习目标:
 *   1. 元组类型的索引访问、长度字面量、可变元组语法
 *   2. infer 模式匹配(First / Awaited)
 *   3. 递归条件类型(Awaited 解包嵌套 Promise)
 *   4. 类型工具 + 运行时函数配套:调用处值和类型同时正确
 *
 * 题目出处:type-challenges #14 First / #18 Length /
 *          #10 TupleToUnion / #533 Concat / #189 Awaited
 *
 * 规则:
 *   - never 占位处写实现;throw new Error('TODO') 处填逻辑
 *   - 不允许 any、不允许 as
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// 业务常量(脚手架,已给出)—— as const 是今天一切的前提
// =============================================================

/**
 * 权限表 —— 后端约定的全部权限。
 * as const 让它成为 readonly 元组,每个元素都是字面量类型。
 *
 * @example
 *   PERMISSIONS[0]  // 类型是 'conversation:read',不是宽 string
 */
export const PERMISSIONS = [
  'conversation:read',
  'conversation:write',
  'admin:panel',
] as const

/**
 * 权限类型 —— 从 PERMISSIONS 元组**推导**出来,单一事实来源:
 * 后端加权限只改上面一张表,这里自动跟上。
 * (TupleToUnion 未实现前 = never,测试会红)
 *
 * @example
 *   const p: Permission = 'conversation:read'  // ✓
 *   // const bad: Permission = 'conversation:delete'  // ← 编译报错
 */
export type Permission = TupleToUnion<typeof PERMISSIONS>

// =============================================================
// Part 1 — 🟢 First / Length
// =============================================================

/**
 * First<T>(type-challenges #14)—— 取元组第一个元素的类型。
 * 空元组 [] 返回 never。
 *
 * @example
 *   First<['title', 'content', 'tags']>  // => 'title'
 *   First<[]>                            // => never
 */
export type First<T extends readonly unknown[]> = never // ← 替换

/**
 * Length<T>(type-challenges #18)—— 取元组长度的**数字字面量**。
 *
 * @example
 *   Length<['a', 'b', 'c']>  // => 3
 *   Length<string[]>         // => number(非元组退化)
 */
export type Length<T extends readonly unknown[]> = never // ← 替换

/**
 * 取表单第一个字段(运行时)—— 返回类型由 First<T> 决定。
 *
 * @example
 *   firstOf(['title', 'content', 'tags'] as const)  // => 'title',类型 'title'
 */
export function firstOf<T extends readonly unknown[]>(tuple: T): First<T> {
  void tuple
  throw new Error('TODO')
}

/**
 * 取元组长度(运行时)—— 返回类型由 Length<T> 决定。
 *
 * @example
 *   lengthOf(['title', 'content', 'tags'] as const)  // => 3,类型 3
 */
export function lengthOf<T extends readonly unknown[]>(tuple: T): Length<T> {
  void tuple
  throw new Error('TODO')
}

// =============================================================
// Part 2 — 🟡 TupleToUnion / Concat
// =============================================================

/**
 * TupleToUnion<T>(type-challenges #10)—— 元组转联合。
 *
 * @example
 *   TupleToUnion<['a', 'b']>  // => 'a' | 'b'
 *   TupleToUnion<string[]>    // => string
 */
export type TupleToUnion<T extends readonly unknown[]> = never // ← 替换

/**
 * Concat<A, B>(type-challenges #533)—— 拼接两个元组,产出精确的新元组。
 *
 * @example
 *   Concat<readonly ['src'], readonly ['App.vue']>
 *   // => readonly ['src', 'App.vue']
 */
export type Concat<
  A extends readonly unknown[],
  B extends readonly unknown[],
> = never // ← 替换

/**
 * 拼接面包屑两段路径(运行时)—— 返回类型由 Concat<A, B> 决定。
 *
 * @example
 *   concatTuples(['src', 'components'] as const, ['App.vue'] as const)
 *   // => ['src', 'components', 'App.vue'],类型 readonly ['src', 'components', 'App.vue']
 */
export function concatTuples<
  A extends readonly unknown[],
  B extends readonly unknown[],
>(a: A, b: B): Concat<A, B> {
  void a
  void b
  throw new Error('TODO')
}

/**
 * 权限校验 —— 参数类型是 Permission(推导自权限表),
 * 不在表里的权限名在编译期就被拒绝。
 *
 * @example
 *   hasPermission('conversation:read')  // => true
 *   // hasPermission('conversation:delete')  // ← 编译报错
 */
export function hasPermission(p: Permission): boolean {
  void p
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 🔴 Awaited(重新发明内置工具)
// =============================================================

/**
 * Awaited<T>(type-challenges #189)—— 推导 await 之后的值类型。
 * 注意:这里的 export 会遮蔽 TS 内置的 Awaited,我们在重新实现它。
 * 必须**递归**解包:Promise<Promise<T>> 最终是 T。
 *
 * @example
 *   Awaited<Promise<number>>                  // => number
 *   Awaited<Promise<Promise<Promise<number>>>> // => number
 *   Awaited<Promise<string> | number>         // => string | number
 *   Awaited<null>                             // => null(透传)
 */
export type Awaited<T> = never // ← 替换

/**
 * 把任意嵌套的 Promise 解包到最终值(运行时)。
 * 返回类型必须是 Promise<Awaited<T>> —— 想想为什么不能写 Promise<T>。
 *
 * @example
 *   await unwrapAll(Promise.resolve(Promise.resolve('chip')))  // => 'chip',类型 string
 *   await unwrapAll(42)                                        // => 42,类型 number
 */
export function unwrapAll<T>(input: T): Promise<Awaited<T>> {
  void input
  throw new Error('TODO')
}
