import { describe, it, expect, expectTypeOf } from 'vitest'
import { isTransitionAllowed, transition } from './solution.js'
import type {
  SendStatus,
  DraftMessage,
  SendingMessage,
  SentMessage,
  FailedMessage,
  MessageSendState,
  AllowedTransitions,
  TransitionTable,
  TransitionPayload,
} from './solution.js'

// =============================================================
// 测试数据(顶层只做类型标注,不调用任何待实现函数)
// =============================================================

const draft: DraftMessage = { status: 'draft', content: '在吗' }

const sending: SendingMessage = {
  status: 'sending',
  content: '在吗',
  requestId: 'req-1',
  attempt: 1,
}

const failed: FailedMessage = {
  status: 'failed',
  content: '在吗',
  requestId: 'req-1',
  reason: '网络超时',
  attempt: 1,
}

const sent: SentMessage = {
  status: 'sent',
  content: '在吗',
  messageId: 'm-9',
  sentAt: '2026-09-03T10:00:00Z',
}

// =============================================================
// Part 1 — 状态建模
// =============================================================

describe('Day 10 — Part 1 状态建模', () => {
  it('SendStatus 是四个字面量', () => {
    expectTypeOf<SendStatus>().toEqualTypeOf<'draft' | 'sending' | 'sent' | 'failed'>()
  })

  it('MessageSendState 是四个状态的联合', () => {
    expectTypeOf<MessageSendState>().toEqualTypeOf<
      DraftMessage | SendingMessage | SentMessage | FailedMessage
    >()
  })

  it('每个状态携带自己的数据(draft 没有 requestId)', () => {
    // @ts-expect-error —— draft 分支不存在 requestId
    const id = draft.requestId
    void id
  })

  it('sent 分支不存在 reason', () => {
    const s: MessageSendState = sent
    // @ts-expect-error —— sent 分支不存在 reason
    const r = s.reason
    void r
  })

  it('status 判别后类型收窄', () => {
    const s: MessageSendState = failed
    if (s.status === 'failed') {
      expectTypeOf(s).toEqualTypeOf<FailedMessage>()
      expect(s.reason).toBe('网络超时')
    }
  })
})

// =============================================================
// Part 2 — 合法转移表
// =============================================================

describe('Day 10 — Part 2 转移表类型', () => {
  it('AllowedTransitions:每行的目标字面量', () => {
    expectTypeOf<AllowedTransitions>().toEqualTypeOf<{
      draft: 'sending'
      sending: 'sent' | 'failed'
      sent: never
      failed: 'sending'
    }>()
  })

  it('TransitionTable 接受正确的表', () => {
    const table: TransitionTable = {
      draft: ['sending'],
      sending: ['sent', 'failed'],
      sent: [],
      failed: ['sending'],
    }
    expect(table.sent).toEqual([])
  })

  it('TransitionTable 拒绝非法目标(draft 直接到 sent)', () => {
    // @ts-expect-error —— draft 行只能放 'sending',不能出现 'sent'
    const bad: TransitionTable = { draft: ['sending', 'sent'], sending: ['sent', 'failed'], sent: [], failed: ['sending'] }
    void bad
  })

  it('TransitionTable 拒绝终态出现任何目标', () => {
    // @ts-expect-error —— sent 是终态(never),行内只能是空数组
    const bad: TransitionTable = { draft: ['sending'], sending: ['sent', 'failed'], sent: ['sending'], failed: ['sending'] }
    void bad
  })
})

describe('Day 10 — Part 2 isTransitionAllowed', () => {
  it('合法转移返回 true', () => {
    expect(isTransitionAllowed('draft', 'sending')).toBe(true)
    expect(isTransitionAllowed('sending', 'sent')).toBe(true)
    expect(isTransitionAllowed('sending', 'failed')).toBe(true)
    expect(isTransitionAllowed('failed', 'sending')).toBe(true)
  })

  it('非法转移返回 false', () => {
    expect(isTransitionAllowed('draft', 'sent')).toBe(false)
    expect(isTransitionAllowed('draft', 'failed')).toBe(false)
    expect(isTransitionAllowed('sent', 'sending')).toBe(false)
    expect(isTransitionAllowed('sent', 'sent')).toBe(false)
    expect(isTransitionAllowed('failed', 'sent')).toBe(false)
  })
})

// =============================================================
// Part 3 — transition(签名从测试反推)
// =============================================================

describe('Day 10 — Part 3 transition 返回类型', () => {
  it('draft → sending 返回 SendingMessage(精确到目标状态)', () => {
    const s1 = transition(draft, { to: 'sending', requestId: 'req-1' })
    expectTypeOf(s1).toEqualTypeOf<SendingMessage>()
  })

  it('sending → sent 返回 SentMessage', () => {
    const s2 = transition(sending, { to: 'sent', messageId: 'm-9', sentAt: '2026-09-03T10:00:00Z' })
    expectTypeOf(s2).toEqualTypeOf<SentMessage>()
  })

  it('sending → failed 返回 FailedMessage', () => {
    const s3 = transition(sending, { to: 'failed', reason: '网络超时' })
    expectTypeOf(s3).toEqualTypeOf<FailedMessage>()
  })

  it('failed → sending 返回 SendingMessage', () => {
    const s4 = transition(failed, { to: 'sending', requestId: 'req-2' })
    expectTypeOf(s4).toEqualTypeOf<SendingMessage>()
  })

  it('非法转移:类型层编译报错,运行时抛错兜底(状态来自服务器等动态数据时,类型帮不上忙)', () => {
    // @ts-expect-error —— sent 是终态,四条重载都不匹配;故意越过类型验证运行时防线
    expect(() => transition(sent, { to: 'sending', requestId: 'req-3' })).toThrow(/非法转移/)
    // @ts-expect-error —— draft 没有到 sent 的重载
    expect(() => transition(draft, { to: 'sent', messageId: 'm', sentAt: 't' })).toThrow(/非法转移/)
    // @ts-expect-error —— failed 没有到 sent 的重载
    expect(() => transition(failed, { to: 'sent', messageId: 'm', sentAt: 't' })).toThrow(/非法转移/)
    // @ts-expect-error —— draft 没有到 failed 的重载
    expect(() => transition(draft, { to: 'failed', reason: 'x' })).toThrow(/非法转移/)
  })

  it('payload 字段缺失必须编译报错(运行时这条不抛:类型层已拦截,真正调用必有 reason)', () => {
    // @ts-expect-error —— to 'failed' 的 payload 必须带 reason
    transition(sending, { to: 'failed' })
  })
})

describe('Day 10 — Part 3 transition 运行时行为', () => {
  it('完整流转:draft → sending → failed → sending → sent', () => {
    const s1 = transition(draft, { to: 'sending', requestId: 'req-1' })
    expect(s1).toEqual({ status: 'sending', content: '在吗', requestId: 'req-1', attempt: 1 })

    const s2 = transition(s1, { to: 'failed', reason: '网络超时' })
    expect(s2).toEqual({
      status: 'failed',
      content: '在吗',
      requestId: 'req-1',
      reason: '网络超时',
      attempt: 1,
    })

    const s3 = transition(s2, { to: 'sending', requestId: 'req-2' })
    expect(s3).toEqual({ status: 'sending', content: '在吗', requestId: 'req-2', attempt: 2 })

    const s4 = transition(s3, { to: 'sent', messageId: 'm-9', sentAt: '2026-09-03T10:00:00Z' })
    expect(s4).toEqual({
      status: 'sent',
      content: '在吗',
      messageId: 'm-9',
      sentAt: '2026-09-03T10:00:00Z',
    })
  })

  it('TransitionPayload 判别联合可以按 to 收窄', () => {
    const e: TransitionPayload = { to: 'sending', requestId: 'r' }
    if (e.to === 'sending') {
      expectTypeOf(e.requestId).toEqualTypeOf<string>()
      expect(e.requestId).toBe('r')
    }
  })
})
