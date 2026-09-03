import { describe, it, expect, expectTypeOf } from 'vitest'
import { formatEvent, defineRoutes } from './solution.js'
import type {
  EventMap,
  EventEnvelope,
  Handler,
  ChipRegistry,
} from './solution.js'

// =============================================================
// Part 1 — 映射表 + 判别联合
// =============================================================

describe('Day 6 — Part 1 EventMap / EventEnvelope', () => {
  it('EventMap 是事件名到载荷的映射', () => {
    expectTypeOf<EventMap>().toEqualTypeOf<{
      'chip:run': { chipId: string; arg: string }
      'chip:done': { chipId: string; durationMs: number }
      'chip:error': { chipId: string; message: string }
    }>()
  })

  it('EventEnvelope 是带 name 判别符的联合', () => {
    expectTypeOf<EventEnvelope>().toEqualTypeOf<
      | { name: 'chip:run'; payload: { chipId: string; arg: string } }
      | { name: 'chip:done'; payload: { chipId: string; durationMs: number } }
      | { name: 'chip:error'; payload: { chipId: string; message: string } }
    >()
  })
})

// =============================================================
// Part 2 — formatEvent / Handler / satisfies
// =============================================================

describe('Day 6 — Part 2 formatEvent', () => {
  it('三分支渲染正确', () => {
    expect(formatEvent({ name: 'chip:run', payload: { chipId: 'c1', arg: 'deploy' } })).toBe(
      '[chip:run] c1(deploy)',
    )
    expect(formatEvent({ name: 'chip:done', payload: { chipId: 'c1', durationMs: 5 } })).toBe(
      '[chip:done] c1 耗时 5ms',
    )
    expect(formatEvent({ name: 'chip:error', payload: { chipId: 'c1', message: '超时' } })).toBe(
      '[chip:error] c1:超时',
    )
  })

  it('载荷和事件名对不上,编译报错', () => {
    // @ts-expect-error —— chip:done 的载荷没有 message 字段
    formatEvent({ name: 'chip:done', payload: { chipId: 'c1', message: 'x' } })
  })

  it('事件名不在映射表里,编译报错', () => {
    // @ts-expect-error —— chip:cancel 不在 EventMap 里
    formatEvent({ name: 'chip:cancel', payload: { chipId: 'c1' } })
  })
})

describe('Day 6 — Part 2 Handler(默认类型参数)', () => {
  it('指定事件:参数类型精确收窄', () => {
    expectTypeOf<Handler<'chip:done'>>().toEqualTypeOf<
      (name: 'chip:done', payload: { chipId: string; durationMs: number }) => void
    >()
  })

  it('裸用:走默认参数,变全事件处理器', () => {
    expectTypeOf<Handler>().toEqualTypeOf<
      (name: keyof EventMap, payload: EventMap[keyof EventMap]) => void
    >()
  })

  it('全事件处理器实际可用', () => {
    const seen: string[] = []
    const onAny: Handler = (name, payload) => {
      seen.push(name)
      void payload
    }
    onAny('chip:run', { chipId: 'c1', arg: 'x' })
    onAny('chip:error', { chipId: 'c1', message: 'm' })
    expect(seen).toEqual(['chip:run', 'chip:error'])
  })
})

describe('Day 6 — Part 2 satisfies 对比实验(核心概念题)', () => {
  it('satisfies:结构查了,字面量保住', () => {
    const config = { retries: 3, logLevel: 'debug' } satisfies ChipRegistry
    expect(config.retries).toBe(3)
    expect(config.logLevel).toBe('debug')
    expectTypeOf(config.logLevel).toEqualTypeOf<'debug'>()
  })

  it('注解:结构查了,字面量拓宽', () => {
    const annotated: ChipRegistry = { retries: 3, logLevel: 'debug' }
    expectTypeOf(annotated.logLevel).toEqualTypeOf<'debug' | 'info' | 'error'>()
  })

  it('satisfies 不是 as const:结构不对照样报错', () => {
    // @ts-expect-error —— retries 应为 number,传了 string
    const badConfig = { retries: 'three', logLevel: 'debug' } satisfies ChipRegistry
    void badConfig
  })
})

// =============================================================
// Part 3 — defineRoutes(签名反推)
// =============================================================

describe('Day 6 — Part 3 defineRoutes(const 类型参数)', () => {
  it('出参保留全部字面量类型', () => {
    const routes = defineRoutes({ home: { path: '/' }, chip: { path: '/chip', lazy: true } })
    expect(routes.home.path).toBe('/')
    expectTypeOf(routes.home.path).toEqualTypeOf<'/'>()
    expectTypeOf(routes.chip.path).toEqualTypeOf<'/chip'>()
    expectTypeOf(routes.chip.lazy).toEqualTypeOf<true>()
  })

  it('字面量约束的同时,path 类型检查仍然生效', () => {
    // @ts-expect-error —— path 必须是 string
    defineRoutes({ home: { path: 123 } })
  })

  it('运行时结构原样返回(注册函数不偷改数据)', () => {
    const routes = defineRoutes({ home: { path: '/' } })
    expect(routes).toEqual({ home: { path: '/' } })
  })
})
