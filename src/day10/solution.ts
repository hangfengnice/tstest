/**
 * Day 10 — 状态机类型:消息发送流转(可辨识联合 + 合法转移函数)
 *
 * 学习目标:
 *   1. 用可辨识联合建模"流程状态",每个状态携带自己的数据
 *   2. 用映射类型把"合法转移表"写进类型系统(转移表放错值直接编译报错)
 *   3. noUncheckedIndexedAccess:查表结果是 T | undefined
 *   4. 🔴 transition 的重载签名(从测试反推)—— Day 2 实验 2 的正解落地
 *
 * 规则:
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 所有 export 必须有 JSDoc + @example
 *   - 类型占位是 never,函数体是 throw new Error('TODO'),逐个替换
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
export type SendStatus = never // ← 替换

/**
 * 草稿 —— 刚写完内容,还没点发送。
 *
 * @example
 *   const m: DraftMessage = { status: 'draft', content: '在吗' }
 */
export type DraftMessage = never // ← 替换

/**
 * 发送中 —— 已发起请求,requestId 用来对账;
 * attempt 记录第几次尝试(重试时 +1)。
 *
 * @example
 *   const m: SendingMessage = { status: 'sending', content: '在吗', requestId: 'req-1', attempt: 1 }
 */
export type SendingMessage = never // ← 替换

/**
 * 已送达 —— 终态。messageId 是服务端分配的消息 ID。
 *
 * @example
 *   const m: SentMessage = { status: 'sent', content: '在吗', messageId: 'm-9', sentAt: '2026-09-03T10:00:00Z' }
 */
export type SentMessage = never // ← 替换

/**
 * 发送失败 —— reason 是失败原因;重试回到 sending,attempt 延续。
 *
 * @example
 *   const m: FailedMessage = { status: 'failed', content: '在吗', requestId: 'req-1', reason: '网络超时', attempt: 1 }
 */
export type FailedMessage = never // ← 替换

/**
 * 消息发送状态机 —— 四个状态的联合。
 *
 * 思考:为什么每个状态自带数据,而不是 { status; data? } 一个大对象?
 *
 * @example
 *   const s: MessageSendState = { status: 'draft', content: '在吗' }
 *   if (s.status === 'sending') s.requestId  // 已收窄
 */
export type MessageSendState = never // ← 替换

// =============================================================
// Part 2 — 进阶:合法转移表
// =============================================================

/**
 * 合法转移表(纯类型层):键是"从哪来",值是"能去哪"的字面量联合。
 *
 * 提示:sent 行用什么类型表达"哪里都去不了"?
 *
 * @example
 *   type FromDraft = AllowedTransitions['draft']  // => 'sending'
 *   type FromSent = AllowedTransitions['sent']    // => never
 */
export type AllowedTransitions = never // ← 替换

/**
 * 转移表(类型 + 值双重约束):每一行只能放该状态允许的目标状态。
 *
 * 提示:映射类型 { [K in SendStatus]: ...(依赖 AllowedTransitions[K])... },
 * 让 sent 行的值类型是 never[],放任何非空数组都编译报错。
 *
 * @example
 *   const table: TransitionTable = {
 *     draft: ['sending'],
 *     sending: ['sent', 'failed'],
 *     sent: [],            // never[] —— 只能空
 *     failed: ['sending'],
 *   }
 *   // table.draft = ['sent'] ← 编译报错:draft 不允许直接到 sent
 */
export type TransitionTable = never // ← 替换

/**
 * 判断从 from 到 to 的转移是否合法。
 *
 * 注意 noUncheckedIndexedAccess:TRANSITIONS[from] 的类型是
 * readonly SendStatus[] | undefined,查表结果必须处理 undefined。
 *
 * @example
 *   isTransitionAllowed('draft', 'sending')  // => true
 *   isTransitionAllowed('sent', 'sending')   // => false(终态)
 */
export function isTransitionAllowed(from: SendStatus, to: SendStatus): boolean {
  // TODO: 查运行时转移表(表本身用 TransitionTable 锁死)
  // 提示:直接 TRANSITIONS[from].includes(to) 会踩两个坑——
  //   1) noUncheckedIndexedAccess:查表结果可能 undefined
  //   2) 各行数组类型不同,.includes 参数会被要求成交集 never
  void from
  void to
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:transition(签名从测试反推!)
// =============================================================

/**
 * 转移事件 —— 判别联合,to 是目标状态,其余字段是该转移需要的补充数据。
 *
 * 思考:为什么用事件对象而不是 (state, to, data) 三个参数?
 * (data 的形状由 to 决定,平铺参数表达不了这种依赖)
 *
 * @example
 *   const e: TransitionPayload = { to: 'sending', requestId: 'req-1' }
 */
export type TransitionPayload = never // ← 替换

/**
 * 状态转移函数 —— **占位签名是错的**,从 solution.test.ts 反推。
 *
 * 要求:
 *   - 四条合法转移(draft→sending / sending→sent / sending→failed / failed→sending),
 *     每条返回类型精确到目标状态(传 draft + { to: 'sending' } 得到 SendingMessage)
 *   - 非法转移类型层就没有匹配的签名(编译报错)
 *   - 运行时再兜一道:非法转移抛 Error,信息含"非法转移"
 *
 * 提示:Day 2 实验 2 验证过"泛型上 Extract 不收窄",
 * 想想什么手段能让"参数组合 → 返回类型"一一对应。
 *
 * 运行时规则:
 *   - to 'sending':从 draft 来 attempt = 1,从 failed 重试 attempt + 1
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
export function transition(state: never, event: never): never {
  // TODO: 签名自己设计(测试就是规格),实现用 switch (event.to) 收窄 payload
  void state
  void event
  throw new Error('TODO')
}
