/**
 * Day 11 — 类型安全的发布订阅事件系统(事件名 → payload 的映射)
 *
 * 学习目标:
 *   1. 事件表:事件名 → payload 类型的映射类型(为什么必须用 type 不能用 interface)
 *   2. on / off / emit 的泛型签名:事件名与 payload 类型联动
 *   3. 🔴 emit 的条件参数(无 payload 事件调用时不传参)—— 从测试反推
 *   4. 参数逆变:内部 handler 存储为什么绕不开一次 as
 *
 * 规则:
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 所有 export 必须有 JSDoc + @example
 *   - 接口成员的占位是 never,实现函数体是 throw new Error('TODO')
 */

// =============================================================
// Part 1 — 基础:事件表
// =============================================================

/**
 * 全局事件表 —— 事件名(字符串字面量)→ payload 类型的映射。
 * 事件规格(从 solution.test.ts 反推):
 *
 *   | 事件名 | payload |
 *   |---|---|
 *   | 'notify:success' | { title: string; message: string } |
 *   | 'notify:error' | { title: string; message: string; code: number } |
 *   | 'user:login' | { userId: string } |
 *   | 'modal:close' | undefined(无 payload) |
 *
 * 为什么必须用 type 别名而不是 interface:
 * EventBus 约束 E extends Record<string, unknown>,而 interface 没有
 * 隐式索引签名(implicit index signature),type 别名的对象类型才有。
 *
 * @example
 *   type MyEvents = {
 *     'notify:success': { title: string }
 *     'modal:close': undefined // undefined 表示该事件没有 payload
 *   }
 */
export type NotificationEvents = never // ← 替换

/**
 * 事件处理器 —— 处理事件 K 时收到的 payload 就是 E[K]。
 *
 * @example
 *   const h: EventHandler<NotificationEvents, 'user:login'> = (p) => p.userId
 */
export type EventHandler<E, K extends keyof E> = E[K] extends unknown
  ? (payload: E[K]) => void
  : never // ← 替换(占位;直接写 (payload: E[K]) => void 即可)

// =============================================================
// Part 2+3 — EventBus 接口与工厂
// =============================================================

/**
 * 事件总线 —— on / off / emit 三个方法的签名都与事件表 E 联动。
 *
 * 规格从 solution.test.ts 反推:
 *   - on('user:login', h):h 的参数类型自动是 { userId: string }
 *   - off 与 on 同签名,退订时传同一个函数引用
 *   - emit('modal:close') 不带参数;'modal:close': undefined 表示无 payload
 *   - emit('notify:success', payload) 必须带参数,形状必须匹配
 *
 * 提示(emit 的条件参数):
 *   ...args: E[K] extends undefined ? [] : [payload: E[K]]
 *   —— 无 payload 事件的 args 是空元组,有 payload 事件是一元组。
 *
 * @example
 *   const bus = createEventBus<NotificationEvents>()
 *   bus.on('user:login', (p) => console.log(p.userId))
 *   bus.emit('user:login', { userId: 'u-1' })
 *   bus.emit('modal:close')
 */
export interface EventBus<E extends Record<string, unknown>> {
  on: never // ← 替换(改成泛型方法签名)
  off: never // ← 替换
  emit: never // ← 替换(今天的压轴,从测试反推)
}

/**
 * 创建事件总线。内部用 Map<事件名, Set<handler>> 存储。
 *
 * 存储类型的死结(参数逆变):没有任何统一的 handler 签名能同时
 * "收得下所有 handler"和"可被安全调用"。
 * 提示:想想 never 在参数位的意义;调用处允许一次 as,注释说明原因。
 *
 * @example
 *   const bus = createEventBus<NotificationEvents>()
 *   bus.on('notify:success', (p) => alert(p.title))
 *   bus.emit('notify:success', { title: '保存成功', message: '配置已更新' })
 */
export function createEventBus<E extends Record<string, unknown>>(): EventBus<E> {
  // TODO: Map<keyof E, Set<...>> + 返回实现 on/off/emit 的对象字面量
  throw new Error('TODO')
}
