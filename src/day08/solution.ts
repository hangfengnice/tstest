/**
 * Day 8 — 手写 Extract / Exclude / ReturnType / Parameters + 第一阶段综合复盘
 *
 * 学习目标:
 *   1. 条件类型 + 分布式行为(MyExtract / MyExclude)
 *   2. infer 模式匹配(MyReturnType / MyParameters)
 *   3. 综合:类型安全的事件总线(联合 + 守卫 + keyof 约束 + 映射存储)
 *
 * 规则:
 *   - 四个 My* 必须手写,不许用内置同名工具凑数
 *   - 事件总线零 any、零 as
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 1 — 条件类型入门
// =============================================================

// TODO: MyExtract<T, U> —— 从联合 T 里挑出可赋给 U 的成员(T extends U ? T : never)
// JSDoc 里回答:条件类型什么时候分发?包进数组后还分发吗?
export type MyExtract<T, U> = never // ← 替换

// TODO: MyExclude<T, U> —— 踢掉可赋给 U 的成员(T extends U ? never : T)
export type MyExclude<T, U> = never // ← 替换

// =============================================================
// Part 2 — infer 推断
// =============================================================

// TODO: MyReturnType<T> —— 抠出函数返回值(infer R)
export type MyReturnType<T extends (...args: never[]) => unknown> = never // ← 替换

// TODO: MyParameters<T> —— 抠出参数元组(infer P)
export type MyParameters<T extends (...args: never[]) => unknown> = never // ← 替换

// =============================================================
// Part 3 — 类型安全的事件总线(综合)
// =============================================================

// TODO: ChatEventMap —— 事件名 → 载荷 的映射(见 README 表格)
export type ChatEventMap = never // ← 替换

// TODO: ChatEventName —— keyof ChatEventMap & string(想想 & string 的作用)
export type ChatEventName = never // ← 替换

/**
 * 验证事件名是否在映射表里(emitRaw 的第一道闸)
 *
 * @example
 *   isChatEventName('message')  // => true
 *   isChatEventName('nope')     // => false
 */
export function isChatEventName(v: unknown): v is ChatEventName {
  // TODO: 逐个比对四个事件名
  void v
  throw new Error('TODO')
}

/**
 * message 载荷守卫(Day 4 技能:typeof object + in + typeof 字段)
 *
 * @example
 *   isMessagePayload({ text: 'hi', at: 1 })   // => true
 *   isMessagePayload({ text: 'hi' })          // => false(缺 at)
 */
export function isMessagePayload(v: unknown): v is ChatEventMap['message'] {
  // TODO: 对象 + text: string + at: number
  void v
  throw new Error('TODO')
}

// TODO: isTypingPayload —— { userId: string }
export function isTypingPayload(v: unknown): v is ChatEventMap['typing'] {
  void v
  throw new Error('TODO')
}

// TODO: isDonePayload —— { reason: 'stop' | 'length' }(闭集,逐字面量比)
export function isDonePayload(v: unknown): v is ChatEventMap['done'] {
  void v
  throw new Error('TODO')
}

// TODO: isErrorPayload —— { message: string }
export function isErrorPayload(v: unknown): v is ChatEventMap['error'] {
  void v
  throw new Error('TODO')
}

// TODO: ChatBus —— 三方法签名规格见 README(on 返回取消订阅 / emit 类型化 / emitRaw 验证 unknown)
export type ChatBus = never // ← 替换

/**
 * 创建事件总线 —— 第一阶段综合题。
 *
 * JSDoc 里记下存储的坑:把 handlers 声明成可选属性({ [K in ...]?: Set<...> })后,
 * 往 handlers[event] 写入会遇到什么报错?为什么全量初始化能绕开?
 *
 * @example
 *   const bus = createChatBus()
 *   const off = bus.on('message', (p) => console.log(p.text))
 *   bus.emit('message', { text: 'hi', at: 1 })
 *   off()  // 取消订阅
 */
export function createChatBus(): ChatBus {
  // TODO: 映射类型全量初始化存储;emitRaw 里 switch 逐事件验载荷,坏数据不触发任何处理器
  throw new Error('TODO')
}
