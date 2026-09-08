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

/**
 * 会话摘要 —— 列表页单条数据(比 Day 2 的 Conversation 多了 pinned/tags)。
 *
 * @example
 *   const c: ConversationSummary = {
 *     id: 'c1', title: '关于部署', messageCount: 3, pinned: true, tags: ['ci'],
 *   }
 */
export type ConversationSummary = {
  id: string
  title: string
  messageCount: number
  pinned: boolean
  tags: string[]
}

/**
 * 取数组第一个元素。
 *
 * 为什么返回类型必须是 T | undefined:noUncheckedIndexedAccess 下
 * items[0] 的类型就是 T | undefined —— 空数组时运行时返回 undefined,
 * 签名必须诚实反映这个可能。把它写成 T 等于对调用方撒谎,
 * 每个使用点都会被迫用 ! 或 as 还债。
 *
 * @example
 *   firstOf([1, 2, 3])       // => 1,类型 number | undefined
 *   firstOf([] as number[])  // => undefined
 */
export function firstOf<T>(items: readonly T[]): T | undefined {
  return items[0]
}

/**
 * 类型安全取值 —— 两个泛型各司其职:
 * K extends keyof T 把键约束在 T 的合法键内(写错键编译期就红);
 * 返回类型 T[K] 是索引访问类型 —— "T 在 K 处的值的类型",
 * 键不同,返回类型跟着变:getValue(conv, 'title') 是 string,
 * getValue(conv, 'tags') 是 string[]。
 *
 * @example
 *   getValue(conv, 'title')      // 类型 string
 *   getValue(conv, 'tags')       // 类型 string[]
 *   getValue(conv, 'not-exist')  // 编译报错:键被约束拦下
 */
export function getValue<T, K extends keyof T>(source: T, key: K): T[K] {
  return source[key]
}

// =============================================================
// Part 2 — 泛型构造新对象
// =============================================================

/**
 * 挑选若干字段组成新对象(列表页投影)。
 *
 * 本函数含三十天唯一一次合法 as,担保与履约:
 * 初始值 {} 无法被证明满足 Pick<T, K> —— 泛型 T/K 未解析时,
 * TS 放弃证明"动态构造过程"的结果(const r: Pick<T,K> = {} 直接红)。
 * as 担保"空对象经循环逐键塞值后必然满足 Pick<T, K>",由 reduce 循环兑现。
 * 循环体本身完全合法:acc 的类型就是 Pick<T, K>,取赋都是 T[K]。
 *
 * @example
 *   pick(conv, ['id', 'title'])  // => { id: 'c1', title: '...' },类型 Pick<ConversationSummary, 'id' | 'title'>
 */
export function pick<T, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  return keys.reduce(
    (acc, key) => {
      acc[key] = source[key] // acc 已是 Pick<T, K>,此处取/赋类型都是 T[K],合法
      return acc
    },
    // as 只在此担保初始状态:"空箱经塞值后必为 Pick<T, K>"。
    // 它担保的是类型系统表达不了、但运行时必然成立的事实
    {} as Pick<T, K>,
  )
}

/**
 * 不可变更新 —— 返回新对象,原对象不动(Vue 里 reactive 之外的纯数据更新)。
 * 零 as:对象展开 + 计算键在泛型下 TS 能正确处理,展开保住其余字段,
 * [key]: value 的计算键精准覆盖对应属性,返回类型还原为 T。
 * 值参数是 T[K]:键和值的类型被锁在一起,'messageCount' 配 string 直接编译报错。
 *
 * @example
 *   updateAt(conv, 'messageCount', 10)
 *   // => { ...conv, messageCount: 10 },类型还是 ConversationSummary
 *   updateAt(conv, 'messageCount', 'x')  // 编译报错:值类型必须对上 T['messageCount']
 */
export function updateAt<T, K extends keyof T>(
  source: T,
  key: K,
  value: T[K],
): T {
  return { ...source, [key]: value }
}

// =============================================================
// Part 3 — 边界:泛型 + 谓词参数
// =============================================================

/**
 * 批量取字段 —— 表格列渲染的核心工具,getValue + map 的组合:
 * 对每个元素做一次"类型安全取值",收集成数组。
 * K extends keyof T 让列名写错直接编译报错;
 * 返回 T[K][] —— 列的数据类型由键驱动:tags 列是 string[][],
 * 每列类型自动对号入座。
 *
 * @example
 *   pluck(convs, 'title')   // => ['关于部署', '周报草稿'],类型 string[]
 *   pluck(convs, 'pinned')  // 类型 boolean[]
 */
export function pluck<T, K extends keyof T>(
  items: readonly T[],
  key: K,
): T[K][] {
  return items.map((item) => item[key])
}
