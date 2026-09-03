import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import {
  isChatEventName,
  isMessagePayload,
  isTypingPayload,
  isDonePayload,
  isErrorPayload,
  createChatBus,
} from './solution.js'
import type {
  MyExtract,
  MyExclude,
  MyReturnType,
  MyParameters,
  ChatEventMap,
  ChatEventName,
  ChatBus,
} from './solution.js'
import type { Notification, EmailNotification } from '../day01/solution.js'

// =============================================================
// 测试数据
// =============================================================

// Day 1 的 Notification 在这里二次登场:阶段闭环
type ExtractedEmail = MyExtract<Notification, { type: 'email' }>

function makeBus(name: string, retries: number, strict: boolean) {
  return { name, retries, strict }
}

// =============================================================
// Part 1 — MyExtract / MyExclude(条件类型 + 分发)
// =============================================================

describe('Day 8 — Part 1 MyExtract / MyExclude', () => {
  it('MyExtract 挑出可赋给 U 的成员', () => {
    expectTypeOf<MyExtract<'a' | 'b' | 'c', 'b' | 'c'>>().toEqualTypeOf<'b' | 'c'>()
    expectTypeOf<MyExtract<string | number, string>>().toEqualTypeOf<string>()
  })

  it('MyExtract 用在 Day 1 的联合上(阶段闭环)', () => {
    expectTypeOf<ExtractedEmail>().toEqualTypeOf<EmailNotification>()
  })

  it('MyExclude 踢掉可赋给 U 的成员', () => {
    expectTypeOf<MyExclude<'a' | 'b' | 'c', 'c'>>().toEqualTypeOf<'a' | 'b'>()
    expectTypeOf<MyExclude<ChatEventName, 'error'>>().toEqualTypeOf<'message' | 'typing' | 'done'>()
  })

  it('分发只发生在裸类型参数上(测试替你记住)', () => {
    // 联合包进数组后,条件类型不再按成员分发 —— 这就是"分布式"的边界
    expectTypeOf<MyExtract<['a' | 'b'], ['a' | 'b']>>().toEqualTypeOf<['a' | 'b']>()
  })
})

// =============================================================
// Part 2 — MyReturnType / MyParameters(infer)
// =============================================================

describe('Day 8 — Part 2 MyReturnType / MyParameters', () => {
  it('MyReturnType 抠出返回值类型', () => {
    expectTypeOf<MyReturnType<typeof makeBus>>().toEqualTypeOf<{
      name: string
      retries: number
      strict: boolean
    }>()
    expectTypeOf<MyReturnType<() => ChatEventName>>().toEqualTypeOf<ChatEventName>()
  })

  it('MyParameters 抠出参数元组', () => {
    expectTypeOf<MyParameters<typeof makeBus>>().toEqualTypeOf<[string, number, boolean]>()
    expectTypeOf<MyParameters<(a: string, b?: number) => void>>().toEqualTypeOf<
      [a: string, b?: number]
    >()
  })

  it('非函数类型传不进来', () => {
    // @ts-expect-error —— MyParameters 只收函数类型
    expectTypeOf<MyParameters<string>>()
  })
})

// =============================================================
// Part 3 — 事件总线(综合)
// =============================================================

describe('Day 8 — Part 3 守卫', () => {
  it('isChatEventName:闭集判断', () => {
    expect(isChatEventName('message')).toBe(true)
    expect(isChatEventName('typing')).toBe(true)
    expect(isChatEventName('done')).toBe(true)
    expect(isChatEventName('error')).toBe(true)
    expect(isChatEventName('nope')).toBe(false)
    expect(isChatEventName(123)).toBe(false)
  })

  it('isChatEventName 收窄后可当 ChatEventName 用', () => {
    const v: unknown = 'done'
    if (!isChatEventName(v)) throw new Error('应当是合法事件名')
    expectTypeOf(v).toEqualTypeOf<ChatEventName>()
  })

  it('载荷守卫:形状逐字段验', () => {
    expect(isMessagePayload({ text: 'hi', at: 1 })).toBe(true)
    expect(isMessagePayload({ text: 'hi' })).toBe(false)
    expect(isMessagePayload({ text: 'hi', at: '1' })).toBe(false)
    expect(isTypingPayload({ userId: 'u1' })).toBe(true)
    expect(isTypingPayload({ userId: 1 })).toBe(false)
    expect(isDonePayload({ reason: 'stop' })).toBe(true)
    expect(isDonePayload({ reason: 'bad' })).toBe(false)
    expect(isErrorPayload({ message: 'x' })).toBe(true)
    expect(isErrorPayload(null)).toBe(false)
  })
})

describe('Day 8 — Part 3 createChatBus', () => {
  it('on / emit:载荷类型跟着事件名走', () => {
    const bus = createChatBus()
    const handler = vi.fn((p: ChatEventMap['message']) => p.text)
    bus.on('message', handler)
    bus.emit('message', { text: '你好', at: 1 })
    expect(handler).toHaveBeenCalledWith({ text: '你好', at: 1 })
  })

  it('on 的回调参数类型自动锁死', () => {
    const bus = createChatBus()
    bus.on('typing', (p) => {
      expectTypeOf(p).toEqualTypeOf<{ userId: string }>()
    })
  })

  it('off:取消订阅后不再收到', () => {
    const bus = createChatBus()
    const handler = vi.fn()
    const off = bus.on('done', handler)
    bus.emit('done', { reason: 'stop' })
    expect(handler).toHaveBeenCalledTimes(1)
    off()
    bus.emit('done', { reason: 'stop' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('多个处理器按注册顺序都收到', () => {
    const bus = createChatBus()
    const order: string[] = []
    bus.on('error', () => order.push('first'))
    bus.on('error', () => order.push('second'))
    bus.emit('error', { message: 'x' })
    expect(order).toEqual(['first', 'second'])
  })

  it('emit 类型错误直接编译报错', () => {
    const bus = createChatBus()
    // 包一层永不调用的函数:类型反例只进编译器,不进运行时
    // (运行时传 'nope' 会真的炸 —— 类型系统挡住的东西,运行时没有任何保护)
    const badCalls = () => {
      // @ts-expect-error —— message 载荷缺 at
      bus.emit('message', { text: 'hi' })
      // @ts-expect-error —— 事件名不在表里
      bus.emit('nope', { anything: true })
    }
    void badCalls
  })

  it('on 的 handler 参数类型错也报错', () => {
    const bus = createChatBus()
    // @ts-expect-error —— typing 载荷是 { userId: string },不是 { wrong: true }
    bus.on('typing', (p: { wrong: true }) => void p)
  })
})

describe('Day 8 — Part 3 emitRaw(unknown 入口)', () => {
  it('合法数据:验证通过并转发给处理器', () => {
    const bus = createChatBus()
    const handler = vi.fn()
    bus.on('message', handler)
    expect(bus.emitRaw('message', { text: '外部数据', at: 5 })).toBe(true)
    expect(handler).toHaveBeenCalledWith({ text: '外部数据', at: 5 })
  })

  it('未知事件名:false', () => {
    const bus = createChatBus()
    expect(bus.emitRaw('nope', {})).toBe(false)
  })

  it('载荷缺字段:false 且不触发任何处理器', () => {
    const bus = createChatBus()
    const handler = vi.fn()
    bus.on('message', handler)
    expect(bus.emitRaw('message', { text: '缺 at' })).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('载荷字段类型错:false', () => {
    const bus = createChatBus()
    expect(bus.emitRaw('message', { text: 'hi', at: '1' })).toBe(false)
    expect(bus.emitRaw('error', { message: 123 })).toBe(false)
  })

  it('reason 闭集外的值:false', () => {
    const bus = createChatBus()
    const handler = vi.fn()
    bus.on('done', handler)
    expect(bus.emitRaw('done', { reason: 'timeout' })).toBe(false)
    expect(handler).not.toHaveBeenCalled()
    expect(bus.emitRaw('done', { reason: 'length' })).toBe(true)
    expect(handler).toHaveBeenCalledWith({ reason: 'length' })
  })

  it('返回值是精确的 ChatBus(不是它的子集)', () => {
    expectTypeOf(createChatBus()).toEqualTypeOf<ChatBus>()
  })
})
