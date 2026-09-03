/**
 * Day 3 — 类型守卫基础:typeof / in / instanceof + 可辨识联合收窄
 *
 * 学习目标:
 *   1. typeof 收窄原始值,记住 typeof null === 'object' 陷阱
 *   2. switch 判别符收窄(复习 Day 1)+ in 收窄无判别符的联合
 *   3. instanceof 收窄类实例,理解"子类必须排在父类前面"
 *
 * 规则:
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 零 as —— 所有收窄靠守卫,不靠断言
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 1 — 事件模型(可辨识联合)
// =============================================================

// TODO: StreamEvent —— 四种分支的可辨识联合,判别符 kind(见 README 字段表)
export type StreamEvent = never // ← 替换

// =============================================================
// Part 1 — typeof 收窄 unknown
// =============================================================

/**
 * 对完全未知的数据做兜底描述(渲染 unknown 数据的第一道防线)
 *
 * JSDoc 里回答:为什么 null 必须在 typeof === 'object' 之前判断?
 *
 * @example
 *   describePrimitive('hi')  // => '文本(hi)'
 *   describePrimitive(NaN)   // => '非数'
 *   describePrimitive(null)  // => '空'
 */
export function describePrimitive(value: unknown): string {
  // TODO: typeof 分流,注意 null 陷阱和 NaN 分流
  void value
  throw new Error('TODO')
}

// =============================================================
// Part 2 — 判别符收窄 + in 收窄
// =============================================================

// TODO: LegacyFrame —— 无判别符的旧协议联合(见 README)
export type LegacyFrame = never // ← 替换

/**
 * 渲染流事件(消息列表用)
 *
 * @example
 *   renderEvent({ kind: 'text', content: '你好' })  // => '文本:你好'
 *   renderEvent({ kind: 'done', reason: 'stop' })   // => '正常结束'
 */
export function renderEvent(event: StreamEvent): string {
  // TODO: switch (event.kind) + never 穷尽检查
  void event
  throw new Error('TODO')
}

/**
 * 渲染旧协议帧 —— 没有 kind 判别符,只能靠 in
 *
 * @example
 *   renderLegacyFrame({ data: 'blob', ts: 1 })      // => '数据(blob)'
 *   renderLegacyFrame({ payload: 'json', ts: 2 })   // => '载荷(json)'
 */
export function renderLegacyFrame(frame: LegacyFrame): string {
  // TODO: 'data' in frame 分支收窄
  void frame
  throw new Error('TODO')
}

/**
 * 把 unknown 的时间值格式化成 ISO 字符串(instanceof 主场)
 *
 * @example
 *   formatTimestamp(new Date(0))          // => '1970-01-01T00:00:00.000Z'
 *   formatTimestamp('2026-01-01T00:00:00Z') // => '2026-01-01T00:00:00Z'(原样)
 *   formatTimestamp(1710000000000)        // => '2024-03-09T16:00:00.000Z'
 *   formatTimestamp(false)                // => '未知时间'
 */
export function formatTimestamp(v: unknown): string {
  // TODO: instanceof Date / typeof string / typeof number / 兜底
  void v
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:从测试反推签名(下面的占位签名是错的!)
// =============================================================

/**
 * 把 unknown 的异常分类为错误码字符串。
 *
 * 签名自己设计 —— 从 solution.test.ts 的 expectTypeOf 断言反推:
 * 参数收什么?返回值的字面量联合是哪几个成员?
 *
 * JSDoc 里回答:为什么 SyntaxError / TypeError / RangeError 必须在 Error 之前判断?
 *
 * @example
 *   classifyError(new SyntaxError('x'))  // => 'syntax'
 *   classifyError('oops')                // => 'not-error'
 */
export function classifyError(e: never): never {
  // TODO: 占位签名是错的,从测试反推;注意 instanceof 的判断顺序
  void e
  throw new Error('TODO')
}
