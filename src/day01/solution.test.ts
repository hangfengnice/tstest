import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  formatNotification,
  getNotificationIcon,
  createNotification,
  type Notification,
  type NotificationType,
  type IconName,
} from './solution.js'

// 一个完整的 Email 通知样例,用来给函数喂数据
const sampleEmail: Notification = {
  type: 'email',
  id: 'n1',
  createdAt: '2026-09-02T10:00:00Z',
  isRead: false,
  subject: '欢迎加入',
  body: '这是一封欢迎邮件',
  to: 'user@example.com',
}

const sampleSms: Notification = {
  type: 'sms',
  id: 'n2',
  createdAt: '2026-09-02T10:01:00Z',
  isRead: false,
  phone: '+8613800000000',
  body: '验证码 1234',
}

const samplePush: Notification = {
  type: 'push',
  id: 'n3',
  createdAt: '2026-09-02T10:02:00Z',
  isRead: true,
  deviceId: 'dev_abc',
  title: '新消息',
  body: '点击查看',
}

describe('Day 1 — 类型定义', () => {
  it('NotificationType 必须是字面量联合,不能扩展', () => {
    expectTypeOf<NotificationType>().toEqualTypeOf<'email' | 'sms' | 'push'>()
  })

  it('IconName 必须是字面量联合', () => {
    expectTypeOf<IconName>().toEqualTypeOf<'mail' | 'phone' | 'bell'>()
  })

  it('Notification 联合包含三种通知', () => {
    expectTypeOf<Notification>().toMatchTypeOf<
      | { type: 'email'; subject: string; body: string; to: string }
      | { type: 'sms'; phone: string; body: string }
      | { type: 'push'; deviceId: string; title: string; body: string }
    >()
  })

  it('三种通知都有公共字段(id / createdAt / isRead)', () => {
    expectTypeOf(sampleEmail).toHaveProperty('id')
    expectTypeOf(sampleEmail).toHaveProperty('createdAt')
    expectTypeOf(sampleEmail).toHaveProperty('isRead')
  })

  it('type 字段必须是字面量,不能被赋值为宽 string', () => {
    // 静态断言:带 type: 'foo' 的对象不能赋值给 Notification
    // 如果 Notification 的 type 字段退化成宽 string,这里会成立(测试失败),
    // 强制你必须用字面量联合
    expectTypeOf<{ type: 'foo' }>().not.toMatchTypeOf<Notification>()
  })
})

describe('Day 1 — formatNotification', () => {
  it('email 格式', () => {
    expect(formatNotification(sampleEmail)).toContain('欢迎加入')
    expect(formatNotification(sampleEmail)).toContain('user@example.com')
  })

  it('sms 格式', () => {
    expect(formatNotification(sampleSms)).toContain('+8613800000000')
    expect(formatNotification(sampleSms)).toContain('验证码 1234')
  })

  it('push 格式', () => {
    expect(formatNotification(samplePush)).toContain('新消息')
    expect(formatNotification(samplePush)).toContain('dev_abc')
  })

  it('返回值必须是 string', () => {
    expectTypeOf(formatNotification(sampleEmail)).toEqualTypeOf<string>()
  })
})

describe('Day 1 — getNotificationIcon', () => {
  it('email -> mail', () => {
    expect(getNotificationIcon(sampleEmail)).toBe('mail')
  })

  it('sms -> phone', () => {
    expect(getNotificationIcon(sampleSms)).toBe('phone')
  })

  it('push -> bell', () => {
    expect(getNotificationIcon(samplePush)).toBe('bell')
  })

  it('返回值必须是字面量联合', () => {
    expectTypeOf(getNotificationIcon(sampleEmail)).toEqualTypeOf<IconName>()
  })
})

describe('Day 1 — createNotification(类型安全的工厂)', () => {
  it('传 email 时,缺 subject 必须编译报错', () => {
    createNotification({
      type: 'email',
      // @ts-expect-error —— 缺 subject 字段
      payload: { body: 'x', to: 'a@b.com' },
    })
  })

  it('传 sms 时,缺 phone 必须编译报错', () => {
    createNotification({
      type: 'sms',
      // @ts-expect-error —— 缺 phone 字段
      payload: { body: 'x' },
    })
  })

  it('传 push 时,缺 deviceId 必须编译报错', () => {
    createNotification({
      type: 'push',
      // @ts-expect-error —— 缺 deviceId 字段
      payload: { title: 't', body: 'b' },
    })
  })

  it('传 email + 完整 payload,返回的对象 type 是 email', () => {
    const n = createNotification({
      type: 'email',
      payload: { subject: 'hi', body: 'b', to: 'a@b.com' },
    })
    expectTypeOf(n).toMatchTypeOf<Notification>()
    if (n.type !== 'email') throw new Error('type 收窄失败')
    expect(n.subject).toBe('hi')
  })

  it('返回的对象自带 id / createdAt / isRead', () => {
    const n = createNotification({
      type: 'sms',
      payload: { phone: '13800000000', body: 'b' },
    })
    expect(typeof n.id).toBe('string')
    expect(typeof n.createdAt).toBe('string')
    expect(typeof n.isRead).toBe('boolean')
    expect(n.type).toBe('sms')
  })
})
