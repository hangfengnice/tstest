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
/**
 * 实验 1 产物:Omit<联合, Keys> 先分发到每个联合分支、分别 Omit,
 * 再对结果求交集 —— 这里只剩 { body: string }(email/sms 共有的字段)。
 */
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

/**
 * 对话 —— 对话列表页的单条数据(chipRunner)。
 * updatedAt 存 ISO 8601 字符串,展示时再按本地时区格式化。
 *
 * @example
 *   const c: Conversation = {
 *     id: 'c1',
 *     title: '关于部署的讨论',
 *     updatedAt: '2026-09-03T09:00:00Z',
 *     messageCount: 3,
 *   }
 */
export type Conversation = {
  id: string
  title: string
  updatedAt: string
  messageCount: number
}

/**
 * 分页元信息 —— 后端通用分页约定。
 * 注意 total 是跨**所有页**的总条数,≠ 当前页 items.length
 * (renderState 数"当前页几个对话"必须用 items.length,不是 total)。
 *
 * @example
 *   const p: Pagination = { page: 1, pageSize: 20, total: 42 }
 */
export type Pagination = {
  page: number
  pageSize: number
  total: number
}

/**
 * 分页包装 —— "一页数据"的通用结构:任意元素数组 + 分页元信息。
 *
 * 为什么 items 不直接写 `Conversation[]`:所有列表页的结构只有元素类型不同,
 * 写死就得为每种列表(用户页、消息页…)各复制一份结构;参数化后一份定义通吃,
 * 结构演进(比如以后加 totalPages)也只改一处。
 *
 * @typeParam T - 当前页元素类型
 * @example
 *   const page: Paged<Conversation> = {
 *     items: [conversation],
 *     pagination: { page: 1, pageSize: 20, total: 1 },
 *   }
 *   // 换元素类型零成本:Paged<User>、Paged<string> 直接可用
 */
export type Paged<T> = {
  items: T[]
  pagination: Pagination
}

// =============================================================
// Part 2 — 进阶:可辨识联合建模请求状态
// =============================================================

/**
 * 后端错误约定 —— code 是业务错误码,message 是可直接展示给用户的文案。
 *
 * @example
 *   const e: ApiError = { code: 500, message: '服务器开小差了' }
 */
export type ApiError = {
  code: number
  message: string
}

/**
 * 请求四态 —— useAsyncData 背后的核心模型:idle → loading → success | error。
 *
 * 判别符是 status(每个分支各自的字面量)。拆成四个分支而非"一个对象 +
 * data?/error? 可选字段",换来两件事:
 *   - 非法状态无法表示(构造不出 { status: 'success', error: ... })
 *   - switch 收窄后分支内字段必有,调用侧不需要 ?. / ?? 兜底
 *
 * 与 Result 的分工:RequestState 含过程态(idle/loading),面向 UI 渲染;
 * Result 只有成败,面向函数返回值,把"抛异常"变成类型里的一个分支。
 *
 * @typeParam T - success 态携带的数据类型
 * @example
 *   const loading: RequestState<Paged<Conversation>> = { status: 'loading' }
 *   const ok: RequestState<number> = { status: 'success', data: 42 }
 */
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
    }

/**
 * Rust 风格结果类型 —— 两态,判别符是布尔字面量 ok(判别符不必是 string)。
 *
 * @typeParam T - 成功时的数据类型
 * @typeParam E - 失败时的错误类型
 * @example
 *   const ok: Result<number, ApiError> = { ok: true, data: 42 }
 *   const err: Result<number, ApiError> = {
 *     ok: false,
 *     error: { code: 500, message: '服务器开小差了' },
 *   }
 */
export type Result<T, E> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: E
    }

/**
 * 渲染请求状态为展示文案(列表页用)
 *
 * @example
 *   renderState({ status: 'loading' })  // => '加载中…'
 *   renderState({ status: 'success', data: { items: [], pagination: { page: 1, pageSize: 20, total: 0 } } })
 *   // => '共 0 个对话'
 */
export function renderState(state: RequestState<Paged<Conversation>>): string {
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
 * Result 的 map 组合子 —— 成功分支用 fn 转换 data,失败分支原样透传(不调用 fn)。
 *
 * 推断提示:E 只出现在联合的**第二个**分支(error),T 在第一个(data)——
 * TS 5.6 从联合实参推断泛型时只认第一个分支,E 会退化为 unknown。
 * 需要精确 E 时用显式类型参数(见 solution.test.ts:146 的调用示例)。
 *
 * @typeParam T - 输入数据类型(推断锚点:result 的 data 分支 + fn 的参数)
 * @typeParam E - 错误类型(推断不可靠,见上)
 * @typeParam U - fn 的返回类型,决定返回值 data 的类型
 * @example
 *   const r: Result<number, ApiError> = { ok: true, data: 42 }
 *   mapResult(r, (n) => `共 ${n} 条`)
 *   // => { ok: true, data: '共 42 条' } —— 类型 Result<string, ApiError>
 */
export function mapResult<T, E, U>(
  result: Result<T, E>,
  fn: (data: T) => U,
): Result<U, E> {
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
 * 成功返回 data,失败返回 fallback(永不抛错)
 *
 * @example
 *   unwrapOr({ ok: false, error: { code: 500, message: 'x' } }, 0)
 *   // => 0
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  if (result.ok) {
    return result.data
  } else {
    return fallback
  }
}
