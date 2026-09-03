/**
 * Day 19 — 条件类型 + infer 基础:composable 类型萃取工具箱
 *
 * 学习目标:
 *   1. 条件类型的"模式匹配"心智模型:infer 是 extends 子句里挖的洞
 *   2. 五个萃取器:数组元素 / 函数返回值 / 函数参数 / 首参 / Promise 值
 *   3. 组合运用:withCache 的签名完全由自制工具拼出
 *
 * 规则:
 *   - 不允许 any;never[] 约束是 any-free 的万能函数约束
 *   - 所有 export 必须有 JSDoc + @example
 *   - 思考题的回答写进各类型 JSDoc
 */

// =============================================================
// 业务数据(已给出,不是考点)
// =============================================================

/**
 * 用户实体 —— 列表页展示的最小字段
 *
 * @example
 *   const u: User = { id: 'u1', name: '张三', role: 'editor' }
 */
export type User = {
  id: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
}

/**
 * 分页元信息
 *
 * @example
 *   const p: Pagination = { page: 1, pageSize: 20, total: 0 }
 */
export type Pagination = {
  page: number
  pageSize: number
  total: number
}

/**
 * 分页包装(Day 2 的 Paged 在本场景的本地版本,当天自包含)
 *
 * @example
 *   const page: Paged<User> = { items: [], pagination: { page: 1, pageSize: 20, total: 0 } }
 */
export type Paged<T> = {
  items: T[]
  pagination: Pagination
}

// =============================================================
// 🟢 Part 1 — ElementOf:从数组提元素
// =============================================================

// TODO: ElementOf —— 从数组类型提取元素类型
// 规格:ElementOf<string[]> = string
//       ElementOf<readonly number[]> = number(约束必须保留 readonly,想想为什么)
//       ElementOf<readonly ['a', 'b']> = 'a' | 'b'
// 提示:数组模式是"元素位置有个洞";readonly 数组和可变数组是两种模式,readonly 写在洞的外面
export type ElementOf<T extends readonly unknown[]> = never & T // ← 替换(never & T 恒等于 never,写 & T 只是让骨架通过 noUnusedParameters 检查)

// =============================================================
// 🟡 Part 2 — ReturnOf / UnwrapPromise
// =============================================================

// TODO: ReturnOf —— 自实现 ReturnType(禁直接用内置)
// 规格:ReturnOf<() => string> = string
//       ReturnOf<(q: string) => Promise<Paged<User>>> = Promise<Paged<User>>(不剥壳)
// JSDoc 必须回答:约束里的 never[] 为什么能收下任意函数?(参数逆变 + never 是底类型)
export type ReturnOf<T extends (...args: never[]) => unknown> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: UnwrapPromise —— 剥一层 Promise 壳(非递归!)
// 规格:UnwrapPromise<Promise<User>> = User
//       UnwrapPromise<Promise<Promise<User>>> = Promise<User>(只剥一层,为什么?)
//       UnwrapPromise<User> = User(非 Promise 原样透传,字面量不变宽)
export type UnwrapPromise<T> = never & T // ← 替换(never & T 恒等于 never,见上)

// =============================================================
// 🔴 Part 3 — ParamsOf / FirstParamOf / withCache
// =============================================================

// TODO: ParamsOf —— 自实现 Parameters,参数列表收成元组
// 规格:ParamsOf<(q: string, page: number) => void> = [string, number]
//       ParamsOf<() => void> = []
// 提示:洞挖在参数位,(...args: infer P) 一次收下整个参数列表
export type ParamsOf<T extends (...args: never[]) => unknown> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: FirstParamOf —— 只取第一个参数
// 规格:FirstParamOf<(q: string, page: number) => void> = string
//       FirstParamOf<() => void> = unknown(边界观察,写进 JSDoc)
// 陷阱:ParamsOf<T>[0] 在 noUncheckedIndexedAccess 下会多出 undefined,而且那是索引访问不是模式匹配
export type FirstParamOf<T extends (...args: never[]) => unknown> = never & T // ← 替换(never & T 恒等于 never,见上)

/**
 * 给异步函数加"参数 → 结果"内存缓存
 *
 * 签名自己设计(从 solution.test.ts 反推):
 *   - 参数:任意"返回 Promise 的函数"
 *   - 返回:参数列表与原函数相同、返回 Promise<已解析值> 的新函数
 *   - 返回类型必须引用 ParamsOf / ReturnOf / UnwrapPromise,不许手抄具体类型
 *
 * @example
 *   const cached = withCache(fetchPagedUsers)
 *   await cached('chip')  // (q: string) => Promise<Paged<User>>,同参第二次命中缓存
 */
export function withCache(fn: never): never {
  // TODO: 实现"同参数 → 同一引用结果"的缓存;缓存 key 用 JSON.stringify(args)
  void fn
  throw new Error('TODO')
}
