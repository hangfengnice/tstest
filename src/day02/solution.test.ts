import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import { renderState, mapResult, unwrapOr } from './solution.js'
import type {
  OmitResult,
  Conversation,
  Pagination,
  Paged,
  ApiError,
  RequestState,
  Result,
} from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const conv: Conversation = {
  id: 'c1',
  title: '关于部署的讨论',
  updatedAt: '2026-09-03T09:00:00Z',
  messageCount: 3,
}

const pagedEmpty: Paged<Conversation> = {
  items: [],
  pagination: { page: 1, pageSize: 20, total: 0 },
}

const pagedTwo: Paged<Conversation> = {
  items: [conv, conv],
  pagination: { page: 1, pageSize: 20, total: 2 },
}

const okNum: Result<number, ApiError> = { ok: true, data: 42 }
const errNum: Result<number, ApiError> = {
  ok: false,
  error: { code: 500, message: '服务器开小差了' },
}

// =============================================================
// Part 0 — 复验 Day 1 结论
// =============================================================

describe('Day 2 — Part 0 复验实验', () => {
  it('实验 1:Omit<联合, Keys> = 各分支 Omit 后的交集,只剩 { body }', () => {
    // Day 1 结论由你自己验证 —— 如果这条过了,说明结论成立
    expectTypeOf<OmitResult>().toEqualTypeOf<{ body: string }>()
  })
})

// =============================================================
// Part 1 — 类型规格(从这里反推签名)
// =============================================================

describe('Day 2 — Part 1 业务数据 + 泛型', () => {
  it('Conversation 形状正确', () => {
    expectTypeOf<Conversation>().toEqualTypeOf<{
      id: string
      title: string
      updatedAt: string
      messageCount: number
    }>()
  })

  it('Pagination 形状正确', () => {
    expectTypeOf<Pagination>().toEqualTypeOf<{
      page: number
      pageSize: number
      total: number
    }>()
  })

  it('Paged<Conversation> 展开为 { items, pagination }', () => {
    expectTypeOf<Paged<Conversation>>().toEqualTypeOf<{
      items: Conversation[]
      pagination: Pagination
    }>()
  })

  it('Paged<T> 是泛型:换 T 后 items 类型跟着变', () => {
    expectTypeOf<Paged<string>>().toEqualTypeOf<{
      items: string[]
      pagination: Pagination
    }>()
  })
})

// =============================================================
// Part 2 — RequestState / Result / renderState
// =============================================================

describe('Day 2 — Part 2 请求状态建模', () => {
  it('RequestState<T> 是四态可辨识联合', () => {
    expectTypeOf<RequestState<number>>().toEqualTypeOf<
      | { status: 'idle' }
      | { status: 'loading' }
      | { status: 'success'; data: number }
      | { status: 'error'; error: ApiError }
    >()
  })

  it('Result<T, E> 是两态可辨识联合', () => {
    expectTypeOf<Result<string, ApiError>>().toEqualTypeOf<
      { ok: true; data: string } | { ok: false; error: ApiError }
    >()
  })

  it('idle 态不存在 data(可辨识联合收窄保护)', () => {
    const idle: RequestState<Paged<Conversation>> = { status: 'idle' }
    // @ts-expect-error —— idle 分支不存在 data
    const d = idle.data
    void d
  })

  it('loading 态不存在 error', () => {
    const loading: RequestState<Paged<Conversation>> = { status: 'loading' }
    // @ts-expect-error —— loading 分支不存在 error
    const e = loading.error
    void e
  })

  it('renderState 四态渲染', () => {
    expect(renderState({ status: 'idle' })).toBe('还没有对话')
    expect(renderState({ status: 'loading' })).toBe('加载中…')
    expect(renderState({ status: 'success', data: pagedTwo })).toBe('共 2 个对话')
    expect(renderState({ status: 'success', data: pagedEmpty })).toBe('共 0 个对话')
    expect(
      renderState({ status: 'error', error: { code: 500, message: '服务器开小差了' } }),
    ).toBe('出错了(500):服务器开小差了')
  })
})

// =============================================================
// Part 3 — 泛型组合子
// =============================================================

describe('Day 2 — Part 3 mapResult', () => {
  it('成功分支:data 被 fn 转换,E 透传', () => {
    const mapped = mapResult(okNum, (n) => `共 ${n} 条`)
    expect(mapped).toEqual({ ok: true, data: '共 42 条' })
    expectTypeOf(mapped).toEqualTypeOf<Result<string, ApiError>>()
  })

  it('失败分支:原样透传,fn 不被调用', () => {
    const fn = vi.fn((n: number) => n + 1)
    const mapped = mapResult(errNum, fn)
    expect(mapped).toBe(errNum)
    expect(fn).not.toHaveBeenCalled()
  })

  it('fn 的参数类型由 T 决定(传错回调编译报错)', () => {
    // @ts-expect-error —— data 是 number,不能当 string 用
    mapResult(okNum, (s: string) => s.length)
  })
})

describe('Day 2 — Part 3 unwrapOr', () => {
  it('成功返回 data', () => {
    expect(unwrapOr(okNum, 0)).toBe(42)
    expectTypeOf(unwrapOr(okNum, 0)).toEqualTypeOf<number>()
  })

  it('失败返回 fallback', () => {
    expect(unwrapOr(errNum, -1)).toBe(-1)
  })

  it('fallback 类型必须与 T 一致', () => {
    // @ts-expect-error —— T 是 number,fallback 不能传 string
    unwrapOr(okNum, 'zero')
  })
})