/**
 * Day 21 — 映射类型:表单引擎的类型工厂
 *
 * 学习目标:
 *   1. [K in keyof T] 遍历:Partial / Readonly 的母体
 *   2. 修饰符增减:+? / -readonly / -?
 *   3. as 重映射:改键名(RenameKeys)、剔键(as never)
 *   4. 组合运用:toRefsOwn 的 Refs<T> 影子
 *
 * 规则:
 *   - 不允许 any;as 只允许出现在 toRefsOwn(≤2 处,带注释)
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// 业务数据(已给出,不是考点)
// =============================================================

/**
 * 表单维护的用户资料(id 由服务端生成)
 *
 * @example
 *   const u: UserProfile = { id: 'u1', name: '张三', age: 30 }
 */
export type UserProfile = {
  id: string
  name: string
  age: number
  email?: string
}

/**
 * 后端订单(含简写字段,前端要做键名映射)
 *
 * @example
 *   const o: ServerOrder = { desc: '订阅订单', amt: 199, note: '首月免费' }
 */
export type ServerOrder = {
  readonly desc: string
  readonly amt: number
  note: string
}

// =============================================================
// 🟢 Part 1 — MyPartial / MyReadonly
// =============================================================

// TODO: MyPartial —— 自实现 Partial,所有字段变可选
// 规格:MyPartial<{ name: string; age: number }> = { name?: string | undefined; age?: number | undefined }
//       与内置 Partial<T> 完全相等
// JSDoc 必须回答:为什么值列要写 | undefined?(exactOptionalPropertyTypes 下去掉它会怎样?动手验)
export type MyPartial<T> = never & T // ← 替换(never & T 恒等于 never,写 & T 只是让骨架通过 noUnusedParameters 检查)

// TODO: MyReadonly —— 自实现 Readonly,所有字段加 readonly
// 规格:与内置 Readonly<T> 完全相等;readonly 属性赋值必须编译报错
// JSDoc 必须回答:它是"浅只读"—— 嵌套对象内层为什么没被冻结?(DeepReadonly 是 Day 23)
export type MyReadonly<T> = never & T // ← 替换(never & T 恒等于 never,见上)

// =============================================================
// 🟡 Part 2 — Mutable / RequiredAll / Refs
// =============================================================

// TODO: Mutable —— 解除只读(-readonly)
// 规格:Mutable<MyReadonly<UserProfile>> = UserProfile;Mutable<Readonly<{ a: 1 }>> = { a: 1 }
export type Mutable<T> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: RequiredAll —— 全必填(-?)
// 规格:RequiredAll<Partial<{ name; age }>> = { name: string; age: number }(undefined 一并减掉)
//       与内置 Required<Partial<T>> 相等;缺字段必须编译报错
export type RequiredAll<T> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: Refs —— 值包装:每个属性变成 { value: 原值类型 }(Ref<T> 的最小形状)
// 规格:Refs<{ count: number; name: string }> = { count: { value: number }; name: { value: string } }
// 提示:不动修饰符、不动键名,只改值列
export type Refs<T> = never & T // ← 替换(never & T 恒等于 never,见上)

// =============================================================
// 🔴 Part 3 — OmitOwn / RenameKeys / toRefsOwn
// =============================================================

// TODO: OmitOwn —— 用 as 重映射剔键(必须走 as never 路线,不许用 Pick + Exclude 凑)
// 规格:与内置 Omit<T, K> 完全相等;传不存在的键必须编译报错
// 提示:[P in keyof T as P extends K ? never : P] —— as 后面是昨天的条件类型
export type OmitOwn<T, K extends keyof T> = never & T & K // ← 替换(never & T & K 恒等于 never,见上)

// TODO: RenameKeys —— 用 as 重映射改键名,映射表 M 里没有的键保持原名
// 规格:RenameKeys<{ desc: string; amount: number }, { desc: 'description' }>
//       = { description: string; amount: number }
// JSDoc 必须回答:as 子句里的键转换是一个什么类型?
export type RenameKeys<T, M extends Record<string, PropertyKey>> = never & T & M // ← 替换(never & T & M 恒等于 never,见上)

/**
 * mini-reactive 的 toRefs:输入普通对象,输出 Refs<T> 形状
 *
 * 签名自己设计(从 solution.test.ts 反推):
 *   - 参数:任意对象
 *   - 返回:Refs<T>,返回类型必须引用 Refs<T>
 *   - 运行时:每个属性包成 { value: 原值 },不共享原对象引用
 *
 * @example
 *   const refs = toRefsOwn({ count: 1 })
 *   refs.count.value  // 1,类型 { count: { value: number } }
 */
export function toRefsOwn(obj: never): never {
  // TODO: 允许最多 2 处 as(每处注释解释);Object.keys 的 string[] → keyof T 是第一道坎
  void obj
  throw new Error('TODO')
}
