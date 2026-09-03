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
 * 判断值是不是 string —— 最小的 is 谓词
 *
 * @example
 *   const v: unknown = 'hi'
 *   if (isString(v)) {
 *     v.length  // 这里 v 已经是 string,不是 unknown
 *   }
 */
export function isString(value: unknown): value is string {
  // TODO: 一行 typeof
  void value
  throw new Error('TODO')
}

/**
 * 判断值是不是"普通对象"(非 null、非数组)
 * —— 一切对象守卫的地基:先用它把 unknown 收窄成 Record<string, unknown>
 *
 * @example
 *   isRecord({})        // => true
 *   isRecord([])        // => false(数组不是 record)
 *   isRecord(null)      // => false(null 陷阱!)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  // TODO: typeof object + 非 null + 非数组
  void value
  throw new Error('TODO')
}

// =============================================================
// Part 2 — 业务类型 + 嵌套验证
// =============================================================

// TODO: DraftMessage —— { role: 'user' | 'assistant'; content: string }
export type DraftMessage = never // ← 替换

// TODO: ChatDraft —— { title: string; updatedAt: string; messages: DraftMessage[] }
export type ChatDraft = never // ← 替换

// TODO: Parsed<T> —— { ok: true; value: T } | { ok: false; reason: string }
export type Parsed<T> = never // ← 替换

// TODO: StorageLike —— { getItem(key: string): string | null }(依赖注入,别用全局 localStorage)
export type StorageLike = never // ← 替换

/**
 * 验证单条草稿消息
 *
 * @example
 *   isDraftMessage({ role: 'user', content: '怎么回滚' })   // => true
 *   isDraftMessage({ role: 'system', content: 'x' })        // => false(role 闭集)
 */
export function isDraftMessage(value: unknown): value is DraftMessage {
  // TODO: isRecord + isString 拼装,role 精确到两个字面量
  void value
  throw new Error('TODO')
}

/**
 * 验证完整草稿(嵌套数组逐个元素验证)
 *
 * JSDoc 里回答:为什么验证 messages 数组不能只验长度或第一个元素?
 *
 * @example
 *   isChatDraft({ title: '部署', updatedAt: '2026-09-03T00:00:00Z', messages: [] })  // => true
 *   isChatDraft({ title: '部署', updatedAt: '2026-09-03T00:00:00Z', messages: [{}] }) // => false
 */
export function isChatDraft(value: unknown): value is ChatDraft {
  // TODO: isRecord + 逐字段 + Array.isArray + every(isDraftMessage)
  void value
  throw new Error('TODO')
}

/**
 * 从注入的存储里安全加载草稿(三段失败原因见 README)
 *
 * @example
 *   loadDraft({ getItem: () => null }, 'draft')
 *   // => { ok: false, reason: '没有草稿' }
 */
export function loadDraft(storage: StorageLike, key: string): Parsed<ChatDraft> {
  // TODO: null → JSON.parse(catch unknown!)→ isChatDraft → 成功
  void storage
  void key
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:泛型 + 谓词参数(下面的占位签名是错的!)
// =============================================================

/**
 * JSON 字符串 + 守卫 = 安全解析器。
 *
 * 签名自己设计 —— 从 solution.test.ts 反推:
 *   - 泛型参数放哪?守卫参数的类型怎么写?
 *   - Parsed<T> 的 T 怎么跟着守卫流动?
 *
 * 失败 reason:'JSON 解析失败' / '校验未通过'
 *
 * @example
 *   decodeJson('[1,2]', isNumberArray)   // => { ok: true, value: [1,2] },类型 Parsed<number[]>
 *   decodeJson('oops', isNumberArray)    // => { ok: false, reason: 'JSON 解析失败' }
 */
export function decodeJson(raw: never, guard: never): never {
  // TODO: 占位签名是错的,从测试反推
  void raw
  void guard
  throw new Error('TODO')
}
