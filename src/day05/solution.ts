/**
 * Day 5 — 泛型函数 + extends 约束(K extends keyof T)
 *
 * 学习目标:
 *   1. 泛型函数:firstOf —— T 由调用方推断
 *   2. K extends keyof T:键被约束住,值类型 T[K] 跟着键走
 *   3. 泛型构造对象:pick(认识 TS 的泛型构造限制)/ updateAt(零 as 的不可变更新)
 *
 * 规则:
 *   - 唯一允许的 as 只能在 pick 内部一次,且注释说明原因
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 1 — 业务类型 + 第一个泛型
// =============================================================

// TODO: ConversationSummary —— 会话摘要(字段见 README)
export type ConversationSummary = never // ← 替换

/**
 * 取数组第一个元素
 *
 * JSDoc 里回答:为什么返回类型必须是 T | undefined?
 *
 * @example
 *   firstOf([1, 2, 3])   // => 1,类型 number | undefined
 *   firstOf([] as number[])  // => undefined
 */
export function firstOf<T>(items: readonly T[]): T | undefined {
  // TODO: 一行,注意 items[0] 在 noUncheckedIndexedAccess 下的类型
  void items
  throw new Error('TODO')
}

/**
 * 类型安全取值 —— K extends keyof T 拦住不存在的键,T[K] 让返回类型跟着键走
 *
 * @example
 *   getValue(conv, 'title')         // 类型 string
 *   getValue(conv, 'tags')          // 类型 string[]
 *   getValue(conv, 'not-exist')     // 编译报错
 */
export function getValue<T, K extends keyof T>(source: T, key: K): T[K] {
  // TODO: 一行;JSDoc 里解释索引访问类型 T[K]
  void source
  void key
  throw new Error('TODO')
}

// =============================================================
// Part 2 — 泛型构造新对象
// =============================================================

/**
 * 挑选若干字段组成新对象(列表页投影)
 *
 * @example
 *   pick(conv, ['id', 'title'])  // => { id: 'c1', title: '...' },类型 Pick<ConversationSummary, 'id' | 'title'>
 */
export function pick<T, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  // TODO: 循环塞值;允许内部唯一一次 as(注释说明为什么躲不开)
  void source
  void keys
  throw new Error('TODO')
}

/**
 * 不可变更新:返回新对象,原对象不动(零 as)
 *
 * @example
 *   updateAt(conv, 'messageCount', 10)
 *   // => { ...conv, messageCount: 10 },类型还是 ConversationSummary
 *   updateAt(conv, 'messageCount', 'x')  // 编译报错:值类型必须对上 T['messageCount']
 */
export function updateAt<T, K extends keyof T>(source: T, key: K, value: T[K]): T {
  // TODO: 对象展开 + 计算键,不碰原对象
  void source
  void key
  void value
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:从测试反推签名(下面的占位签名是错的!)
// =============================================================

/**
 * 批量取字段 —— 表格列渲染的核心工具。
 *
 * 签名自己设计 —— 从 solution.test.ts 反推:
 * 传 'title' / 'pinned' / 'tags' 分别返回什么类型?约束怎么写?
 *
 * @example
 *   pluck(convs, 'title')   // => ['关于部署', '周报草稿'],类型 string[]
 *   pluck(convs, 'pinned')  // 类型 boolean[]
 */
export function pluck(items: never, key: never): never {
  // TODO: 占位签名是错的,从测试反推
  void items
  void key
  throw new Error('TODO')
}
