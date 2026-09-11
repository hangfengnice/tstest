# Day 10 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下参考实现已通过本 day 全部验收测试(`npx vitest run src/day10` 38/38 全绿,`pnpm typecheck` 本 day 零错误)。

## 一、参考实现

```ts
/**
 * Day 10 — 状态机类型:消息发送流转
 *
 * 规则:零 any、零 as(本 day 确实能做到),export 带 JSDoc + @example
 */

// =============================================================
// Part 1 — 基础:状态建模
// =============================================================

/**
 * 消息发送状态机的四个状态名。
 *
 * @example
 *   const s: SendStatus = 'sending'
 */
export type SendStatus = 'draft' | 'sending' | 'sent' | 'failed'

/**
 * 草稿 —— 只带 content,没有别的。
 *
 * @example
 *   const m: DraftMessage = { status: 'draft', content: '在吗' }
 */
export type DraftMessage = {
  status: 'draft'
  content: string
}

/**
 * 发送中 —— requestId 用来对账,attempt 记第几次尝试(首发 1,重试 +1)。
 *
 * @example
 *   const m: SendingMessage = { status: 'sending', content: '在吗', requestId: 'req-1', attempt: 1 }
 */
export type SendingMessage = {
  status: 'sending'
  content: string
  requestId: string
  attempt: number
}

/**
 * 已送达 —— 终态。messageId 是服务端分配的消息 ID。
 *
 * @example
 *   const m: SentMessage = { status: 'sent', content: '在吗', messageId: 'm-9', sentAt: '2026-09-03T10:00:00Z' }
 */
export type SentMessage = {
  status: 'sent'
  content: string
  messageId: string
  sentAt: string
}

/**
 * 发送失败 —— reason 是失败原因;重试回 sending,attempt 延续 +1。
 *
 * @example
 *   const m: FailedMessage = { status: 'failed', content: '在吗', requestId: 'req-1', reason: '网络超时', attempt: 1 }
 */
export type FailedMessage = {
  status: 'failed'
  content: string
  requestId: string
  reason: string
  attempt: number
}

/**
 * 消息发送状态机 —— 四个状态的联合。
 *
 * 【为什么不用一个大对象堆可选字段?】
 *   1. 字段-状态绑定:sending 才有 requestId/attempt,sent 才有 messageId ——
 *      大对象里这些字段任何状态都"可能存在",谁跟谁配全靠人肉记忆;
 *   2. 收窄:draft 分支取 requestId 直接编译报错(测试反例锁死),
 *      大对象版是 undefined,运行时才炸;
 *   3. 互斥/终态:sent 终态 = 联合里 sent 行没有去处,大对象表达不了;
 *   4. 文档性:看四个成员就知道每步带什么数据。
 *
 * @example
 *   const s: MessageSendState = { status: 'draft', content: '在吗' }
 *   if (s.status === 'sending') s.requestId  // 已收窄
 */
export type MessageSendState =
  | DraftMessage
  | SendingMessage
  | SentMessage
  | FailedMessage

// =============================================================
// Part 2 — 进阶:合法转移表
// =============================================================

/**
 * 合法转移表(纯类型层):键是"从哪来",值是"能去哪"的字面量联合。
 *
 * sent 行用 never:never 是空联合,"sent 能去的状态"这个集合是空的,
 * never 正是这个语义的类型写法。
 *
 * @example
 *   type FromDraft = AllowedTransitions['draft']  // => 'sending'
 *   type FromSent = AllowedTransitions['sent']    // => never
 */
export type AllowedTransitions = {
  draft: 'sending'
  sending: 'sent' | 'failed'
  sent: never
  failed: 'sending'
}

/**
 * 转移表(类型 + 值双重约束)。
 *
 * `{ [K in SendStatus]: AllowedTransitions[K][] }` 的妙处:
 * **每行的值类型跟随行键** —— draft 行是 'sending'[],sent 行是 never[]。
 * 表写错(往 draft 行塞 'sent'),类型层当场拦截。
 *
 * @example
 *   const table: TransitionTable = {
 *     draft: ['sending'],
 *     sending: ['sent', 'failed'],
 *     sent: [],            // never[] —— 只能空
 *     failed: ['sending'],
 *   }
 */
export type TransitionTable = {
  [K in SendStatus]: AllowedTransitions[K][]
}

/**
 * 运行时转移表 —— 用 TransitionTable 锁死:
 * 类型在,值就必须对;改表必须先改 AllowedTransitions 类型,
 * "类型是设计,值是实现"双向咬合。
 */
const TRANSITIONS: TransitionTable = {
  draft: ['sending'],
  sending: ['sent', 'failed'],
  sent: [],
  failed: ['sending'],
}

/**
 * 判断从 from 到 to 的转移是否合法。
 *
 * 两个坑的实测结论:
 *   1. noUncheckedIndexedAccess 给**索引签名**和数组下标加 undefined;
 *      TRANSITIONS[from] 是有限键映射 + 全键联合访问,查表结果是
 *      各行数组类型的联合,**不含 undefined**(若存储换成 Record<string, ...>,
 *      TS2532 立刻出现 —— undefined 坑住在那边的住在索引签名上)。
 *   2. 各行数组类型不同,直接 .includes(to) 时参数被要求成各行元素
 *      类型的交集 = never(TS2345)。
 *      解法"窄存储、宽读取":先赋给 readonly SendStatus[]
 *      (所有行的数组都是它的子类型,向上提升合法),在宽类型上 includes。
 *
 * @example
 *   isTransitionAllowed('draft', 'sending')  // => true
 *   isTransitionAllowed('sent', 'sending')   // => false(终态)
 */
export function isTransitionAllowed(from: SendStatus, to: SendStatus): boolean {
  // 窄存储、宽读取:宽化后再 includes,参数类型不再打架
  const targets: readonly SendStatus[] = TRANSITIONS[from]
  return targets.includes(to)
}

// =============================================================
// Part 3 — 边界:transition(重载)
// =============================================================

/**
 * 转移事件 —— 判别联合,to 是目标状态,补充数据跟着 to 走。
 *
 * 为什么用事件对象而不是 (state, to, data) 三个参数:
 * data 的形状**由 to 决定**。平铺参数表达不了参数之间的依赖;
 * 事件对象把 to 做成判别符,和 Day 6 formatEvent 的结论同源:
 * **依赖关系靠对象成员表达,不靠参数列表**。
 *
 * @example
 *   const e: TransitionPayload = { to: 'sending', requestId: 'req-1' }
 */
export type TransitionPayload =
  | { to: 'sending'; requestId: string }
  | { to: 'sent'; messageId: string; sentAt: string }
  | { to: 'failed'; reason: string }

/**
 * 状态转移函数 —— 四条合法转移,每条一个重载。
 *
 * 【为什么是重载而不是泛型?】(Day 2 实验 2 的正解落地)
 * 想让"参数组合 → 返回类型"一一对应,泛型的路是
 * transition<S extends MessageSendState>(state, event): Extract<...>:
 * 但函数体内 Extract 在泛型上不收窄(Day 2 实测),而且
 * "draft + to'sent'"这种非法组合没有干净的方式从泛型里排除。
 * 重载天然是"签名表":每条 (输入形参, 返回类型) 显式成对,
 * 非法组合 = 没有签名匹配 = 编译报错;运行时再查表兜底抛 Error。
 *
 * 运行时规则:
 *   - to 'sending':从 draft 首发 attempt = 1,从 failed 重试 attempt + 1
 *   - to 'sent' / 'failed':从 sending 复制 requestId / attempt
 *   - content 全程透传
 *
 * @example
 *   const s1 = transition(
 *     { status: 'draft', content: '在吗' },
 *     { to: 'sending', requestId: 'req-1' },
 *   )
 *   // => { status: 'sending', content: '在吗', requestId: 'req-1', attempt: 1 }
 */
export function transition(
  state: DraftMessage,
  event: { to: 'sending'; requestId: string },
): SendingMessage
export function transition(
  state: SendingMessage,
  event: { to: 'sent'; messageId: string; sentAt: string },
): SentMessage
export function transition(
  state: SendingMessage,
  event: { to: 'failed'; reason: string },
): FailedMessage
export function transition(
  state: FailedMessage,
  event: { to: 'sending'; requestId: string },
): SendingMessage
export function transition(
  state: MessageSendState,
  event: TransitionPayload,
): MessageSendState {
  // 第一道防线(运行时):状态可能来自服务器等动态数据,类型帮不上忙
  if (!isTransitionAllowed(state.status, event.to)) {
    throw new Error(`非法转移:${state.status} → ${event.to}`)
  }

  switch (event.to) {
    case 'sending': {
      // 两条合法来源:draft 首发 attempt=1;failed 重试 attempt+1
      const attempt = state.status === 'failed' ? state.attempt + 1 : 1
      const next: SendingMessage = {
        status: 'sending',
        content: state.content,
        requestId: event.requestId,
        attempt,
      }
      return next
    }
    case 'sent': {
      const next: SentMessage = {
        status: 'sent',
        content: state.content,
        messageId: event.messageId,
        sentAt: event.sentAt,
      }
      return next
    }
    case 'failed': {
      // requestId / attempt 从 sending 透传;
      // 能走到这里 state 必是 sending(表已验证),收窄一下取字段
      if (state.status !== 'sending') {
        throw new Error(`非法转移:${state.status} → failed`)
      }
      const next: FailedMessage = {
        status: 'failed',
        content: state.content,
        requestId: state.requestId,
        reason: event.reason,
        attempt: state.attempt,
      }
      return next
    }
  }
}
```

## 二、常见错误写法(点评人视角)

### 1. transition 用泛型写(README 提示的正面对照)

```ts
// ❌ 看似"更 TS 高手"的路
function transition<S extends MessageSendState>(
  state: S,
  event: TransitionPayload,
): Extract<MessageSendState, { status: ... }>   // 怎么写?
```

三重死路:
- 返回类型要从"(S, event.to) 组合"算出目标状态 —— 条件类型在**泛型 S**上
  无法和 event 的字面量联动,`Extract` 在泛型上不收窄(Day 2 实验 2 的坑,
  Day 6 formatEvent 又撞一次);
- `draft + { to: 'sent' }` 这种非法组合,泛型约束表达不了"参数之间的排除";
- 即使凑出返回类型,函数体内 state 也是泛型,收窄字段照样卡。
✅ 重载:每条转移一行签名,参数组合和返回类型**成对出现**,
非法组合自然没有匹配签名。这不是退而求其次 —— "签名表"本来就是
表达有限映射的语言机制(业务代码里 axios 拦截器、事件重载天天在用,
只是没往类型上想)。

### 2. TransitionTable 弱化成 Record<SendStatus, SendStatus[]>

```ts
// ❌ 每行都是四状态数组 —— 约束没了
type TransitionTable = Record<SendStatus, SendStatus[]>
const table: TransitionTable = {
  draft: ['sending', 'sent'],   // ← 直接就错了,但编译器放行!
  ...
}
```

现象(实测):这行**不报错** —— 弱化的表什么值都收。
后果:测试里 `@ts-expect-error`(draft 直接到 sent)反例失效,
typecheck 报 "Unused '@ts-expect-error' directive"。
✅ 值类型必须**按行跟随**:`{ [K in SendStatus]: AllowedTransitions[K][] }`。
这个模式和 Day 6 EventEnvelope 同源:映射类型里用当前行键 K 去索引
另一个表,行与行的关联才建立得起来。

### 3. isTransitionAllowed 直接 .includes(骨架注释预告的坑)

```ts
// ❌
return TRANSITIONS[from].includes(to)
```

现象(实测):

```
error TS2345: Argument of type 'SendStatus' is not assignable to parameter of type 'never'.
  Type '"failed"' is not assignable to type 'never'.
```

为什么参数是 never:`TRANSITIONS[from]` 的类型是
`'sending'[] | ('sent'|'failed')[] | never[] | 'sending'[]`,
在联合上调用 includes,参数类型取各行参数的**交集** ——
'sending' ∩ ('sent'|'failed') ∩ never = never。
✅ 窄存储、宽读取:先 `const targets: readonly SendStatus[] = TRANSITIONS[from]`
再 includes。所有行的数组都是 `readonly SendStatus[]` 的子类型,
提升合法,参数回到 SendStatus。(Day 8 的 LooseStore 是同一问题的镜像。)

### 4. 把 undefined 坑安错了地方(nuance,实测过)

骨架 JSDoc 说 TRANSITIONS[from] 是 `readonly SendStatus[] | undefined` ——
**实测它不含 undefined**:noUncheckedIndexedAccess 只给**索引签名**
(`Record<string, ...>`)和数组下标加 undefined;TransitionTable 是
有限键映射,from: SendStatus 是全键联合,访问必然命中。
真正出现 TS2532 的写法是:

```ts
const byIndex: Record<string, AllowedTransitions[SendStatus][]> = {}
return byIndex[from].includes(to)
// error TS2532: Object is possibly 'undefined'.(实测)
```

✅ 结论照旧处理(查表先想 undefined),但要知道坑的门牌号:
**索引签名才有 undefined,有限映射没有**。
(验收清单那条"正确处理 undefined"在本实现里体现为:查表结果确实
检查过、不存在 undefined 分支需要处理 —— 处理的前提是先确认有没有。)

### 5. transition 忘了运行时兜底

```ts
// ❌ 只写四个重载 + 正常逻辑,非法组合直接穿透
```

现象:测试里 `transition(sent, { to: 'sending', ... })` 带
`@ts-expect-error`(类型层已拦)**但仍要真调用** —— 运行时必须抛
`/非法转移/`。类型系统只保护编译期,状态可能来自服务器等动态数据
(测的就是这个场景)。✅ 实现签名收 `MessageSendState + TransitionPayload`
(全集),第一步就查表,不合法就 throw —— 宽进严出。

### 6. sent 行用 `[] as never[]` 或空数组偷懒类型

```ts
// ❌ 想让 sent: [] 过,把 sent 行写成 unknown[] / SendStatus[]
type TransitionTable = { [K in SendStatus]: ... sent: SendStatus[] ... }
```

现象:`sent: ['sending']` 不再报错(终态约束消失),测试
"TransitionTable 拒绝终态出现任何目标"红。✅ sent 行的类型就是
`never[]`:空数组天然可赋,任何非空数组都放不进 ——
**never 在这里不是怪技巧,是"空集合"的正面表达**。

### 7. 重载顺序与实现签名(小坑)

- 实现签名(第五个)必须**最后**写,且参数要能覆盖全部重载
  (收全集 `MessageSendState + TransitionPayload`),返回给全集;
- 四条重载彼此互斥(状态类型不同),顺序无所谓;若日后出现
  "同一状态多个事件"的重载,把更具体的放前面(重载从上往下匹配)。

## 三、思考题参考答案

### Part 1 第 3 题:为什么不用一个大对象堆可选字段?

字段-状态绑定丢失(requestId 在任何状态都"可能存在")、收窄消失
(draft 取 requestId 从编译错误退化成运行时 undefined)、
终态表达不了(大对象没有"不许再转移"的概念)、自文档性归零。
状态机的"状态"不是一组开关,是**每种局面自带的数据形状** ——
可辨识联合一行一个成员,形状即文档。

### Part 2 第 4 题:sent 行用什么表达"哪里都去不了"?

never。`AllowedTransitions['sent']` 是"从 sent 出发能到达的状态"集合,
这个集合是空的,空集合的类型就是 never。连锁反应:TransitionTable 的
sent 行变成 never[],只能放空数组 —— 类型约束从"转移表"一路
传导到"运行时数据",一处声明,两层生效。

### Part 2 第 6 题:两个坑怎么处理?

见第二节第 3、4 条:includes 参数交集变 never(宽读取解决);
undefined 只属于索引签名(有限映射查表没有 undefined,
换 Record<string,...> 才会 TS2532)。

### Part 3 第 7 题:为什么用事件对象而不是 (state, to, data) 三参数?

data 的形状由 to 决定 —— 参数之间的依赖,平铺参数表达不了。
事件对象把 to 做成判别符,补充数据跟着成员走:
`{ to: 'sent'; messageId; sentAt }` 天然成组,
`transition(sending, { to: 'sent' })` 缺 messageId 直接编译错。
和 Day 6"formatEvent 吃判别联合而不是泛型双参"是同一条设计原则。

### Part 3 第 8 题:transition 为什么用重载?

见第二节第 1 条。补充一个记忆钩子:**泛型表达"一族签名"
(类型层面参数化),重载表达"有限张签名表"(值层面枚举)**。
状态机转移天然是有限表(4 条),用表不用族。

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] 零 `any`、零 `as`(本 day 应该可以做到)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 每个状态的数据只在该状态分支可见(draft 取 requestId 编译报错)
- [ ] `TransitionTable` 让非法转移表编译报错(两条反例生效)
- [ ] `transition` 四条转移返回类型精确;非法转移类型层报错 + 运行时抛错
- [ ] `isTransitionAllowed` 正确处理 noUncheckedIndexedAccess 的 undefined
- [ ] (自查)能说清 includes 参数为什么变 never、undefined 到底什么时候出现
