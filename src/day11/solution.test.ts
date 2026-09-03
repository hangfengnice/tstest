import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import { createEventBus } from './solution.js'
import type {
  NotificationEvents,
  EventHandler,
  EventBus,
} from './solution.js'

// =============================================================
// Part 1 — 事件表
// =============================================================

describe('Day 11 — Part 1 事件表', () => {
  it('NotificationEvents 事件名 → payload 的映射(从测试反推)', () => {
    expectTypeOf<NotificationEvents>().toEqualTypeOf<{
      'notify:success': { title: string; message: string }
      'notify:error': { title: string; message: string; code: number }
      'user:login': { userId: string }
      'modal:close': undefined
    }>()
  })

  it('EventHandler 的 payload 跟着事件走', () => {
    expectTypeOf<EventHandler<NotificationEvents, 'user:login'>>().toEqualTypeOf<
      (payload: { userId: string }) => void
    >()
  })
})

// =============================================================
// Part 2+3 — on / off / emit(签名从测试反推)
// =============================================================

describe('Day 11 — on / emit 类型联动', () => {
  it('emit:有 payload 的事件必须传且形状匹配', () => {
    const bus = createEventBus<NotificationEvents>()
    bus.emit('notify:success', { title: '保存成功', message: '配置已更新' })
    bus.emit('user:login', { userId: 'u-1' })
    bus.emit('notify:error', { title: '出错了', message: '服务不可用', code: 503 })
  })

  it('emit:无 payload 的事件(值为 undefined)调用时不传参', () => {
    const bus = createEventBus<NotificationEvents>()
    bus.emit('modal:close')
  })

  it('emit:未知事件名必须编译报错', () => {
    const bus = createEventBus<NotificationEvents>()
    // @ts-expect-error —— 'notify:warn' 不在事件表里
    bus.emit('notify:warn', { title: 't', message: 'm' })
  })

  it('emit:缺 payload 必须编译报错', () => {
    const bus = createEventBus<NotificationEvents>()
    // @ts-expect-error —— 'notify:success' 需要 { title, message }
    bus.emit('notify:success')
  })

  it('emit:payload 多余字段必须编译报错', () => {
    const bus = createEventBus<NotificationEvents>()
    // @ts-expect-error —— 'notify:error' 的 payload 没有 extra 字段(excess property check)
    bus.emit('notify:error', { title: 't', message: 'm', code: 1, extra: 'x' })
  })

  it('emit:无 payload 事件硬塞参数必须编译报错', () => {
    const bus = createEventBus<NotificationEvents>()
    // @ts-expect-error —— 'modal:close' 的签名是 (...args: []),不接受任何参数
    bus.emit('modal:close', { force: true })
  })

  it('on:handler 的 payload 类型由事件名决定', () => {
    const bus = createEventBus<NotificationEvents>()
    bus.on('notify:error', (p) => {
      // handler 只注册不调用,这里做的是类型断言,运行时不执行
      expectTypeOf(p).toEqualTypeOf<{ title: string; message: string; code: number }>()
    })
  })

  it('on:handler 不能要求 payload 之外的字段', () => {
    const bus = createEventBus<NotificationEvents>()
    // @ts-expect-error —— 'notify:success' 的 payload 没有 code,handler 却要求它(参数逆变)
    bus.on('notify:success', (p: { title: string; message: string; code: number }) => p.code)
  })

  it('on:事件名必须合法', () => {
    const bus = createEventBus<NotificationEvents>()
    // @ts-expect-error —— 'nope' 不在事件表里
    bus.on('nope', () => {})
  })

  it('off:handler 签名同样联动(不匹配的 handler 编译报错)', () => {
    const bus = createEventBus<NotificationEvents>()
    // @ts-expect-error —— off 'user:login' 的 handler 参数必须是 { userId: string }
    bus.off('user:login', (p: { userName: string }) => p.userName)
  })

  it('事件表为什么必须用 type:interface 不满足 Record<string, unknown> 约束', () => {
    interface IEvents {
      ping: number
    }
    type TEvents = { ping: number }
    // @ts-expect-error —— interface 没有隐式索引签名,不满足 EventBus 的泛型约束
    createEventBus<IEvents>()
    // type 别名的对象类型有隐式索引签名,可以通过
    const bus = createEventBus<TEvents>()
    bus.on('ping', (n) => expectTypeOf(n).toEqualTypeOf<number>())
  })

  it('EventBus 接口可以直接标注自定义总线', () => {
    type TEvents = { ping: number }
    const bus: EventBus<TEvents> = {
      on: () => {},
      off: () => {},
      emit: () => {},
    }
    bus.on('ping', (n) => expectTypeOf(n).toEqualTypeOf<number>())
    bus.emit('ping', 42)
  })
})

describe('Day 11 — 运行时行为', () => {
  it('on + emit:handler 收到 payload', () => {
    const bus = createEventBus<NotificationEvents>()
    const onSuccess = vi.fn((p: { title: string; message: string }) => p.title)
    bus.on('notify:success', onSuccess)
    bus.emit('notify:success', { title: '保存成功', message: '配置已更新' })
    expect(onSuccess).toHaveBeenCalledWith({ title: '保存成功', message: '配置已更新' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('同一事件可以挂多个 handler,emit 逐个触发', () => {
    const bus = createEventBus<NotificationEvents>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('user:login', h1)
    bus.on('user:login', h2)
    bus.emit('user:login', { userId: 'u-1' })
    expect(h1).toHaveBeenCalledWith({ userId: 'u-1' })
    expect(h2).toHaveBeenCalledWith({ userId: 'u-1' })
  })

  it('无 payload 事件:handler 收到 undefined', () => {
    const bus = createEventBus<NotificationEvents>()
    const onClose = vi.fn()
    bus.on('modal:close', onClose)
    bus.emit('modal:close')
    expect(onClose).toHaveBeenCalledWith(undefined)
  })

  it('off 之后不再触发', () => {
    const bus = createEventBus<NotificationEvents>()
    const onSuccess = vi.fn()
    bus.on('notify:success', onSuccess)
    bus.off('notify:success', onSuccess)
    bus.emit('notify:success', { title: '再次保存', message: '...' })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('off 只移除指定 handler,不影响同事件的其他 handler', () => {
    const bus = createEventBus<NotificationEvents>()
    const keep = vi.fn()
    const drop = vi.fn()
    bus.on('user:login', keep)
    bus.on('user:login', drop)
    bus.off('user:login', drop)
    bus.emit('user:login', { userId: 'u-2' })
    expect(keep).toHaveBeenCalledTimes(1)
    expect(drop).not.toHaveBeenCalled()
  })

  it('emit 无人订阅的事件不抛错', () => {
    const bus = createEventBus<NotificationEvents>()
    expect(() =>
      bus.emit('notify:error', { title: 'x', message: 'y', code: 500 }),
    ).not.toThrow()
  })
})
