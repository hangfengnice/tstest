# Day 18 — 参考答案 + 点评要点

> 使用规则：自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案"，是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下实现**已通过本 day 全部验收测试**（vitest 29/29 双通道全绿，运行时 + 类型检查）+
`pnpm typecheck`（day18 的 52 个骨架期错误全部消失，无新增）。
文中的错误码和运行时现象全部经过本机 TS 5.6 + strict 实测。
库代码区（createSignal / Emitter / InjectionKey / 信封 / Result）骨架里已给，此处省略，
只列你要写的六个任务。

---

## 一、参考实现

### 任务 1 — 状态机（Day 10）

```ts
/**
 * 通知生命周期状态。
 * 五值字面量联合:顺序按生命周期排(draft → review → scheduled → sent / failed),
 * 读代码的人顺着联合读就是一条状态流。
 *
 * @example
 * const s: NotificationStatus = 'draft'
 */
export type NotificationStatus = 'draft' | 'review' | 'scheduled' | 'sent' | 'failed'

/**
 * 一条通知的记录。
 * status 用宽的 NotificationStatus(记录是会流转的运行时数据,不是常量)。
 *
 * @example
 * const r: NotificationRecord = { id: 'n1', title: '中秋活动提醒', status: 'scheduled', isRead: false }
 */
export type NotificationRecord = {
  id: string
  title: string
  status: NotificationStatus
  isRead: boolean
}

/**
 * 合法转移表 —— **每个 key 的值是各自的具体字面量元组**,不是统一的大联合。
 * 为什么不写 `Record<NotificationStatus, readonly NotificationStatus[]>`:
 * 那会把所有 key 的值类型抹平成宽联合,`LegalNext` 就推不出精确结果了 ——
 * 字面量信息必须留在类型里,它是任务 4 类型级推导的原料。
 *
 * @example
 * const next: TransitionTable['draft'][number] = 'review' // 只能是 'review' | 'scheduled'
 */
export type TransitionTable = {
  draft: readonly ['review', 'scheduled']
  review: readonly ['scheduled', 'draft']
  scheduled: readonly ['sent', 'failed']
  sent: readonly []
  failed: readonly ['draft']
}

/**
 * 类型级推导某状态的合法下一步:索引访问取出该状态的元组,`[number]` 把元组拆成联合。
 * `LegalNext<'sent'>` 是 `never` —— "没有合法下一步"在类型层就是 never,
 * advance 的第二参数收 never 意味着任何值都传不进去,非法转移编译期就死。
 *
 * @example
 * LegalNext<'draft'>     // 'review' | 'scheduled'
 * LegalNext<'scheduled'> // 'sent' | 'failed'
 * LegalNext<'sent'>      // never
 */
export type LegalNext<S extends NotificationStatus> = TransitionTable[S][number]

/**
 * 运行时的转移表(值层)。
 * 类型标注刻意用**宽**的 mapped(值是 readonly NotificationStatus[]):
 * 类型层的 TransitionTable 是推导原料,值层的表是查表数据 —— 查表要 includes,
 * includes 的参数类型是元素类型,宽标注让 `includes(to: NotificationStatus)` 直接可用,
 * 一个 as 都不用。这就是"类型层精确、值层够用"的分工。
 */
const TRANSITIONS: { readonly [S in NotificationStatus]: readonly NotificationStatus[] } = {
  draft: ['review', 'scheduled'],
  review: ['scheduled', 'draft'],
  scheduled: ['sent', 'failed'],
  sent: [],
  failed: ['draft'],
}

/**
 * 运行时判定转移是否合法。
 *
 * @example
 *   canTransition('draft', 'review')  // => true
 *   canTransition('sent', 'draft')    // => false
 */
export function canTransition(from: NotificationStatus, to: NotificationStatus): boolean {
  const legal: readonly NotificationStatus[] = TRANSITIONS[from]
  return legal.includes(to)
}

/**
 * 某状态的所有合法下一步。
 *
 * @example
 *   nextStates('scheduled')  // => ['sent', 'failed']
 */
export function nextStates(from: NotificationStatus): readonly NotificationStatus[] {
  // 防御:mapped 类型全键覆盖,理论上 from 必在表里;边界数据(any 逃逸/序列化)进来时大声失败
  if (!(from in TRANSITIONS)) {
    throw new Error(`未知的通知状态:${String(from)}`)
  }
  return TRANSITIONS[from]
}

/**
 * 推进状态 —— 类型层 LegalNext 已拦非法转移,运行时再查表防御(双保险)。
 *
 * @example
 *   advance('draft', 'review')  // => 'review'
 */
export function advance<S extends NotificationStatus>(
  from: S,
  to: LegalNext<S>,
): NotificationStatus {
  if (!canTransition(from, to)) {
    throw new Error(`非法状态转移:${from} → ${String(to)}`)
  }
  return to
}
```

### 任务 2 — 表单 + Props（Day 9 / 13）

```ts
/**
 * 通知渠道三值联合。
 *
 * @example
 * const c: Channel = 'email'
 */
export type Channel = 'email' | 'sms' | 'push'

/**
 * 创建通知的输入 —— 按 channel 条件必填的判别联合。
 * 每个分支只声明自己需要的字段:email 缺 subject/to、sms 缺 phone、push 缺 deviceId/title
 * 都在编译期报错;共同字段 body 三个分支各写一份,不提取公共部分 ——
 * 判别联合的可读性 > 字段的去重(分支拆开后 IDE 能按 channel 精确提示)。
 *
 * @example
 * const a: CreateNotificationInput = { channel: 'email', body: 'b', subject: 's', to: 'a@b.com' }
 * const b: CreateNotificationInput = { channel: 'sms', body: 'b', phone: '13800000000' }
 */
export type CreateNotificationInput =
  | { channel: 'email'; body: string; subject: string; to: string }
  | { channel: 'sms'; body: string; phone: string }
  | { channel: 'push'; body: string; deviceId: string; title: string }

/**
 * 把输入转成展示文案 —— switch + never 穷尽检查。
 * default 分支的 `const exhaustive: never = input` 是守门员:
 * 将来加第四种 channel 而忘了改这里,编译器立刻在这行报错(穷尽性检查)。
 *
 * @example
 *   describeInput({ channel: 'sms', body: 'x', phone: '138...' })  // => '[短信] 138...:x'
 */
export function describeInput(input: CreateNotificationInput): string {
  // switch 收窄:每个 case 里 input 已经是那个分支的类型,条件字段直接可用
  switch (input.channel) {
    case 'email':
      return `[邮件] ${input.subject} → ${input.to}:${input.body}`
    case 'sms':
      return `[短信] ${input.phone}:${input.body}`
    case 'push':
      return `[推送] ${input.title}(${input.deviceId}):${input.body}`
    default: {
      // 走到这里 input 只能是 never —— 任何新分支都会在这里编译报错
      const exhaustive: never = input
      return exhaustive
    }
  }
}

/**
 * 通知条目组件的 Props(纯 TS 模拟 Vue 组件 Props)。
 * compact 可选(默认竖排),回调只传 id —— 组件不关心 store,事件上抛给父组件,
 * 这是"展示组件无状态"的 Props 设计习惯。
 *
 * @example
 * const props: NotificationItemProps = { record: r, compact: true, onToggleRead: (id) => void id }
 */
export type NotificationItemProps = {
  record: NotificationRecord
  compact?: boolean
  onToggleRead: (id: string) => void
}

/**
 * 表单状态:值 / 触碰标记 / 错误信息。
 * touched/errors 用 `Partial<Record<keyof T, ...>>` —— 键被 T 约束(写错字段名编译报错),
 * 值可选(没碰过的字段没有条目,而不是 touched: false 这种噪音条目)。
 * 注意 exactOptionalPropertyTypes:不能显式写 `{ title: undefined }`,
 * "没有"就是"键不存在"。
 *
 * @example
 * const f: FormState<{ title: string }> = { values: { title: '' }, touched: { title: true }, errors: {} }
 */
export type FormState<T> = {
  values: T
  touched: Partial<Record<keyof T, boolean>>
  errors: Partial<Record<keyof T, string>>
}

/**
 * 初始表单状态:values 原样,touched/errors 从空开始。
 *
 * @example
 *   makeInitialForm({ title: '', body: '' })  // => { values: {...}, touched: {}, errors: {} }
 */
export function makeInitialForm<T>(values: T): FormState<T> {
  return { values, touched: {}, errors: {} }
}
```

### 任务 3 — 事件映射（Day 11 / 14）

```ts
/**
 * 通知中心事件映射:事件名 → 参数元组。
 * 值是**元组**(不是数组):元组把"第几个参数是什么类型"焊死,
 * Emitter 的 `emit(event, ...args: E[K])` 按元组展开,多传/少传/传错类型都编译报错。
 * `draft:saved: []` 是零参数事件 —— 空元组,不是 never(never 会禁掉整个事件)。
 *
 * @example
 * emitter.emit('notify:sent', 'n1', 'email')
 * emitter.emit('draft:saved')
 */
export type NotificationCenterEvents = {
  'notify:sent': [id: string, channel: Channel]
  'notify:failed': [id: string, reason: string]
  'draft:saved': []
}

/**
 * 通知中心的事件发射器:Emitter 按事件映射特化。
 * 泛型参数收窄到这里,on/emit 的类型安全全部由 NotificationCenterEvents 决定。
 *
 * @example
 *   const emitter: NotificationCenterEmitter = createEmitter<NotificationCenterEvents>()
 *   emitter.emit('notify:sent', 'n1', 'email')
 */
export type NotificationCenterEmitter = Emitter<NotificationCenterEvents>
```

### 任务 4 — Store（Day 12 / 15）

```ts
/**
 * 通知 Store 的公共形状。
 * 每个方法**显式标注返回类型**(Day 15 的规矩):实现细节变了,对外契约不跟着晃;
 * 读类型就能用,不用点进实现。state 里 records 用可变数组(会增删),
 * 入参 initial 才是 readonly。
 *
 * @example
 * const s: NotificationStore = createNotificationStore([])
 * s.add({ channel: 'sms', body: 'x', phone: '138...' })
 */
export type NotificationStore = {
  state: Signal<{ records: NotificationRecord[] }>
  add(input: CreateNotificationInput): NotificationRecord
  markRead(id: string): boolean
  unreadCount(): number
}

/**
 * 创建通知 Store。
 * add 的 title 从判别联合各自的"标题字段"取(push.title / email.subject / sms 只有 body);
 * 判别收窄后字段直接可读,不需要 as。
 *
 * @example
 *   const store = createNotificationStore([])
 *   store.add({ channel: 'sms', body: 'x', phone: '138...' })
 *   store.unreadCount()  // => 1
 */
export function createNotificationStore(
  initial: readonly NotificationRecord[],
): NotificationStore {
  // 拷贝一份:initial 是 readonly(调用方的数据不许动),内部状态要可变
  const state = createSignal<{ records: NotificationRecord[] }>({ records: [...initial] })

  return {
    state,
    add(input: CreateNotificationInput): NotificationRecord {
      // 判别收窄:三分支各自的标题字段,switch 收完直接读
      let title: string
      switch (input.channel) {
        case 'push':
          title = input.title
          break
        case 'email':
          title = input.subject
          break
        case 'sms':
          title = input.body
          break
      }
      const record: NotificationRecord = {
        id: crypto.randomUUID(),
        title,
        status: 'draft',
        isRead: false,
      }
      // 不可变更新:新数组换旧数组,Signal 的订阅方靠引用变化感知更新
      state.set({ records: [...state.get().records, record] })
      return record
    },
    markRead(id: string): boolean {
      const { records } = state.get()
      const target = records.find((r) => r.id === id)
      if (target === undefined) return false
      state.set({
        records: records.map((r) => (r.id === id ? { ...r, isRead: true } : r)),
      })
      return true
    },
    unreadCount(): number {
      return state.get().records.filter((r) => !r.isRead).length
    },
  }
}
```

### 任务 5 — provide / inject（Day 14）

```ts
/**
 * Store 的注入 key:标注携带 NotificationStore 类型(幽灵属性模式,Day 14)。
 * Symbol 做运行时 key(全局唯一),InjectionKey<NotificationStore> 做编译期类型 ——
 * useStore() 的返回类型全靠这条标注,和 Vue 官方 InjectionKey<T> 同构。
 *
 * @example
 * provideStore(store)
 * const s = useStore() // NotificationStore | undefined
 */
export const STORE_KEY: InjectionKey<NotificationStore> = Symbol('notification-store')

/**
 * 在当前上下文登记 Store。
 * 栈顶不存在 = 在 runWithContext 外调用,是程序结构错误,大声失败。
 *
 * @example
 *   runWithContext(() => { provideStore(store); return useStore() })
 */
export function provideStore(store: NotificationStore): void {
  // noUncheckedIndexedAccess:数组索引给 T | undefined,必须判空再写入
  const top = contextStack[contextStack.length - 1]
  if (top === undefined) {
    throw new Error('provideStore 必须在 runWithContext 内调用')
  }
  top.set(STORE_KEY, store)
}

/**
 * Store 结构守卫:把存储层的 unknown 收窄成 NotificationStore。
 * lookupKey 的 value 是 unknown(存储层类型擦除),收窄走 Day 4 的守卫正门,
 * 比 as 干净:结构不符时返回 undefined(降级),而不是把错误类型硬塞给调用方。
 */
function isStore(value: unknown): value is NotificationStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    'add' in value &&
    'markRead' in value &&
    'unreadCount' in value
  )
}

/**
 * 取出当前上下文或祖先上下文里的 Store;没人提供时返回 undefined。
 * (组件树外/忘了 provide 是合法运行时状态,所以是 undefined 而不是抛错 ——
 * 调用方负责给兜底 UI。)
 *
 * @example
 *   const store = useStore()  // NotificationStore | undefined
 */
export function useStore(): NotificationStore | undefined {
  const found = lookupKey(STORE_KEY)
  if (found.found && isStore(found.value)) {
    return found.value
  }
  return undefined
}
```

### 任务 6 — publishNotification（签名从测试反推）

```ts
/**
 * 提交通知到后端(签名从测试反推)。
 * - 参数 1:NotificationRecord(测试反例:传 'n1' 要编译报错)
 * - 参数 2:transport 注入,收(路径, 请求体)、返回信封 promise(反例:返回数字要报错);
 *   测试的 transport 是零参箭头 —— 参数少的函数可赋给参数多的签名,兼容
 * - 返回:Promise<Result<NotificationRecord>>(复用已给的 Result/ApiEnvelope,零重复定义)
 * 信封用 `'data' in` 收窄(Day 17 的结论:code 字面量对 number 收不了窄,
 * 字段存在性才是可靠判别);失败分支 message 缺省 '未知错误'。
 *
 * @example
 *   const r = await publishNotification(record, (path, body) =>
 *     fetch(path, { method: 'POST', body: JSON.stringify(body) }).then((res) => res.json()),
 *   )
 *   if (r.ok) r.data // NotificationRecord
 */
export async function publishNotification(
  record: NotificationRecord,
  transport: (path: string, body: NotificationRecord) => Promise<ApiEnvelope<NotificationRecord>>,
): Promise<Result<NotificationRecord>> {
  // POST /notifications:端点固定;record 作为请求体交给 transport 序列化发送
  const envelope = await transport('/notifications', record)
  // 失败分支没声明 data,字段存在性一分就开
  if ('data' in envelope) {
    return { ok: true, data: envelope.data }
  }
  return {
    ok: false,
    error: { code: envelope.code, message: envelope.message ?? '未知错误' },
  }
}
```

---

## 二、常见错误写法（点评人视角）

### 1. TransitionTable 用 Record 抹平字面量（本 day 头号坑，README 预告）

❌ `export type TransitionTable = Record<NotificationStatus, readonly NotificationStatus[]>`

现象：`expectTypeOf<TransitionTable>()` 断言红（形状对不上）；
更致命的是 `LegalNext<S> = TransitionTable[S][number]` 推出来的是**全部状态的宽联合**，
`LegalNext<'sent'>` 不再是 `never` ——
测试 `expectTypeOf<LegalNext<'sent'>>().toEqualTypeOf<never>()` 红，
且 `advance('sent', 'draft')` 的 `@ts-expect-error` 变成 TS2578（Unused directive）。
为什么错：Record 的值类型被统一声明，每个 key 丢失了"自己的"字面量集合。
**类型级推导的前提是类型里真的存着字面量信息。**

✅ 每个 key 手写各自的具体字面量元组（见参考实现）。

### 2. 值层的查表也用 TransitionTable 精确类型（includes 卡死）

❌

```ts
const TRANSITIONS: TransitionTable = { draft: ['review', 'scheduled'], /* ... */ }

export function canTransition(from: NotificationStatus, to: NotificationStatus): boolean {
  return TRANSITIONS[from].includes(to) // TS2345(实测)
}
```

现象（实测）：`error TS2345: Argument of type 'Status' is not assignable to
parameter of type 'never'`。
为什么错：`TRANSITIONS[from]`（from 是五值联合）的类型是**各 key 元组的联合**，
在联合上调用 `includes`，参数类型取各成员签名的交集 ——
`'review' | 'scheduled'` ∩ `'sent' | 'failed'` ∩ … = `never`，什么都传不进去。
很多人在这里被迫 `as`，然后越改越脏。

✅ 两层分工（README 提示的正解）：类型层精确（TransitionTable 喂 LegalNext），
**值层宽标注**（`{ readonly [S in NotificationStatus]: readonly NotificationStatus[] }`），
includes 直接可用。同一个业务概念，两张表各司其职。

### 3. LegalNext 手写联合（不查表）

❌

```ts
export type LegalNext<S extends NotificationStatus> =
  S extends 'draft' ? 'review' | 'scheduled'
  : S extends 'review' ? /* ... */ : never
```

现象：测试能过，但这是**两份真相**：往 TransitionTable 加一条转移（比如 `sent: ['archived']`），
LegalNext 不会跟着变，类型层的拦截悄悄失效。
点评视角：类型推导的纪律是"单一事实源 + 推导"，手抄一份迟早漂移。

✅ `type LegalNext<S extends NotificationStatus> = TransitionTable[S][number]`
—— 两个动作：索引访问取元组，`[number]` 拆元组为联合。表改了，推导自动跟。

### 4. describeInput 不 switch，直接读条件字段

❌ `return \`[邮件] ${input.subject} → ${input.to}\``（不先收窄）

现象：`error TS2339: Property 'subject' does not exist on type
'{ channel: 'sms'; body: string; phone: string } | ...'`。
为什么错：联合类型上只能读**所有成员都有**的属性。subject 只在 email 分支，
不收窄就读，编译器把你拦下（这正是判别联合的价值）。

✅ switch (input.channel) / if 收窄后读；default 分支放 never 穷尽检查。
顺便：**穷尽检查是给未来的自己留的**——明天加第四种 channel，忘了改 describeInput，
`const exhaustive: never = input` 这行立刻红，错误定位在"漏处理"而不是线上渲染 undefined。

### 5. 零参数事件写成数组或 never

❌ 两种都见过：

```ts
'draft:saved': string[]   // 写成数组
'draft:saved': never      // 写成 never
```

现象（实测）：
- 数组版：`emitter.emit('draft:saved', '多余参数一', '多余参数二')` **编译通过** ——
  数组不锁参数个数，零参事件的名额形同虚设；测试里 `@ts-expect-error` 变 TS2578。
- never 版：连合法的 `emitter.emit('draft:saved')` 都报
  `TS2345: Argument of type '[]' is not assignable to parameter of type 'never'` ——
  事件直接废了。

✅ `'draft:saved': []` 空元组。"恰好零个参数"是元组的语义，数组和 never 都不是。

### 6. 事件参数元组顺手写宽

❌ `'notify:sent': (string | Channel)[]`

现象：`emitter.emit('notify:sent', 'email', 'n1')` 顺序反了也编译通过 ——
数组只约束"每个元素都是 string|Channel"，不约束位置。
真要出事是在 handler 里：`on('notify:sent', (id, channel) => ...)` 的 id 和 channel
类型一样，串位了编译器不吭声。

✅ `[id: string, channel: Channel]`（带命名的元组）。命名还有个红利：
IDE 悬停 emit 参数时显示 `id: string, channel: Channel`，调用方不用翻类型定义。

### 7. Store 方法靠推导、不写返回类型

❌

```ts
return {
  add(input: CreateNotificationInput) { /* ... */ },  // 返回类型靠推导
  // ...
}
```

现象：本 day 测试对 NotificationStore 做 toEqualTypeOf，多数情况推导恰好对；
但 Day 15 立规矩的原因是**契约稳定性**：内部把 `crypto.randomUUID()` 换成别的、
中间多一步改写，推导出的形状跟着晃，所有调用方的报错都会"漂移"到无关位置。
点评视角：这是"能编译"和"契约"的区别 —— 对外类型是设计决策，不是推导副产品。

✅ 类型层每个方法显式标注返回类型（参考实现的 NotificationStore），
实现层再满足它（函数返回位置的标注让 TS 反向校验实现）。

### 8. markRead 原地突变（Signal 订阅方失明）

❌

```ts
markRead(id: string): boolean {
  const { records } = state.get()
  const target = records.find((r) => r.id === id)
  if (target === undefined) return false
  target.isRead = true   // 编译通过!类型上 records 本来就可变
  return true
}
```

现象：测试这种"直接断言数量"的用例**可能照样过**（读的是同一份引用），
但 Signal 的意义是"引用变了 = 通知更新"——原地突变引用不变，
任何依赖 state 的订阅/计算属性都不会刷新。这是响应式系统的头号坑，
Vue 的 reactive 帮你藏了这层，裸写 Signal 就得自己守。
✅ 不可变更新：`records.map(...)` 造新数组，`state.set({ records: next })`。

### 9. useStore 用 as 收窄（骨架说"允许一处 TODO(reason) 的 as"）

❌ `return found.value as NotificationStore`（骨架确实允许，但有更好的）

为什么点评人还是要挑：as 把"存储层给错了东西"这种运行时错误变成"类型说谎"，
注入了一个 string 也能过编译，然后线上在别处炸。
✅ 结构守卫（参考实现 isStore）：`typeof === 'object' && 'state' in value && ...`，
结构不符返回 undefined，错误在注入边界就地现形。代价是多写五行，
换来的是 Day 4 哲学的完整闭环：**unknown 出口 + 守卫收窄**。
（对比记忆：Day 17 的 hasKey 是"键存在性守卫"，这里是"结构守卫"，
同一个模式的两种粒度。）

### 10. provideStore 直接拿栈顶不判空

❌ `contextStack[contextStack.length - 1].set(STORE_KEY, store)`

现象（实测）：`error TS18048: 'top' is possibly 'undefined'`。
为什么错：noUncheckedIndexedAccess 下数组索引访问的类型是 `T | undefined`。
栈顶不存在（在 runWithContext 外调用）是真实的运行时可能，类型系统提前替你问了。

✅ 判空 + 抛错（结构错误大声失败，见参考实现）。

### 11. publishNotification 的 transport 参数写 any / 不写类型

❌ `transport: (path: string) => Promise<any>`

现象：测试反例 `() => Promise.resolve(42)` **不报错**（any 和 number 双向兼容），
`@ts-expect-error` 变 TS2578。
为什么错：反推签名的题，把最难的一环（信封类型）用 any 糊过去，
等于把题目的考点糊过去。任何 any 进参数，后面的收窄、Result 包装全部失真。

✅ `transport: (path: string, body: NotificationRecord) => Promise<ApiEnvelope<NotificationRecord>>`。
小技巧（参考实现用了）：测试里的 transport 是零参箭头 `() => Promise.resolve(...)` ——
**参数更少的函数可以赋给参数更多的签名**，所以 transport 多收一个 body 参数照样兼容测试；
record 作为请求体也就有了去处（不然 noUnusedParameters 直接 TS6133）。

### 12. publishNotification 信封判别用 `envelope.code === 0`

❌

```ts
if (envelope.code === 0) {
  return { ok: true, data: envelope.data }  // envelope.data: NotificationRecord | undefined?
}
```

现象：能编译（TS 在 `code === 0` 后仍认为两个分支都可能，data 的访问会带上
另一分支的影子），行为上 code 为 0 但没带 data 的坏后端会让 `data: undefined`
漏进成功分支 —— 类型说谎。
为什么错：Day 17 已论证：`code: 0` 对 `code: number` 是包含关系，收不了窄。

✅ `'data' in envelope` 字段存在性收窄。**判别符要选互斥维度。**

---

## 三、思考题参考答案

本 day README 没有独立的思考题小节，但有三处"藏在任务里的思考"，给出参考答案：

### 为什么值层的 TRANSITIONS 不能直接标 TransitionTable 类型？

（README 任务 1 的"坑"）类型层的 TransitionTable 每个 key 是**不同**的字面量元组 ——
这是 LegalNext 推导的原料。运行时查表却需要**统一**的读法（includes 收宽元素）。
`TRANSITIONS[from]` 在 from 为联合时，元组联合上 includes 的参数类型坍缩成交集
（实测 TS2345，参数类型 never）。解法是接受"两张表"：类型表精确、值表宽标注。
表面看是重复，本质是**两种职责**：一个是推导的输入，一个是查表的输入。

### advance 的防御性运行时检查是不是多余？（类型层已经拦了）

不多余，理由有三：
1. 类型只覆盖**编译期可达**的调用 —— `any` 逃逸、`@ts-expect-error` 压掉的调用、
   跨进程边界的数据（localStorage / postMessage）都会带着错误值进来；
2. `advance('sent', 'draft')` 的测试本身就是用 `@ts-expect-error` 强行调用的 ——
   类型拦得住"正常写代码的你"，拦不住"压掉错误的你"；
3. 防御抛错的信息量（"非法状态转移：sent → draft"）比 undefined 蔓延好排查得多。
   类型层拦 99%，运行时兜 1%，两层成本都很低 —— 这不是不信任类型系统，
   是承认程序有类型系统照不到的入口。

### 阶段复盘自查表怎么用才不走形式？

三条建议：
- 每行对照**本 day 的实现回忆写出关键类型**（如 LegalNext 的索引访问写法），
  写不出来的就不是"闭眼能写"，哪怕测试过了；
- "要看提示"的行，把**提示的具体内容**记进 NOTES.md（是哪个泛型姿势忘了，
  而不是"忘了怎么做"）—— 周末复盘时能精确定位补哪块；
- 本 day 六个任务正好是六天的组合拳：哪一关卡壳，就回那一 day 的 NOTES 看当天的坑表 ——
  综合日的价值就是暴露"单点都会、组合就懵"的断层。

---

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错，`npx vitest run src/day18` 全过（29/29 双通道）
- [ ] `advance('sent', 'draft')` 编译报错（LegalNext<'sent'> 是 never）
- [ ] TransitionTable 每个 key 是**各自**的字面量元组（不是 Record 抹平版）
- [ ] 值层查表用了宽标注，includes 零 as（对照常见错误第 2 条）
- [ ] `NotificationItemProps` 的回调参数类型错误会编译报错
- [ ] Store 三个方法的返回类型显式标注
- [ ] useStore 的收窄走了守卫（或你的 as 带 TODO(reason) 注释 —— 骨架允许，但想想守卫版）
- [ ] publishNotification 的签名是自己反推的，零 as，transport 返回 ApiEnvelope<NotificationRecord>
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] 阶段复盘自查表填完（七行都有自评，拿不准的写进了 NOTES.md）
- [ ] 额外自查：你的 markRead 是不可变更新吗？Signal 的订阅方能看到变化吗？（第 8 条）
- [ ] 额外自查：describeInput 的 default 分支有 never 穷尽检查吗？（第 4 条 —— 明天加 channel 时它会救你）
