/**
 * Day 18 — 第二阶段综合:通知中心完整类型库
 *
 * 学习目标:把 Day 9-17 的考点串起来(表单 / 状态机 / 事件 / Store / 注入 / API)
 *
 * 分工:
 *   - 「库代码(已给)」区:createSignal / Emitter / InjectionKey / 信封 / Result —— 复盘日当工具用,不用实现
 *   - 六个任务:类型用 never 占位、函数体 throw TODO,自己写
 *
 * 规则:零 any、零未注释 as;所有 export 有 JSDoc + @example
 */

// =============================================================
// 库代码(已给):响应式单元 + 事件 + 注入 + 信封 —— Day 14/15/17 的成果
// =============================================================

/** 最小响应式单元(Day 15) */
export type Signal<T> = { get(): T; set(value: T): void }

/**
 * 创建响应式单元(已实现)
 *
 * @example
 *   const s = createSignal(1)
 *   s.set(2)
 *   s.get() // => 2
 */
export function createSignal<T>(initial: T): Signal<T> {
  let value = initial
  return {
    get: () => value,
    set: (next: T) => {
      value = next
    },
  }
}

/** 事件处理器(Day 14) */
export type EventHandler<Args extends unknown[]> = (...args: Args) => void

/**
 * 类型安全的事件发射器类型(Day 14)
 *
 * @example
 *   const em: Emitter<{ ping: [at: number] }> = createEmitter()
 *   em.on('ping', (at) => void at)
 *   em.emit('ping', Date.now())
 */
export type Emitter<E extends { [K in keyof E]: unknown[] }> = {
  on<K extends keyof E>(event: K, handler: EventHandler<E[K]>): () => void
  emit<K extends keyof E>(event: K, ...args: E[K]): void
}

/**
 * 创建事件发射器(已实现;内部存储是类型擦除点,库代码已处理)
 *
 * @example
 *   const emitter = createEmitter<{ saved: [id: string] }>()
 *   emitter.emit('saved', 'n1')
 */
export function createEmitter<E extends { [K in keyof E]: unknown[] }>(): Emitter<E> {
  const handlers = new Map<keyof E, Set<(...args: never[]) => void>>()
  return {
    on(event, handler) {
      let set = handlers.get(event)
      if (set === undefined) {
        set = new Set()
        handlers.set(event, set)
      }
      set.add(handler as unknown as (...args: never[]) => void)
      return () => set!.delete(handler as unknown as (...args: never[]) => void)
    },
    emit(event, ...args) {
      const set = handlers.get(event)
      if (set === undefined) return
      for (const h of set) (h as unknown as (...args: E[typeof event]) => void)(...args)
    },
  }
}

/**
 * 注入 key(Day 14):幽灵属性携带值类型
 *
 * @example
 *   const KEY: InjectionKey<{ n: number }> = Symbol('k')
 */
export interface InjectionKey<T> extends Symbol {
  /** 幽灵属性:只在类型层存在 */
  readonly __injectionType?: T
}

/** 模拟组件树的上下文栈(已实现,Day 14) */
const contextStack: Map<InjectionKey<unknown>, unknown>[] = []

/**
 * 在新的上下文里执行 fn(已实现,Day 14)
 *
 * @example
 *   runWithContext(() => { provideStore(store); return useStore() })
 */
export function runWithContext<T>(fn: () => T): T {
  contextStack.push(new Map())
  try {
    return fn()
  } finally {
    contextStack.pop()
  }
}

/** 按栈自顶向下找 key(已实现,Day 14) */
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

/** API 错误(Day 2/17) */
export type ApiError = { code: number; message: string }

/**
 * 两态结果(Day 2/17)
 *
 * @example
 *   const r: Result<User> = { ok: true, data: user }
 */
export type Result<T, E = ApiError> = { ok: true; data: T } | { ok: false; error: E }

/**
 * 响应信封(Day 17)—— 失败分支**没有** data 字段,用 'data' in 收窄
 *
 * @example
 *   const env: ApiEnvelope<string> = { code: 0, data: 'ok' }
 */
export type ApiEnvelope<T> =
  | { code: 0; data: T; message?: string }
  | { code: number; message?: string }

// =============================================================
// 任务 1 — 🟢 状态机(Day 10)
// =============================================================

// TODO: 通知状态五值字面量联合:draft / review / scheduled / sent / failed
export type NotificationStatus = never // ← 替换

// TODO: 通知记录 —— { id: string; title: string; status: NotificationStatus; isRead: boolean }
export type NotificationRecord = never // ← 替换

// TODO: 合法转移表 —— Record<NotificationStatus, readonly NotificationStatus[]>
// (draft→review|scheduled;review→scheduled|draft;scheduled→sent|failed;sent→无;failed→draft)
export type TransitionTable = never // ← 替换

// TODO: LegalNext<S> —— 类型级推导某状态的合法下一步(提示:TransitionTable[S][number])
// LegalNext<'draft'> = 'review' | 'scheduled';LegalNext<'sent'> = never
export type LegalNext<S extends NotificationStatus> = never // ← 替换

/**
 * 运行时判定转移是否合法(签名已给,补实现)
 *
 * @example
 *   canTransition('draft', 'review')  // => true
 *   canTransition('sent', 'draft')    // => false
 */
export function canTransition(from: NotificationStatus, to: NotificationStatus): boolean {
  // TODO: 查转移表
  void from
  void to
  throw new Error('TODO')
}

/**
 * 某状态的所有合法下一步(签名已给,补实现)
 *
 * @example
 *   nextStates('scheduled')  // => ['sent', 'failed']
 */
export function nextStates(from: NotificationStatus): readonly NotificationStatus[] {
  // TODO: 读表;非法 from 抛错
  void from
  throw new Error('TODO')
}

/**
 * 推进状态(签名已给,补实现)—— 类型层 LegalNext 已拦非法转移,运行时再查表防御
 *
 * @example
 *   advance('draft', 'review')  // => 'review'
 */
export function advance<S extends NotificationStatus>(
  from: S,
  to: LegalNext<S>,
): NotificationStatus {
  // TODO: 查表,不过就抛错
  void from
  void to
  throw new Error('TODO')
}

// =============================================================
// 任务 2 — 🟢 表单 + Props(Day 9 / 13)
// =============================================================

// TODO: 通知渠道三值联合:email / sms / push
export type Channel = never // ← 替换

// TODO: 创建通知的输入 —— 按 channel 条件必填的判别联合:
//   email => { channel; body; subject; to }
//   sms   => { channel; body; phone }
//   push  => { channel; body; deviceId; title }
export type CreateNotificationInput = never // ← 替换

/**
 * 把输入转成展示文案(签名已给)—— switch + never 穷尽检查(Day 1 技能)
 *
 * @example
 *   describeInput({ channel: 'sms', body: 'x', phone: '138...' })  // => '[短信] 138...'
 */
export function describeInput(input: CreateNotificationInput): string {
  // TODO: switch (input.channel) + never 穷尽
  void input
  throw new Error('TODO')
}

// TODO: 通知条目组件的 Props(纯 TS 模拟 Day 13):
//   { record: NotificationRecord; compact?: boolean; onToggleRead: (id: string) => void }
export type NotificationItemProps = never // ← 替换

// TODO: FormState<T> —— { values: T; touched: Partial<Record<keyof T, boolean>>; errors: Partial<Record<keyof T, string>> }
export type FormState<T> = never // ← 替换

/**
 * 初始表单状态(签名已给)
 *
 * @example
 *   makeInitialForm({ title: '', body: '' })  // => { values: {...}, touched: {}, errors: {} }
 */
export function makeInitialForm<T>(values: T): FormState<T> {
  // TODO: 空 touched / errors
  void values
  throw new Error('TODO')
}

// =============================================================
// 任务 3 — 🟡 事件映射(Day 11 / 14)
// =============================================================

// TODO: 通知中心事件映射(事件名 → 参数元组):
//   'notify:sent'   => [id: string, channel: Channel]
//   'notify:failed' => [id: string, reason: string]
//   'draft:saved'   => [](零参数事件)
export type NotificationCenterEvents = never // ← 替换

// TODO: NotificationCenterEmitter = Emitter<NotificationCenterEvents>
export type NotificationCenterEmitter = never // ← 替换

// =============================================================
// 任务 4 — 🟡 Store(Day 12 / 15)
// =============================================================

// TODO: NotificationStore —— state / add / markRead / unreadCount(返回类型显式标注!)
export type NotificationStore = never // ← 替换

/**
 * 创建通知 Store(签名已给,补实现)
 *
 * @example
 *   const store = createNotificationStore([])
 *   store.add({ channel: 'sms', body: 'x', phone: '138...' })
 *   store.unreadCount()  // => 1
 */
export function createNotificationStore(
  initial: readonly NotificationRecord[],
): NotificationStore {
  // TODO: add 生成 status: 'draft'、isRead: false 的新记录(crypto.randomUUID 可用)
  void initial
  throw new Error('TODO')
}

// =============================================================
// 任务 5 — 🟡 provide / inject(Day 14)
// =============================================================

// TODO: 照 Day 14 模式声明 STORE_KEY,携带 NotificationStore
export const STORE_KEY = Symbol('notification-store')

/**
 * 在当前上下文登记 Store(签名已给)
 *
 * @example
 *   runWithContext(() => { provideStore(store); return useStore() })
 */
export function provideStore(store: NotificationStore): void {
  // TODO: 写入栈顶
  void store
  throw new Error('TODO')
}

/**
 * 取出当前上下文或祖先上下文里的 Store(签名已给)
 *
 * @example
 *   const store = useStore()  // NotificationStore | undefined
 */
export function useStore(): NotificationStore | undefined {
  // TODO: lookupKey + 收窄(存储层是 unknown,一处 TODO(reason) 注解的收窄是允许的)
  throw new Error('TODO')
}

// =============================================================
// 任务 6 — 🔴 API 提交(占位签名是错的,从测试反推)
// =============================================================

// TODO: publishNotification —— POST /notifications,解信封返回 Result<NotificationRecord>
// 行为:成功 => { ok: true, data };失败信封 => { ok: false, error: { code, message: message ?? '未知错误' } }
export function publishNotification(record: never, transport: never): never {
  void record
  void transport
  throw new Error('TODO')
}
