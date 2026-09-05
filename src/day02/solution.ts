/**
 * Day 2 — API 响应类型 + Result<T, E> + 泛型登场
 *
 * 学习目标:
 *   1. 复验 Day 1 结论(Omit<联合> 求交集 / 泛型上 Extract 不收窄)
 *   2. 泛型类型别名 Paged<T> —— 理解"为什么要参数化"
 *   3. RequestState<T> 四态可辨识联合(useAsyncData 的核心模型)
 *   4. Result<T, E> + 泛型组合子(mapResult / unwrapOr)
 *
 * 规则:
 *   - 签名自己设计,测试就是规格(从 solution.test.ts 反推)
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 0 — 复验实验(结论写进注释)
// =============================================================

import type {
  EmailNotification,
  SmsNotification,
  Notification,
  NotificationType,
} from '../day01/solution.js'

// 实验 1:Omit<联合> 求交集 —— 悬停 OmitResult 看结果
type EmailOrSms = EmailNotification | SmsNotification
export type OmitResult = Omit<
  EmailOrSms,
  'id' | 'createdAt' | 'isRead' | 'type'
>

// 实验 2:泛型上 Extract 不收窄
// 在函数体里试着 return 一个完整的 EmailNotification,把看到的报错写在这:
// Type '{ type: "email"; id: string; createdAt: string; isRead: false; subject: string; body: string; to: string; }' is not assignable to type 'Extract<EmailNotification, { type: K; }> | Extract<SmsNotification, { type: K; }> | Extract<PushNotification, { ...; }>'.
export function pickByType<K extends NotificationType>(
  k: K,
): Extract<Notification, { type: K }> {
  void k
  return {
    type: 'email',
    id: 'x',
    createdAt: 'x',
    isRead: false,
    subject: 's',
    body: 'b',
    to: 't',
  }
  // 尝试在这里 return { type: 'email', id: 'x', createdAt: 'x', isRead: false, subject: 's', body: 'b', to: 't' }
  // ↑ 取消注释,读报错,把结论写在上面注释区
  throw new Error('实验 2:先做观察,做完删掉这行')
}

// =============================================================
// Part 1 — 基础:业务数据 + 第一个泛型
// =============================================================

// TODO: Conversation —— 对话(id / title / updatedAt / messageCount)
export type Conversation = never // ← 替换

// TODO: Pagination —— 分页(page / pageSize / total,都是 number)
export type Pagination = never // ← 替换

// TODO: Paged<T> —— 分页包装 { items: T[]; pagination: Pagination }
// JSDoc 必须回答:为什么 items 不直接写 Conversation[],而要引入泛型 T?
export type Paged<T> = never // ← 替换

// =============================================================
// Part 2 — 进阶:可辨识联合建模请求状态
// =============================================================

// TODO: ApiError —— { code: number; message: string }
export type ApiError = never // ← 替换

// TODO: RequestState<T> —— 四态(idle / loading / success / error)
// JSDoc 必须回答:判别符是什么?和 Result 的使用场景对比?
export type RequestState<T> = never // ← 替换

// TODO: Result<T, E> —— 两态({ ok: true, data: T } | { ok: false, error: E })
export type Result<T, E> = never // ← 替换

/**
 * 渲染请求状态为展示文案(列表页用)
 *
 * @example
 *   renderState({ status: 'loading' })  // => '加载中…'
 *   renderState({ status: 'success', data: { items: [], pagination: { page: 1, pageSize: 20, total: 0 } } })
 *   // => '共 0 个对话'
 */
export function renderState(state: RequestState<Paged<Conversation>>): string {
  // TODO: switch + never 穷尽检查(昨天学的)
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:泛型组合子(签名自己设计!)
// =============================================================

/**
 * 成功分支用 fn 转换 data,失败分支原样透传(不调用 fn)
 *
 * @example
 *   const r: Result<number, ApiError> = { ok: true, data: 42 }
 *   mapResult(r, (n) => `共 ${n} 条`)
 *   // => { ok: true, data: '共 42 条' } —— 类型是 Result<string, ApiError>
 */
export function mapResult(result: never, fn: never): never {
  // TODO: 签名自己设计 —— 上面这个占位签名是错的,从测试反推正确签名
  void result
  void fn
  throw new Error('TODO')
}

/**
 * 成功返回 data,失败返回 fallback
 *
 * @example
 *   unwrapOr({ ok: false, error: { code: 500, message: 'x' } }, 0)
 *   // => 0
 */
export function unwrapOr(result: never, fallback: never): never {
  // TODO: 签名自己设计
  void result
  void fallback
  throw new Error('TODO')
}
