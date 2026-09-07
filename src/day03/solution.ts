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

/**
 * SSE 流事件 —— 对话页流式渲染的核心模型,判别符 kind。
 * 专有字段只存在于各自分支:不存在 "tool_call 却带 reason" 的非法状态,
 * switch 收窄后字段直达,无需 ?. 兜底。
 *
 * @example
 *   const ev: StreamEvent = { kind: 'tool_call', tool: 'formatter', argsJson: '{"a":1}' }
 */
export type StreamEvent =
  | {
      kind: 'text'
      content: string
    }
  | {
      kind: 'tool_call'
      tool: string
      argsJson: string
    }
  | {
      kind: 'tool_result'
      tool: string
      ok: boolean
    }
  | {
      kind: 'done'
      reason: 'stop' | 'length' | 'error'
    }

// =============================================================
// Part 1 — typeof 收窄 unknown
// =============================================================

/**
 * 对完全未知的数据做兜底描述(渲染 unknown 数据的第一道防线)。
 *
 * 为什么 null 必须在 typeof === 'object' 之前判断:
 * JS 的历史 bug —— typeof null === 'object'(1995 年值标签的实现遗留),
 * TS 忠实继承。先判 value === null 才能避免 null 掉进对象分支。
 * 同理,NaN 必须在 typeof === 'number' 内部分流(typeof NaN === 'number',
 * 且 NaN !== NaN 恒真,只能靠内置守卫 Number.isNaN)。
 *
 * @example
 *   describePrimitive('hi')    // => '文本(hi)'
 *   describePrimitive(NaN)     // => '非数'
 *   describePrimitive(null)    // => '空'
 *   describePrimitive(() => 1) // => '对象'(函数按规格归入对象)
 */
export function describePrimitive(value: unknown): string {
  if (value === null) {
    return '空'
  } else if (value === undefined) {
    return '未定义'
  } else if (typeof value === 'string') {
    return `文本(${value})`
  } else if (Number.isNaN(value)) {
    return '非数'
  } else if (typeof value === 'number') {
    return `数值(${value})`
  } else if (typeof value === 'boolean') {
    return `开关(${value})`
  } else if (typeof value === 'object' || typeof value === 'function') {
    // 函数的 typeof 是 'function',不落 'object' 分支 —— 按规格同样归入"对象"
    return '对象'
  } else {
    return '未知' // 留给 bigint / symbol 等规格未定义的原始类型
  }
}

// =============================================================
// Part 2 — 判别符收窄 + in 收窄
// =============================================================

/**
 * 旧协议帧 —— 无判别符的两种帧,靠专有字段 data / payload 的存在性区分。
 * 判断次序即收窄通道:排除 data 分支后,类型系统自动落到 payload 分支。
 *
 * @example
 *   const f: LegacyFrame = { data: 'blob', ts: 1 }
 */
export type LegacyFrame =
  | { data: string; ts: number }
  | { payload: string; ts: number }

/**
 * done 分支 reason → 文案的固定映射(Day 1 精修版同款技能:查表替代嵌套分支)。
 * as const 让值保持字面量;表必须覆盖 reason 全部成员,漏一个索引处就编译报错
 */
const doneText = {
  stop: '正常结束',
  length: '因长度结束',
  error: '异常结束',
} as const

/**
 * 渲染流事件(消息列表用)—— switch 判别符 + never 穷尽检查:
 * 未来新增 kind 而忘记处理时,编译期在 default 处报警。
 *
 * @example
 *   renderEvent({ kind: 'text', content: '你好' })  // => '文本:你好'
 *   renderEvent({ kind: 'done', reason: 'stop' })   // => '正常结束'
 */
export function renderEvent(event: StreamEvent): string {
  switch (event.kind) {
    case 'text':
      return `文本:${event.content}`
    case 'tool_call':
      return `调用 ${event.tool}(${event.argsJson})`
    case 'tool_result':
      return `${event.tool} ${event.ok ? '成功' : '失败'}`
    case 'done':
      return doneText[event.reason]
    default:
      const _exhaustiveCheck: never = event
      return _exhaustiveCheck
  }
}

/**
 * 渲染旧协议帧 —— 没有 kind 判别符,用 in 按字段存在性收窄。
 *
 * 为什么不用 frame.data 判空:联合上直接访问 frame.data 是类型错误
 * (另一分支没有该字段);而 'data' in frame 为真时,类型系统把 frame
 * 收窄到含 data 的分支 —— in 就是"无判别符联合"的判别符。
 *
 * @example
 *   renderLegacyFrame({ data: 'blob', ts: 1 })      // => '数据(blob)'
 *   renderLegacyFrame({ payload: 'json', ts: 2 })   // => '载荷(json)'
 */
export function renderLegacyFrame(frame: LegacyFrame): string {
  if ('data' in frame) {
    return `数据(${frame.data})`
  } else {
    return `载荷(${frame.payload})`
  }
}

/**
 * 把 unknown 的时间值格式化成 ISO 字符串。
 * 三条收窄通道各管一类:instanceof 管类实例、typeof 管原始值、
 * 其余兜底 —— unknown 不可直接使用,守卫是唯一的门。
 *
 * @example
 *   formatTimestamp(new Date(0))            // => '1970-01-01T00:00:00.000Z'
 *   formatTimestamp('2026-01-01T00:00:00Z') // => '2026-01-01T00:00:00Z'(原样)
 *   formatTimestamp(1710000000000)          // => '2024-03-09T16:00:00.000Z'
 *   formatTimestamp(false)                  // => '未知时间'
 */
export function formatTimestamp(v: unknown): string {
  if (v instanceof Date) {
    return v.toISOString()
  } else if (typeof v === 'string') {
    return v
  } else if (typeof v === 'number') {
    return new Date(v).toISOString()
  } else {
    return '未知时间'
  }
}

// =============================================================
// Part 3 — 边界:从测试反推签名
// =============================================================

/**
 * 把 unknown 的异常分类为错误码(catch (e: unknown) 后的第一站)。
 *
 * 为什么 SyntaxError / TypeError / RangeError 必须在 Error 之前判断:
 * instanceof 检查的是整条原型链,子类的原型指向父类 ——
 * new SyntaxError('x') instanceof Error 同样为 true。
 * 先判父类,所有子类都会被父类分支截胡;"子类在前,父类在后"
 * 是 instanceof 判断链的固定次序。
 *
 * 返回值是字面量联合而非宽 string:显式返回注解提供上下文类型,
 * 每个 return 的字面量被检核并保鲜;没有注解时会拓宽成 string
 * (widening,与 let x = 'syntax' 推断为 string 同一机制)。
 *
 * @example
 *   classifyError(new SyntaxError('x'))  // => 'syntax'
 *   classifyError('oops')                // => 'not-error'
 */
export function classifyError(
  e: unknown,
): 'syntax' | 'type' | 'range' | 'generic' | 'not-error' {
  if (e instanceof SyntaxError) {
    return 'syntax'
  } else if (e instanceof TypeError) {
    return 'type'
  } else if (e instanceof RangeError) {
    return 'range'
  } else if (e instanceof Error) {
    return 'generic'
  } else {
    return 'not-error'
  }
}
