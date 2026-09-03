/**
 * Day 6 — 泛型进阶:默认类型参数 / satisfies / const 类型参数
 *
 * 学习目标:
 *   1. 映射表 → 判别联合:{ [K in keyof M]: ... }[keyof M]
 *   2. 默认类型参数:Handler 裸用 = 全事件处理器
 *   3. satisfies:检查归检查,推断归推断
 *   4. const 类型参数:字面量保留写进签名(TS 5.0)
 *
 * 规则:
 *   - 零 any、零 as
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 1 — 事件映射表
// =============================================================

// TODO: EventMap —— 事件名 → 载荷 的映射(见 README 表格)
export type EventMap = never // ← 替换

// TODO: EventEnvelope —— 把映射表翻成带 name 判别符的联合(映射类型 + 索引访问)
export type EventEnvelope = never // ← 替换

// =============================================================
// Part 2 — 安全分发 + 默认类型参数 + satisfies
// =============================================================

/**
 * 渲染事件为日志行。
 *
 * JSDoc 里写下实验结论:为什么泛型签名
 * <E extends keyof EventMap>(name: E, payload: EventMap[E]) 在函数体里收窄不了?
 * (Day 2 复验过的结论,在这里第二次撞上)
 *
 * @example
 *   formatEvent({ name: 'chip:done', payload: { chipId: 'c1', durationMs: 5 } })
 *   // => '[chip:done] c1 耗时 5ms'
 */
export function formatEvent(e: EventEnvelope): string {
  // TODO: switch (e.name) 收窄 payload
  void e
  throw new Error('TODO')
}

/**
 * 事件处理器类型 —— 带默认类型参数
 *
 * JSDoc 里回答:默认参数解决了什么便利性问题?
 * (提示:不写默认时,想表达"什么事件都能处理"的 Handler 该怎么写?)
 *
 * @example
 *   const onDone: Handler<'chip:done'> = (name, p) => { void name; void p.durationMs }
 *   const onAny: Handler = (name, p) => { void name; void p }
 */
export type Handler<E extends keyof EventMap = keyof EventMap> = never // ← 替换

/**
 * chip 运行配置 —— satisfies 的主角(对比实验在 solution.test.ts 里)
 *
 * JSDoc 里写清三种写法的行为差异:
 *   1. satisfies ChipRegistry —— 结构查了,字面量保住(logLevel: 'debug')
 *   2. : ChipRegistry(注解) —— 结构查了,字面量拓宽(联合三成员)
 *   3. as const —— 字面量全保,结构完全不查
 *
 * @example
 *   const config = { retries: 3, logLevel: 'debug' } satisfies ChipRegistry
 *   config.logLevel  // 类型 'debug',不是联合
 */
export type ChipRegistry = never // ← 替换

// =============================================================
// Part 3 — 边界:const 类型参数(下面的占位签名是错的!)
// =============================================================

/**
 * 路由注册:出参保留全部字面量类型,path 约束仍然生效。
 *
 * 签名自己设计 —— 从 solution.test.ts 反推。
 * 先写普通泛型版本看断言怎么红,再考虑 TS 5.0 的 const 类型参数。
 *
 * @example
 *   const routes = defineRoutes({ home: { path: '/' } })
 *   routes.home.path  // 类型 '/',不是 string
 */
export function defineRoutes(routes: never): never {
  // TODO: 占位签名是错的,从测试反推
  void routes
  throw new Error('TODO')
}
