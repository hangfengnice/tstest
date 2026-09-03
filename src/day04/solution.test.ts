import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  isString,
  isRecord,
  isDraftMessage,
  isChatDraft,
  loadDraft,
  decodeJson,
} from './solution.js'
import type {
  DraftMessage,
  ChatDraft,
  Parsed,
  StorageLike,
} from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const msgUser: DraftMessage = { role: 'user', content: '怎么回滚' }
const msgBot: DraftMessage = { role: 'assistant', content: 'git revert' }

const validDraft = {
  title: '部署讨论',
  updatedAt: '2026-09-03T10:00:00Z',
  messages: [msgUser, msgBot],
}
const validDraftJson = JSON.stringify(validDraft)

// 测试自带的守卫:给 decodeJson 喂第二种谓词,证明它是泛型的
const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'number')

// 假 localStorage:依赖注入,不碰全局
const makeStorage = (data: Record<string, string>): StorageLike => ({
  getItem: (key) => {
    const v = data[key]
    return v === undefined ? null : v
  },
})

// =============================================================
// Part 1 — 最小守卫积木
// =============================================================

describe('Day 4 — Part 1 isString / isRecord', () => {
  it('isString 之后 v 收窄为 string(is 谓词的价值)', () => {
    const v: unknown = 'hello'
    if (!isString(v)) throw new Error('应当是 string')
    expectTypeOf(v).toEqualTypeOf<string>()
    expect(v.length).toBe(5)
  })

  it('isRecord:对象为真,数组 / null / 原始值为假', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('str')).toBe(false)
    expect(isRecord(42)).toBe(false)
  })

  it('isRecord 之后字段仍是 unknown(没有免费午餐,要逐字段验)', () => {
    const v: unknown = { a: 1 }
    if (isRecord(v)) {
      expectTypeOf(v).toEqualTypeOf<Record<string, unknown>>()
      expectTypeOf(v.a).toEqualTypeOf<unknown>()
    }
  })
})

// =============================================================
// Part 2 — 嵌套验证 + loadDraft
// =============================================================

describe('Day 4 — Part 2 isDraftMessage / isChatDraft', () => {
  it('合法消息', () => {
    expect(isDraftMessage({ role: 'user', content: 'hi' })).toBe(true)
    expect(isDraftMessage({ role: 'assistant', content: 'hi' })).toBe(true)
  })

  it('role 是闭集,content 必须是 string', () => {
    expect(isDraftMessage({ role: 'system', content: 'hi' })).toBe(false)
    expect(isDraftMessage({ role: 'user', content: 123 })).toBe(false)
    expect(isDraftMessage(null)).toBe(false)
  })

  it('完整草稿:嵌套数组逐元素验证', () => {
    expect(isChatDraft(validDraft)).toBe(true)
    expect(
      isChatDraft({
        title: '部署讨论',
        updatedAt: '2026-09-03T10:00:00Z',
        messages: [msgUser, { role: 'system', content: 'x' }],
      }),
    ).toBe(false)
    // 只验长度或首元素会漏掉:后面的元素坏也要拦
    expect(
      isChatDraft({ title: 't', updatedAt: 'x', messages: [{ role: 'user', content: 'ok' }, {}] }),
    ).toBe(false)
    expect(isChatDraft({ title: 't', updatedAt: 'x', messages: 'not-array' })).toBe(false)
  })

  it('isChatDraft 通过后,value 收窄为 ChatDraft(属性直接可用)', () => {
    const v: unknown = validDraft
    if (!isChatDraft(v)) throw new Error('应当是合法草稿')
    expectTypeOf(v).toEqualTypeOf<ChatDraft>()
    expect(v.title).toBe('部署讨论')
  })
})

describe('Day 4 — Part 2 loadDraft(三段失败原因)', () => {
  it('没有草稿:getItem 返回 null', () => {
    const r = loadDraft(makeStorage({}), 'draft')
    expect(r).toEqual({ ok: false, reason: '没有草稿' })
  })

  it('不是合法 JSON:catch 住异常', () => {
    const r = loadDraft(makeStorage({ draft: 'not-json{{' }), 'draft')
    expect(r).toEqual({ ok: false, reason: 'JSON 解析失败' })
  })

  it('形状不对:字段类型不匹配', () => {
    const r = loadDraft(
      makeStorage({ draft: '{"title":"t","updatedAt":123,"messages":[]}' }),
      'draft',
    )
    expect(r).toEqual({ ok: false, reason: '形状不对' })
  })

  it('合法草稿:ok true + 完整值', () => {
    const r = loadDraft(makeStorage({ draft: validDraftJson }), 'draft')
    expect(r).toEqual({ ok: true, value: validDraft })
    expectTypeOf(r).toEqualTypeOf<Parsed<ChatDraft>>()
  })
})

// =============================================================
// Part 3 — decodeJson(签名反推)
// =============================================================

describe('Day 4 — Part 3 decodeJson(泛型 + 谓词参数)', () => {
  it('守卫通过:T 跟着守卫走', () => {
    const r = decodeJson('[1,2,3]', isNumberArray)
    expect(r).toEqual({ ok: true, value: [1,2,3] })
    expectTypeOf(r).toEqualTypeOf<Parsed<number[]>>()
  })

  it('守卫不通过:校验未通过', () => {
    expect(decodeJson('{"a":1}', isNumberArray)).toEqual({ ok: false, reason: '校验未通过' })
  })

  it('JSON 坏:解析失败', () => {
    expect(decodeJson('oops', isNumberArray)).toEqual({ ok: false, reason: 'JSON 解析失败' })
  })

  it('换一个守卫,T 换一个类型(复用同一解析器)', () => {
    const r = decodeJson(validDraftJson, isChatDraft)
    expect(r).toEqual({ ok: true, value: validDraft })
    expectTypeOf(r).toEqualTypeOf<Parsed<ChatDraft>>()
  })

  it('普通布尔函数不能当守卫传(必须带 is 谓词)', () => {
    const notGuard = (v: unknown): boolean => typeof v === 'number'
    // @ts-expect-error —— 没有谓词的函数收窄不了类型
    decodeJson('1', notGuard)
  })
})
