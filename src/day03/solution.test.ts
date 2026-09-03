import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  describePrimitive,
  renderEvent,
  renderLegacyFrame,
  formatTimestamp,
  classifyError,
} from './solution.js'
import type { StreamEvent, LegacyFrame } from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const textEvent: StreamEvent = { kind: 'text', content: '你好' }
const toolCallEvent: StreamEvent = { kind: 'tool_call', tool: 'formatter', argsJson: '{"a":1}' }
const toolOkEvent: StreamEvent = { kind: 'tool_result', tool: 'formatter', ok: true }
const toolFailEvent: StreamEvent = { kind: 'tool_result', tool: 'formatter', ok: false }
const doneStopEvent: StreamEvent = { kind: 'done', reason: 'stop' }
const doneLengthEvent: StreamEvent = { kind: 'done', reason: 'length' }
const doneErrorEvent: StreamEvent = { kind: 'done', reason: 'error' }

// =============================================================
// Part 1 — StreamEvent 形状 + typeof 收窄
// =============================================================

describe('Day 3 — Part 1 事件模型', () => {
  it('StreamEvent 是四种分支的可辨识联合', () => {
    expectTypeOf<StreamEvent>().toEqualTypeOf<
      | { kind: 'text'; content: string }
      | { kind: 'tool_call'; tool: string; argsJson: string }
      | { kind: 'tool_result'; tool: string; ok: boolean }
      | { kind: 'done'; reason: 'stop' | 'length' | 'error' }
    >()
  })

  it('不存在的 kind 不能赋值(判别符必须是封闭联合)', () => {
    // @ts-expect-error —— kind 'nope' 不在联合里
    renderEvent({ kind: 'nope', value: 1 })
  })
})

describe('Day 3 — Part 1 describePrimitive(typeof 收窄)', () => {
  it('原始值分流', () => {
    expect(describePrimitive('hi')).toBe('文本(hi)')
    expect(describePrimitive(42)).toBe('数值(42)')
    expect(describePrimitive(true)).toBe('开关(true)')
  })

  it('NaN 单独分流(typeof NaN === "number")', () => {
    expect(describePrimitive(NaN)).toBe('非数')
  })

  it('null / undefined 分流(null 陷阱)', () => {
    expect(describePrimitive(null)).toBe('空')
    expect(describePrimitive(undefined)).toBe('未定义')
  })

  it('对象和数组都落到对象分支', () => {
    expect(describePrimitive({ a: 1 })).toBe('对象')
    expect(describePrimitive([1, 2])).toBe('对象')
  })

  it('测试替你记住:typeof null 和 typeof 数组都是 object', () => {
    const v: unknown = null
    expect(typeof v).toBe('object')
    expect(typeof []).toBe('object')
  })
})

// =============================================================
// Part 2 — 判别符 / in / instanceof 收窄
// =============================================================

describe('Day 3 — Part 2 renderEvent(switch 判别符收窄)', () => {
  it('四种分支渲染正确', () => {
    expect(renderEvent(textEvent)).toBe('文本:你好')
    expect(renderEvent(toolCallEvent)).toBe('调用 formatter({"a":1})')
    expect(renderEvent(toolOkEvent)).toBe('formatter 成功')
    expect(renderEvent(toolFailEvent)).toBe('formatter 失败')
    expect(renderEvent(doneStopEvent)).toBe('正常结束')
    expect(renderEvent(doneLengthEvent)).toBe('因长度结束')
    expect(renderEvent(doneErrorEvent)).toBe('异常结束')
  })

  it('done 分支的 reason 不接受闭集之外的值', () => {
    // @ts-expect-error —— reason 只能是 stop / length / error
    const bad: StreamEvent = { kind: 'done', reason: 'timeout' }
    void bad
  })
})

describe('Day 3 — Part 2 renderLegacyFrame(in 收窄)', () => {
  it('LegacyFrame 是无判别符的二分支联合', () => {
    expectTypeOf<LegacyFrame>().toEqualTypeOf<
      { data: string; ts: number } | { payload: string; ts: number }
    >()
  })

  it('两分支渲染正确', () => {
    expect(renderLegacyFrame({ data: 'blob', ts: 1 })).toBe('数据(blob)')
    expect(renderLegacyFrame({ payload: 'json', ts: 2 })).toBe('载荷(json)')
  })

  it('in 检查后联合被收窄到具体分支', () => {
    // 注意一个细节:const 初始化后,控制流分析已经把类型收窄到 data 分支,
    // 再写 else 分支时 frame 会变成 never —— 所以这里分两个变量测两个方向
    const frameData: LegacyFrame = { data: 'blob', ts: 1 }
    if ('data' in frameData) {
      expectTypeOf(frameData).toEqualTypeOf<{ data: string; ts: number }>()
      expect(frameData.data).toBe('blob')
    }
    const framePayload: LegacyFrame = { payload: 'json', ts: 2 }
    if (!('payload' in framePayload)) throw new Error('payload 分支不可能没有 payload')
    expectTypeOf(framePayload).toEqualTypeOf<{ payload: string; ts: number }>()
  })

  it('unknown 不能直接用 in(先收窄成 object)', () => {
    const v: unknown = { a: 1 }
    // @ts-expect-error —— in 的左侧必须是对象类型,unknown 不行
    const has = 'data' in v
    void has
  })
})

describe('Day 3 — Part 2 formatTimestamp(instanceof 收窄)', () => {
  it('Date 实例 → ISO 字符串', () => {
    expect(formatTimestamp(new Date(0))).toBe('1970-01-01T00:00:00.000Z')
    expect(formatTimestamp(new Date(1710000000000))).toBe('2024-03-09T16:00:00.000Z')
  })

  it('字符串原样返回,数字当毫秒时间戳', () => {
    expect(formatTimestamp('2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00Z')
    expect(formatTimestamp(1710000000000)).toBe('2024-03-09T16:00:00.000Z')
  })

  it('其余类型兜底', () => {
    expect(formatTimestamp(false)).toBe('未知时间')
    expect(formatTimestamp(null)).toBe('未知时间')
    expect(formatTimestamp({})).toBe('未知时间')
  })

  it('instanceof 收窄后方法可安全调用', () => {
    const v: unknown = new Date(0)
    if (v instanceof Date) {
      expectTypeOf(v).toEqualTypeOf<Date>()
      expect(v.getTime()).toBe(0)
    }
  })
})

// =============================================================
// Part 3 — classifyError(从测试反推签名)
// =============================================================

describe('Day 3 — Part 3 classifyError(签名反推)', () => {
  it('返回值是五个成员的字面量联合(不是宽 string)', () => {
    expectTypeOf(classifyError(new Error('x'))).toEqualTypeOf<
      'syntax' | 'type' | 'range' | 'generic' | 'not-error'
    >()
  })

  it('Error 子类各自归位(子类必须先于父类判断)', () => {
    expect(classifyError(new SyntaxError('意外字符'))).toBe('syntax')
    expect(classifyError(new TypeError('不能读 undefined'))).toBe('type')
    expect(classifyError(new RangeError('数组越界'))).toBe('range')
    expect(classifyError(new Error('普通错误'))).toBe('generic')
  })

  it('非 Error 值统一 not-error', () => {
    expect(classifyError('oops')).toBe('not-error')
    expect(classifyError(null)).toBe('not-error')
    expect(classifyError({ code: 500 })).toBe('not-error')
    expect(classifyError(undefined)).toBe('not-error')
  })
})
