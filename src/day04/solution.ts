/**
 * Day 4 — 自定义类型守卫(is 谓词)+ unknown 安全解析
 *
 * 学习目标:
 *   1. is 谓词:x is T 把"验证"和"收窄"绑定,替代 as
 *   2. 嵌套 unknown 逐层验证:isRecord 地基 + 数组 every + 谓词复用
 *   3. 泛型 + 谓词参数:让守卫驱动泛型 T 的流动(decodeJson)
 *
 * 规则:
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 零 as —— 数据来自外部,断言不值钱,检查才值钱
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 1 — 最小守卫积木
// =============================================================

/**
 * 最小的 is 谓词 —— 演示"验证"与"收窄"的绑定:
 * 返回 true 的分支里,TS 把 value 当 string 用,不再需要任何断言。
 * 注意:谓词是"声明即真相",TS 不检查实现有没有撒谎 —— 守卫必须自己写对。
 *
 * @example
 *   const v: unknown = 'hi'
 *   if (isString(v)) {
 *     v.length  // 这里 v 已经是 string,不是 unknown
 *   }
 */
export function isString(value: unknown): value is string {
  if (typeof value === 'string') {
    return true
  }
  return false
}

/**
 * 判断值是不是"普通对象" —— 一切对象守卫的地基:
 * 把 unknown 先收窄成 Record<string, unknown>,后续字段验证才有落脚点。
 * 必须排除 null(typeof null === 'object' 陷阱,Day 3)和数组
 * (typeof [] 也是 'object',但字段验证对数组没有意义)。
 * 收窄后字段仍是 unknown —— 没有免费午餐,要逐字段验证。
 *
 * @example
 *   isRecord({})        // => true
 *   isRecord([])        // => false(数组不是 record)
 *   isRecord(null)      // => false(null 陷阱!)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return true
  }
  return false
}

// =============================================================
// Part 2 — 业务类型 + 嵌套验证
// =============================================================

/**
 * 草稿消息 —— 对话中的一条消息。
 * 两个 role 共享完全相同的字段结构,所以 role 用字段级联合而非拆分支:
 * 拆分支的收益来自"分支结构不同"(对比 Day 1 三种通知),这里拆了没有增益。
 *
 * @example
 *   const m: DraftMessage = { role: 'user', content: '怎么回滚' }
 */
export type DraftMessage = { role: 'user' | 'assistant'; content: string }

/**
 * 对话草稿 —— 存入 localStorage 的完整形状。
 * 来源不可信(上个版本的残留 / 手改的 DevTools),所以入口必须有 isChatDraft 验证。
 *
 * @example
 *   const d: ChatDraft = {
 *     title: '部署讨论',
 *     updatedAt: '2026-09-03T10:00:00Z',
 *     messages: [{ role: 'user', content: '怎么回滚' }],
 *   }
 */
export type ChatDraft = {
  title: string
  updatedAt: string
  messages: DraftMessage[]
}

/**
 * 解析结果 —— Result<T, E>(Day 2)在解析场景的变体。
 * 失败分支带 reason: string 而非 error: E:解析失败没有结构化的错误对象,
 * 只有"为什么失败"的一句话(null / JSON 坏 / 形状不对),用宽 string 足够。
 *
 * @typeParam T - 解析成功时的值类型
 * @example
 *   const ok: Parsed<number[]> = { ok: true, value: [1, 2] }
 *   const bad: Parsed<number[]> = { ok: false, reason: 'JSON 解析失败' }
 */
export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string }

/**
 * 存储的最小接口 —— 依赖注入:loadDraft 只要求"有 getItem 的东西"。
 * 真实页面传 localStorage,测试传假对象(node 环境没有 localStorage);
 * 不依赖全局,测试才能喂构造好的数据。
 *
 * @example
 *   const fake: StorageLike = { getItem: () => null }
 */
export type StorageLike = {
  getItem(key: string): string | null
}

/**
 * 验证单条草稿消息 —— isRecord 收窄地基 + 字段逐个验证。
 * role 是闭集:任何 user/assistant 之外的值(system、拼错的)都拒绝。
 *
 * @example
 *   isDraftMessage({ role: 'user', content: '怎么回滚' })   // => true
 *   isDraftMessage({ role: 'system', content: 'x' })        // => false(role 闭集)
 */
export function isDraftMessage(value: unknown): value is DraftMessage {
  if (isRecord(value) && isString(value.role) && isString(value.content)) {
    return value.role === 'user' || value.role === 'assistant'
  }
  return false
}

/**
 * 验证完整草稿 —— 嵌套数组必须 every 逐元素验证。
 *
 * 为什么不能只验长度或第一个元素:坏元素可能藏在任何位置
 * (测试用例:第一个元素合法、第二个是 {} —— 只验首元素会放行);
 * 且本仓库开启 noUncheckedIndexedAccess,守卫之后的索引访问
 * 才能是"必为合法元素"的世界。every(isDraftMessage) 直接传函数引用,
 * 谓词签名 (v: unknown) => boolean 恰好是 every 需要的形状。
 *
 * @example
 *   isChatDraft({ title: '部署', updatedAt: '2026-09-03T00:00:00Z', messages: [] })  // => true
 *   isChatDraft({ title: '部署', updatedAt: '2026-09-03T00:00:00Z', messages: [{}] }) // => false
 */
export function isChatDraft(value: unknown): value is ChatDraft {
  if (
    isRecord(value) &&
    isString(value.title) &&
    isString(value.updatedAt) &&
    Array.isArray(value.messages)
  ) {
    return value.messages.every(isDraftMessage)
  }
  return false
}

/**
 * 从注入的存储里安全加载草稿 —— 一条流水线,三道关卡:
 * getItem 为 null(没存过)→ JSON.parse 抛异常(不是 JSON)→
 * isChatDraft 不通过(是 JSON 但不是草稿)→ 全过才返回值。
 * catch 到的异常类型是 unknown(Day 3),但这里无需检查它是什么 ——
 * 无论抛的是什么,结论都是"解析失败"这一个 reason。
 *
 * @example
 *   loadDraft({ getItem: () => null }, 'draft')
 *   // => { ok: false, reason: '没有草稿' }
 */
export function loadDraft(
  storage: StorageLike,
  key: string,
): Parsed<ChatDraft> {
  const row = storage.getItem(key)
  if (row === null) {
    return { ok: false, reason: '没有草稿' }
  }
  try {
    const parsed = JSON.parse(row)
    if (isChatDraft(parsed)) {
      return { ok: true, value: parsed }
    } else {
      return { ok: false, reason: '形状不对' }
    }
  } catch (e) {
    return { ok: false, reason: 'JSON 解析失败' }
  }
}

// =============================================================
// Part 3 — 边界:泛型 + 谓词参数
// =============================================================

/**
 * JSON 字符串 + 守卫 = 安全解析器 —— loadDraft 的泛化:
 * loadDraft 把守卫写死成 isChatDraft(专用),decodeJson 把守卫做成参数(通用)。
 *
 * T 由守卫驱动:调用时实参谓词 (v: unknown) => v is number[] 与形参
 * (value: unknown) => value is T 模式匹配,T 推断为 number[],
 * 返回类型随之实例化为 Parsed<number[]>。
 *
 * 为什么普通布尔函数 (v: unknown) => boolean 不能当守卫传:
 * 布尔值不携带收窄信息 —— "真"只说明通过,不说明值是什么类型;
 * is T 是带类型结论的契约,真分支里 value 收窄为 T。
 * 若允许传布尔函数,{ ok: true, value: parsed } 里 parsed 仍是 unknown,编译不过。
 *
 * @typeParam T - 由守卫谓词驱动的目标类型
 * @example
 *   decodeJson('[1,2]', isNumberArray)   // => { ok: true, value: [1,2] },类型 Parsed<number[]>
 *   decodeJson('oops', isNumberArray)    // => { ok: false, reason: 'JSON 解析失败' }
 */
export function decodeJson<T>(
  raw: string,
  guard: (value: unknown) => value is T,
): Parsed<T> {
  try {
    const parsed = JSON.parse(raw)
    if (guard(parsed)) {
      return { ok: true, value: parsed }
    } else {
      return { ok: false, reason: '校验未通过' }
    }
  } catch (e) {
    return { ok: false, reason: 'JSON 解析失败' }
  }
}
