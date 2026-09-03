import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import {
  createEmitter,
  runWithContext,
  canTransition,
  nextStates,
  advance,
  describeInput,
  makeInitialForm,
  createNotificationStore,
  provideStore,
  useStore,
  STORE_KEY,
  publishNotification,
} from './solution.js'
import type {
  Signal,
  Emitter,
  InjectionKey,
  Result,
  NotificationStatus,
  NotificationRecord,
  TransitionTable,
  LegalNext,
  Channel,
  CreateNotificationInput,
  NotificationItemProps,
  FormState,
  NotificationCenterEvents,
  NotificationCenterEmitter,
  NotificationStore,
} from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const scheduledRecord: NotificationRecord = {
  id: 'n1',
  title: '中秋活动提醒',
  status: 'scheduled',
  isRead: false,
}

const sentRecord: NotificationRecord = {
  id: 'n1',
  title: '中秋活动提醒',
  status: 'sent',
  isRead: true,
}

// =============================================================
// 任务 1 — 状态机
// =============================================================

describe('Day 18 — 任务 1 状态机', () => {
  it('NotificationStatus 是五值字面量联合', () => {
    expectTypeOf<NotificationStatus>().toEqualTypeOf<
      'draft' | 'review' | 'scheduled' | 'sent' | 'failed'
    >()
  })

  it('NotificationRecord 形状', () => {
    expectTypeOf<NotificationRecord>().toEqualTypeOf<{
      id: string
      title: string
      status: NotificationStatus
      isRead: boolean
    }>()
  })

  it('TransitionTable 是具体字面量表(每个 key 各自的元组)', () => {
    expectTypeOf<TransitionTable>().toEqualTypeOf<{
      draft: readonly ['review', 'scheduled']
      review: readonly ['scheduled', 'draft']
      scheduled: readonly ['sent', 'failed']
      sent: readonly []
      failed: readonly ['draft']
    }>()
  })

  it('canTransition 按转移表判定', () => {
    expect(canTransition('draft', 'review')).toBe(true)
    expect(canTransition('draft', 'sent')).toBe(false)
    expect(canTransition('scheduled', 'failed')).toBe(true)
    expect(canTransition('sent', 'draft')).toBe(false)
    expect(canTransition('failed', 'draft')).toBe(true)
  })

  it('nextStates 返回合法下一步列表', () => {
    expect(nextStates('draft')).toEqual(['review', 'scheduled'])
    expect(nextStates('scheduled')).toEqual(['sent', 'failed'])
    expect(nextStates('sent')).toEqual([])
  })

  it('LegalNext:类型级推导合法下一步', () => {
    expectTypeOf<LegalNext<'draft'>>().toEqualTypeOf<'review' | 'scheduled'>()
    expectTypeOf<LegalNext<'scheduled'>>().toEqualTypeOf<'sent' | 'failed'>()
    expectTypeOf<LegalNext<'sent'>>().toEqualTypeOf<never>()
  })

  it('advance 运行时推进', () => {
    expect(advance('draft', 'review')).toBe('review')
    expect(advance('scheduled', 'failed')).toBe('failed')
  })

  it('advance 的非法转移必须编译报错(LegalNext 拦截)', () => {
    // 注:压类型的指令只管类型,调用仍会运行 —— 防御性抛错用 toThrow 兜住
    // @ts-expect-error —— sent 没有合法下一步,LegalNext<'sent'> 是 never
    expect(() => advance('sent', 'draft')).toThrow()
    // @ts-expect-error —— draft 不能直接到 sent
    expect(() => advance('draft', 'sent')).toThrow()
  })
})

// =============================================================
// 任务 2 — 表单 + Props
// =============================================================

describe('Day 18 — 任务 2 表单与 Props', () => {
  it('CreateNotificationInput 是按 channel 条件必填的判别联合', () => {
    expectTypeOf<CreateNotificationInput>().toEqualTypeOf<
      | { channel: 'email'; body: string; subject: string; to: string }
      | { channel: 'sms'; body: string; phone: string }
      | { channel: 'push'; body: string; deviceId: string; title: string }
    >()
  })

  it('缺条件字段必须编译报错', () => {
    // @ts-expect-error —— email 缺 subject / to
    const bad: CreateNotificationInput = { channel: 'email', body: 'x' }
    void bad
  })

  it('describeInput 三分支穷尽', () => {
    expect(
      describeInput({ channel: 'email', body: 'b', subject: 's', to: 'a@b.com' }),
    ).toContain('a@b.com')
    expect(describeInput({ channel: 'sms', body: '验证码', phone: '13800000000' })).toContain(
      '13800000000',
    )
    expect(
      describeInput({ channel: 'push', body: 'b', deviceId: 'dev_1', title: '上线啦' }),
    ).toContain('上线啦')
  })

  it('NotificationItemProps:record + 可选 compact + 回调', () => {
    expectTypeOf<NotificationItemProps>().toEqualTypeOf<{
      record: NotificationRecord
      compact?: boolean
      onToggleRead: (id: string) => void
    }>()
    const onToggleRead = vi.fn((id: string) => void id)
    const props: NotificationItemProps = { record: sentRecord, compact: true, onToggleRead }
    props.onToggleRead('n1')
    expect(onToggleRead).toHaveBeenCalledWith('n1')
  })

  it('Props 回调参数类型错误必须编译报错', () => {
    // @ts-expect-error —— onToggleRead 的参数是 string,不是 number
    const bad: NotificationItemProps = { record: sentRecord, onToggleRead: (n: number) => void n }
    void bad
  })

  it('FormState<T>:values + touched + errors(都是 Partial 记录)', () => {
    expectTypeOf<FormState<{ title: string; body: string }>>().toEqualTypeOf<{
      values: { title: string; body: string }
      touched: Partial<Record<'title' | 'body', boolean>>
      errors: Partial<Record<'title' | 'body', string>>
    }>()
  })

  it('makeInitialForm 返回空 touched / errors', () => {
    const form = makeInitialForm({ title: '', body: '' })
    expect(form.values).toEqual({ title: '', body: '' })
    expect(form.touched).toEqual({})
    expect(form.errors).toEqual({})
  })
})

// =============================================================
// 任务 3 — 事件映射
// =============================================================

describe('Day 18 — 任务 3 事件映射', () => {
  it('NotificationCenterEvents:事件名 → 参数元组', () => {
    expectTypeOf<NotificationCenterEvents>().toEqualTypeOf<{
      'notify:sent': [id: string, channel: Channel]
      'notify:failed': [id: string, reason: string]
      'draft:saved': []
    }>()
  })

  it('NotificationCenterEmitter 是 Emitter 的特化', () => {
    expectTypeOf<NotificationCenterEmitter>().toEqualTypeOf<
      Emitter<NotificationCenterEvents>
    >()
  })

  it('事件运行时(用已给的 createEmitter 装配)', () => {
    const emitter: NotificationCenterEmitter = createEmitter<NotificationCenterEvents>()
    const onSent = vi.fn()
    const onSaved = vi.fn()
    emitter.on('notify:sent', onSent)
    emitter.on('draft:saved', onSaved)
    emitter.emit('notify:sent', 'n1', 'email')
    emitter.emit('draft:saved')
    expect(onSent).toHaveBeenCalledWith('n1', 'email')
    expect(onSaved).toHaveBeenCalledWith()
  })

  it('事件参数类型错误必须编译报错', () => {
    const emitter = createEmitter<NotificationCenterEvents>()
    // @ts-expect-error —— channel 只能是 Channel,不能传数字
    emitter.emit('notify:sent', 'n1', 3)
    // @ts-expect-error —— draft:saved 是零参数事件
    emitter.emit('draft:saved', '多余参数')
  })
})

// =============================================================
// 任务 4 — Store
// =============================================================

describe('Day 18 — 任务 4 Store', () => {
  it('NotificationStore 形状(返回类型显式标注)', () => {
    expectTypeOf<NotificationStore>().toEqualTypeOf<{
      state: Signal<{ records: NotificationRecord[] }>
      add(input: CreateNotificationInput): NotificationRecord
      markRead(id: string): boolean
      unreadCount(): number
    }>()
  })

  it('add 生成 draft 且未读的新记录', () => {
    const store = createNotificationStore([])
    const record = store.add({ channel: 'sms', body: '验证码', phone: '13800000000' })
    expect(record.status).toBe('draft')
    expect(record.isRead).toBe(false)
    expect(typeof record.id).toBe('string')
    expect(store.state.get().records).toHaveLength(1)
  })

  it('markRead / unreadCount', () => {
    const store = createNotificationStore([scheduledRecord, sentRecord])
    expect(store.unreadCount()).toBe(1)
    expect(store.markRead('n1')).toBe(true)
    expect(store.unreadCount()).toBe(0)
    expect(store.markRead('不存在')).toBe(false)
  })
})

// =============================================================
// 任务 5 — provide / inject
// =============================================================

describe('Day 18 — 任务 5 注入', () => {
  it('STORE_KEY 的标注携带 NotificationStore', () => {
    expectTypeOf(STORE_KEY).toEqualTypeOf<InjectionKey<NotificationStore>>()
  })

  it('STORE_KEY 携带 NotificationStore(运行时)', () => {
    runWithContext(() => {
      const store = createNotificationStore([])
      provideStore(store)
      const injected = useStore()
      expect(injected).toBe(store)
      expectTypeOf(injected).toEqualTypeOf<NotificationStore | undefined>()
    })
  })

  it('无祖先提供时 useStore 返回 undefined', () => {
    runWithContext(() => {
      expect(useStore()).toBeUndefined()
    })
  })
})

// =============================================================
// 任务 6 — API 提交(从测试反推签名)
// =============================================================

describe('Day 18 — 任务 6 publishNotification', () => {
  it('成功信封 → Result 成功分支', async () => {
    const r = await publishNotification(scheduledRecord, () =>
      Promise.resolve({ code: 0, data: sentRecord }),
    )
    expect(r).toEqual({ ok: true, data: sentRecord })
    expectTypeOf(r).toEqualTypeOf<Result<NotificationRecord>>()
  })

  it('失败信封 → Result 失败分支', async () => {
    const r = await publishNotification(scheduledRecord, () =>
      Promise.resolve({ code: 429, message: '太快了' }),
    )
    expect(r).toEqual({ ok: false, error: { code: 429, message: '太快了' } })
  })

  it('失败信封缺 message → 用默认文案', async () => {
    const r = await publishNotification(scheduledRecord, () => Promise.resolve({ code: 500 }))
    expect(r).toEqual({ ok: false, error: { code: 500, message: '未知错误' } })
  })

  it('transport 的参数类型错误必须编译报错(签名反推验证)', async () => {
    // @ts-expect-error —— transport 必须返回 Promise<ApiEnvelope<NotificationRecord>>,不能是数字
    await publishNotification(scheduledRecord, () => Promise.resolve(42)).catch(() => undefined)
    // @ts-expect-error —— 第一个参数必须是 NotificationRecord
    await publishNotification('n1', () => Promise.resolve({ code: 0, data: sentRecord })).catch(() => undefined)
  })
})
