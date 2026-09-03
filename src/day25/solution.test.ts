import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  conversationSchema,
  pagedConversationSchema,
  notificationSchema,
  safeParseApi,
  type Conversation,
  type PagedConversations,
  type AppNotification,
  type ParseResult,
} from './solution.js'

// =============================================================
// 原始数据 —— JSON.parse 返回 any,立即用 : unknown 收窄。
// 这就是"网络对端的数据是 unknown"的现实建模,全程不出现 as。
// =============================================================

const rawConversationOk: unknown = JSON.parse(
  '{"id":"c1","title":"部署讨论","updatedAt":"2026-09-03T09:00:00Z","messageCount":3}',
)
const rawConversationBad: unknown = JSON.parse(
  '{"id":123,"title":"部署讨论","updatedAt":"2026-09-03T09:00:00Z","messageCount":"many"}',
)
const rawNotAnObject: unknown = '根本不是对象'
const rawPagedOk: unknown = JSON.parse(
  '{"items":[{"id":"c1","title":"部署讨论","updatedAt":"x","messageCount":1}],"pagination":{"page":1,"pageSize":20,"total":1}}',
)
const rawEmail: unknown = JSON.parse(
  '{"type":"email","id":"n1","subject":"上线通知","to":"a@b.com"}',
)
const rawEmailMissingTo: unknown = JSON.parse(
  '{"type":"email","id":"n1","subject":"上线通知"}',
)
const rawSms: unknown = JSON.parse(
  '{"type":"sms","id":"n2","phone":"13800000000","body":"验证码 1234"}',
)
const rawBadType: unknown = JSON.parse('{"type":"voicemail","id":"n3"}')

// =============================================================
// Part 1 — 🟢 schema + z.infer
// =============================================================

describe('Day 25 — Part 1 第一个 schema', () => {
  it('Conversation 类型由 schema 推导(四字段)', () => {
    expectTypeOf<Conversation>().toEqualTypeOf<{
      id: string
      title: string
      updatedAt: string
      messageCount: number
    }>()
  })

  it('schema 推导的类型不可绕过:缺字段编译报错', () => {
    // @ts-expect-error —— 缺 messageCount,z.infer 推导的类型不接受
    const c: Conversation = { id: 'x', title: 'y', updatedAt: 'z' }
    void c
  })

  it('conversationSchema 运行时:合法数据 safeParse 成功', () => {
    const r = conversationSchema.safeParse(rawConversationOk)
    expect(r.success).toBe(true)
  })

  it('conversationSchema 运行时:类型错误的数据失败', () => {
    const r = conversationSchema.safeParse(rawConversationBad)
    expect(r.success).toBe(false)
  })
})

// =============================================================
// Part 2 — 🟡 嵌套 schema + safeParseApi
// =============================================================

describe('Day 25 — Part 2 safeParseApi', () => {
  it('PagedConversations 嵌套结构推导正确', () => {
    expectTypeOf<PagedConversations>().toEqualTypeOf<{
      items: Conversation[]
      pagination: { page: number; pageSize: number; total: number }
    }>()
  })

  it('ParseResult 是两态可辨识联合(脚手架验证)', () => {
    expectTypeOf<ParseResult<number>>().toEqualTypeOf<
      { ok: true; data: number } | { ok: false; errors: string[] }
    >()
  })

  it('合法数据返回 ok:true,数据带完整类型', () => {
    const r = safeParseApi(conversationSchema, rawConversationOk)
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('应当成功')
    expect(r.data.title).toBe('部署讨论')
    expectTypeOf(r.data).toEqualTypeOf<Conversation>()
  })

  it('字段类型错误返回 ok:false,errors 含出错字段名', () => {
    const r = safeParseApi(conversationSchema, rawConversationBad)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('应当失败')
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors.some((e) => e.includes('id'))).toBe(true)
  })

  it('连对象都不是的输入也安全返回失败(永不抛异常)', () => {
    const r = safeParseApi(conversationSchema, rawNotAnObject)
    expect(r.ok).toBe(false)
  })

  it('嵌套 schema:data 类型完整推导', () => {
    const paged = safeParseApi(pagedConversationSchema, rawPagedOk)
    expect(paged.ok).toBe(true)
    if (!paged.ok) throw new Error('应当成功')
    expect(paged.data.items).toHaveLength(1)
    expect(paged.data.pagination.total).toBe(1)
  })

  it('嵌套 schema 的解析结果类型是 ParseResult<PagedConversations>', () => {
    const r = safeParseApi(pagedConversationSchema, rawPagedOk)
    expectTypeOf(r).toEqualTypeOf<ParseResult<PagedConversations>>()
  })
})

// =============================================================
// Part 3 — 🔴 discriminatedUnion + 窄化
// =============================================================

describe('Day 25 — Part 3 可辨识联合', () => {
  it('AppNotification 是两分支可辨识联合', () => {
    expectTypeOf<AppNotification>().toEqualTypeOf<
      | { type: 'email'; id: string; subject: string; to: string }
      | { type: 'sms'; id: string; phone: string; body: string }
    >()
  })

  it('email / sms 合法数据通过;type 不在联合里失败', () => {
    expect(safeParseApi(notificationSchema, rawEmail).ok).toBe(true)
    expect(safeParseApi(notificationSchema, rawSms).ok).toBe(true)
    expect(safeParseApi(notificationSchema, rawBadType).ok).toBe(false)
  })

  it('缺必填字段(to)失败,errors 提到 to', () => {
    const r = safeParseApi(notificationSchema, rawEmailMissingTo)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('应当失败')
    expect(r.errors.some((e) => e.includes('to'))).toBe(true)
  })

  it('按 type 窄化后,分支字段可访问', () => {
    const r = safeParseApi(notificationSchema, rawEmail)
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('应当成功')
    const n: AppNotification = r.data
    if (n.type === 'email') {
      expect(n.subject).toBe('上线通知')
      expect(n.to).toBe('a@b.com')
    } else {
      throw new Error('应当走 email 分支')
    }
  })
})
