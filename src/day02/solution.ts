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

// 实验 2:泛型上 Extract 不收窄(2026-09-05 复验完成)
//
// 尝试 1:return 完整的 EmailNotification 对象(见下方注释掉的代码)→ ts(2322)。
//   报错关键信息:返回类型被展开为
//   Extract<EmailNotification, { type: K }> | Extract<SmsNotification, { type: K }> | Extract<PushNotification, { type: K }>
//   —— 三个条件类型原样挂着,没有收窄成任何分支。
// 尝试 2:悬停返回类型 Extract<Notification, { type: K }>,同样是三个 Extract 挂起;
//   对照字面量版本 Extract<Notification, { type: 'email' }>,它直接求值成 EmailNotification。
//
// 原因:Extract<T, U> = T extends U ? T : never。U 里含未落定的泛型 K,extends
//   无法判定 → 条件类型挂起(deferred)。函数体内 K 要对所有调用负责(调用方可能传
//   'sms' / 'push'),所以 return 任何单个分支的对象都不安全;只有调用点 K 落定,
//   返回类型才真正收窄(如 pickByType('email') 的返回值就是 EmailNotification)。
//
// 结论:一个参数的值决定另一块数据的形状时 → 用判别联合参数 + switch 收窄,
//   不要用泛型 Extract(签名对调用者漂亮,函数体却写不出来 —— 这个签名在类型上
//   不可实现,throw 是它唯一合法的函数体;删掉 throw 试试,会得到 ts(2366))。
export function pickByType<K extends NotificationType>(
  k: K,
): Extract<Notification, { type: K }> {
  void k
  // 尝试 1 的实验代码,观察完注释保留作证据:
  // return {
  //   type: 'email',
  //   id: 'x',
  //   createdAt: 'x',
  //   isRead: false,
  //   subject: 's',
  //   body: 'b',
  //   to: 't',
  // }
  // ↑ 取消注释即可复现 ts(2322)
  throw new Error('实验 2 结论:此签名类型上不可实现,throw 是唯一合法函数体')
}

// =============================================================
// Part 1 — 基础:业务数据 + 第一个泛型
// =============================================================

// TODO: Conversation —— 对话(id / title / updatedAt / messageCount)
export type Conversation = {
  id: string
  title: string
  updatedAt: string
  messageCount: number
} // ← 替换

// TODO: Pagination —— 分页(page / pageSize / total,都是 number)
export type Pagination = {
  page: number
  pageSize: number
  total: number
} // ← 替换

// TODO: Paged<T> —— 分页包装 { items: T[]; pagination: Pagination }
// JSDoc 必须回答:为什么 items 不直接写 Conversation[],而要引入泛型 T?
//  因为简化了 Paged 的复用,可以包装任何类型的 items,而不仅仅是 Conversation[]。
export type Paged<T> = {
  items: T[]
  pagination: Pagination
} // ← 替换

// =============================================================
// Part 2 — 进阶:可辨识联合建模请求状态
// =============================================================

// TODO: ApiError —— { code: number; message: string }
export type ApiError = {
  code: number
  message: string
} // ← 替换

// TODO: RequestState<T> —— 四态(idle / loading / success / error)
// JSDoc 必须回答:判别符是什么?和 Result 的使用场景对比?
// 判别符是 status,它是一个字面量联合类型,可以在 switch 里穷尽检查。
export type RequestState<T> =
  | {
      status: 'idle'
    }
  | {
      status: 'loading'
    }
  | {
      status: 'success'
      data: T
    }
  | {
      status: 'error'
      error: ApiError
    } // ← 替换

// TODO: Result<T, E> —— 两态({ ok: true, data: T } | { ok: false, error: E })
export type Result<T, E> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: E
    } // ← 替换

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
  switch (state.status) {
    case 'idle':
      return '还没有对话'
    case 'loading':
      return '加载中…'
    case 'success':
      return `共 ${state.data.items.length} 个对话`
    case 'error':
      return `出错了(${state.error.code}):${state.error.message}`
    default:
      const _exhaustiveCheck: never = state
      return _exhaustiveCheck
  }
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
export function mapResult<T, E, U>(
  result: Result<T, E>,
  fn: (data: T) => U,
): Result<U, E> {
  // TODO: 签名自己设计 —— 上面这个占位签名是错的,从测试反推正确签名
  if (result.ok) {
    return {
      ok: true,
      data: fn(result.data),
    }
  } else {
    return result
  }
}

/**
 * 成功返回 data,失败返回 fallback
 *
 * @example
 *   unwrapOr({ ok: false, error: { code: 500, message: 'x' } }, 0)
 *   // => 0
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  // TODO: 签名自己设计
  if (result.ok) {
    return result.data
  } else {
    return fallback
  }
  throw new Error('TODO')
}
