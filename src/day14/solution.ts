/**
 * Day 14 — provide/inject 类型安全 + emits 事件映射(纯 TS 模拟)
 *
 * 学习目标:
 *   1. InjectionKey 模式:key 本身携带值的类型(symbol + 泛型空接口)
 *   2. provide/inject 的泛型签名 + 函数重载(默认值改变返回类型)
 *   3. emits 事件映射:事件名 → 参数元组,emit/on 全量类型检查
 *
 * 规则:
 *   - 不 import vue,手写类型机制
 *   - 零 any;事件存储的类型擦除点允许一处 as/unknown + TODO(reason)
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 0 — InjectionKey 模式(已给出,先读懂再用)
// =============================================================

/**
 * 注入 key —— Vue 3 源码同款模式:接口继承 `Symbol`,泛型 T 只存在于类型层。
 * 这样 `InjectionKey<ThemeContext>` 就是一个"携带"了值类型的 key:
 * provide/inject 的泛型推断全靠它的**类型标注**完成。
 *
 * 和 Vue 原版的唯一差别:Vue 原版是 `interface InjectionKey<T> extends Symbol {}`(T 不出现在任何成员里),
 * 但本仓库开了 noUnusedLocals,未使用的类型参数会报 TS6133,
 * 所以加了一个**幽灵可选属性**让 T 被"读到" —— 它运行时永远是 undefined,类型层行为与 Vue 原版完全一致。
 *
 * 为什么接口本身没有任何实质成员,TS 却能在 inject 时区分不同的 T?——见 README 思考题。
 *
 * @example
 *   const THEME_KEY: InjectionKey<ThemeContext> = Symbol('theme')
 *   // THEME_KEY 的类型标注里"藏着" ThemeContext,inject 时能推出来
 */
export interface InjectionKey<T> extends Symbol {
  /** 幽灵属性:只在类型层存在,标记 T 用,运行时永远不要赋值 */
  readonly __injectionType?: T
}

// =============================================================
// Part 1 — 基础:业务类型 + key 的声明
// =============================================================

// TODO: 主题模式字面量联合('light' | 'dark' | 'auto')
export type ThemeMode = never // ← 替换

// TODO: 主题上下文 —— { mode: ThemeMode; density: 'comfortable' | 'compact' }
export type ThemeContext = never // ← 替换

// TODO: 当前用户 —— { id: number; name: string; roles: ReadonlyArray<'admin' | 'editor' | 'viewer'> }
export type CurrentUser = never // ← 替换

// TODO: 通知设置 —— { pageSize: number; sound: boolean }
export type NotificationSettings = never // ← 替换

/**
 * 主题服务的注入 key(写法照 Vue 官方,类型标注是关键)
 *
 * @example
 *   provide(THEME_KEY, { mode: 'dark', density: 'comfortable' })
 *   const theme = inject(THEME_KEY)  // => ThemeContext | undefined
 */
export const THEME_KEY: InjectionKey<ThemeContext> = Symbol('theme')

/**
 * 当前用户的注入 key
 *
 * @example
 *   provide(USER_KEY, { id: 1, name: '吴杭峰', roles: ['admin'] })
 *   inject(USER_KEY, guestUser)  // => CurrentUser(带默认值,无 undefined)
 */
export const USER_KEY: InjectionKey<CurrentUser> = Symbol('user')

// TODO: 照葫芦画瓢 —— 声明 SETTINGS_KEY,携带 NotificationSettings
// JSDoc 里必须回答:为什么 key 用 symbol 而不是 string?
export const SETTINGS_KEY = Symbol('settings')

// =============================================================
// Part 2 — 进阶:provide / inject 运行时
// =============================================================

/** 模拟组件树的上下文栈(已实现,测试脚手架,不是练习重点) */
const contextStack: Map<InjectionKey<unknown>, unknown>[] = []

/**
 * 在新的"组件上下文"里执行 fn —— 模拟子组件的 setup 嵌套(已实现,脚手架)
 *
 * @example
 *   runWithContext(() => {
 *     provide(THEME_KEY, darkTheme)   // 写进当前上下文
 *     return inject(THEME_KEY)        // 从当前/祖先上下文读
 *   })
 */
export function runWithContext<T>(fn: () => T): T {
  contextStack.push(new Map())
  try {
    return fn()
  } finally {
    contextStack.pop()
  }
}

/**
 * 从栈顶往下找 key(已实现,脚手架)。返回可辨识联合,免去调用方的 as。
 *
 * 注意:参数类型是 `InjectionKey<unknown>` 而不是 `symbol` ——
 * 接口(`InjectionKey<T>`)**不是** symbol 原始类型,直接写 symbol 参数你的 provide 会编译不过,想想为什么。
 *
 * @example
 *   const r = lookupKey(THEME_KEY)
 *   if (r.found) console.log(r.value) // unknown,还需收窄
 */
export function lookupKey(
  key: InjectionKey<unknown>,
): { found: true; value: unknown } | { found: false; value: undefined } {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    const layer = contextStack[i]
    if (layer !== undefined && layer.has(key)) {
      return { found: true, value: layer.get(key) }
    }
  }
  return { found: false, value: undefined }
}

/**
 * 向当前组件上下文登记一个值(签名已给,补运行时)
 *
 * 栈为空(在 runWithContext 之外调用)时必须抛错 —— 对应"组件外 provide"的误用。
 *
 * @example
 *   runWithContext(() => {
 *     provide(THEME_KEY, { mode: 'dark', density: 'comfortable' })
 *   })
 */
export function provide<T>(key: InjectionKey<T>, value: T): void {
  // TODO: 写入栈顶上下文;栈空时抛错
  void key
  void value
  throw new Error('TODO')
}

// TODO: inject —— 上面的占位签名是错的,从测试反推正确签名
// 需要函数重载表达两种行为:
//   只传 key       => T | undefined(可能没有祖先提供过)
//   传了默认值     => T(保证有值)
export function inject(key: never, defaultValue?: never): never {
  void key
  void defaultValue
  throw new Error('TODO')
}

// =============================================================
// Part 2b — 进阶:emits 事件映射
// =============================================================

// TODO: 事件处理器 —— (...args: Args) => void,Args 约束为 unknown[]
export type EventHandler<Args extends unknown[]> = never // ← 替换

// TODO: 通知中心的事件映射(事件名 → 参数元组),三个事件:
//   'theme:change' => [mode: ThemeMode]
//   'user:rename'  => [userId: number, newName: string]
//   'panel:close'  => [](零参数事件用空元组)
export type NotificationEvents = never // ← 替换

// TODO: 类型安全的 emitter —— on / emit 都是泛型方法
//   on(event, handler) 返回取消订阅函数
//   emit(event, ...args) 的参数由 E[event] 逐个检查
// 约束提示:E extends { [K in keyof E]: unknown[] }
export type Emitter<E extends { [K in keyof E]: unknown[] }> = never // ← 替换

/**
 * 创建一个事件发射器(签名已给,补运行时)
 *
 * 内部存储是异构的(每个事件的参数类型都不同),你会在某一行遇到类型擦除,
 * 允许一处 as/unknown + TODO(reason) 注释 —— Vue 源码里的 emits 也是这么做的。
 *
 * @example
 *   const emitter = createEmitter<NotificationEvents>()
 *   const off = emitter.on('user:rename', (id, name) => console.log(id, name))
 *   emitter.emit('user:rename', 7, '新名字')
 *   off() // 取消订阅
 */
export function createEmitter<E extends { [K in keyof E]: unknown[] }>(): Emitter<E> {
  // TODO: 实现 on / emit / 取消订阅
  throw new Error('TODO')
}
