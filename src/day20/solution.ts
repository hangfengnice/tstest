/**
 * Day 20 — 分布式条件类型 + infer 进阶:订单筛选器的联合运算
 *
 * 学习目标:
 *   1. 分布式条件类型:裸类型参数遇到联合会拆开逐个加工再合并
 *   2. 用 [T] 阻止分布:整体一次性比较
 *   3. infer 在元组位置:去头、收尾
 *   4. 模板字面量的天生分布式(Day 22 的地基,今天先见一面)
 *
 * 规则:
 *   - 不允许 any;tail 运行时允许恰好 1 处 as(带注释)
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// 业务数据(已给出,不是考点)
// =============================================================

/**
 * 订单状态机的五个状态
 *
 * @example
 *   const s: OrderStatus = 'pending'
 */
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'

/**
 * 筛选值联合 —— 来自 URL(string)/ 本地(number)/ 开关(boolean)/ 未设置(null | undefined)
 *
 * @example
 *   const v: FilterValue = 'chip'
 */
export type FilterValue = string | number | boolean | null | undefined

// =============================================================
// 🟢 Part 1 — TypeName / DropEmpty(分布式初体验)
// =============================================================

// TODO: TypeName —— 给联合的每个成员打类型标签(嵌套条件类型)
// 规格:TypeName<FilterValue> = 'string' | 'number' | 'boolean' | 'null' | 'undefined'
//       TypeName<'a' | 1>    = 'string' | 'number'(分布式证据:两个标签!)
//       TypeName<never>      = never(空联合短路)
// 提示:else 分支里继续 extends;null / undefined 要各写一个分支
export type TypeName<T> = never & T // ← 替换(never & T 恒等于 never,写 & T 只是让骨架通过 noUnusedParameters 检查)

// TODO: DropEmpty —— 自实现 NonNullable,剔除 null | undefined
// 规格:DropEmpty<string | null | undefined> = string
//       DropEmpty<FilterValue> = string | number | boolean
// JSDoc 必须回答:null / undefined 成员去哪了?(never 在联合中被吸收 —— 下一题的钥匙)
export type DropEmpty<T> = never & T // ← 替换(never & T 恒等于 never,见上)

// =============================================================
// 🟡 Part 2 — ExcludeOwn / Tail / StatusBadge
// =============================================================

// TODO: ExcludeOwn —— 自实现 Exclude,一行
// 规格:ExcludeOwn<'view' | 'edit' | 'delete', 'edit' | 'delete'> = 'view'
// JSDoc 必须回答:它和 DropEmpty 是不是只差"判断条件"?
export type ExcludeOwn<T, U> = never & T & U // ← 替换(never & T & U 恒等于 never,见上)

// TODO: Tail —— 元组去头
// 规格:Tail<[1, 2, 3]> = [2, 3];Tail<['a']> = [];Tail<[]> = []
//       Tail<string[]> = [](普通数组不是"至少一个元素的元组")
//       Tail<readonly ['a', 'b']> = ['b'](readonly 元组也要能进)
// 提示:模式 [unknown, ...infer Rest];readonly 要写在模式的对的位置
export type Tail<T extends readonly unknown[]> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: StatusBadge —— 状态联合批量变成徽章对象联合
// 规格:StatusBadge<'pending' | 'paid'> = { status: 'pending' } | { status: 'paid' }
// 提示:true 分支里直接使用 T 本身 —— 分布式已保证此刻 T 是单个成员
export type StatusBadge<T> = never & T // ← 替换(never & T 恒等于 never,见上)

/**
 * 元组去头的运行时实现
 *
 * @example
 *   tail([1, 2, 3])  // [2, 3]
 *   tail([])         // []
 */
export function tail(tuple: never): never {
  // TODO: 签名自己设计(从 solution.test.ts 反推):泛型 T 约束到元组,返回类型用 Tail<T>
  //       实现用 slice(1);允许恰好 1 处 as,注释解释为什么收不窄
  void tuple
  throw new Error('TODO')
}

// =============================================================
// 🔴 Part 3 — IsText / GetEndpoint
// =============================================================

// TODO: IsText —— 整体判断"是不是纯文本筛选值"(要阻止分布!)
// 规格:IsText<string> = true
//       IsText<'a' | 'b'> = true(整体仍是 string)
//       IsText<'a' | 1>   = false ← 分水岭!裸参数版会得到 boolean
//       IsText<never>     = true(空联合包进元组后就是普通类型)
// JSDoc 必须回答:裸参数版为什么得到 boolean?[T] 怎么阻止分布?never 为什么是 true?
export type IsText<T> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: GetEndpoint —— 资源名 → REST 端点(一个条件类型都不用写)
// 规格:GetEndpoint<'user' | 'order'> = '/api/user' | '/api/order'
// JSDoc 必须回答:没写条件类型,联合为什么还是被分布了?
export type GetEndpoint<T extends string> = never & T // ← 替换(never & T 恒等于 never,见上)
