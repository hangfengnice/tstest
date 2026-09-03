/**
 * Day 25 — Zod 运行时校验 + z.infer 类型推导
 *
 * 学习目标:
 *   1. schema 是唯一事实来源:运行时校验 + 类型推导共用一份定义
 *   2. safeParse(不抛异常)vs parse(抛异常):自己管理错误路径
 *   3. error.issues 读取校验失败信息(path + message)
 *   4. z.discriminatedUnion:可辨识联合的 schema 版
 *
 * 规则:
 *   - z.never() 是占位符,整体替换成你的 z.object(...) / z.discriminatedUnion(...)
 *   - 类型一律 z.infer 推导,禁止手写重复接口
 *   - 不允许 any、不允许 as
 *   - 所有 export 必须有 JSDoc + @example
 */

import { z } from 'zod'

// =============================================================
// Part 1 — 🟢 第一个 schema + z.infer
// =============================================================

/**
 * 会话条目 schema —— /api/conversations 返回的单条数据。
 * 四个字段:id / title / updatedAt(string),messageCount(number)。
 *
 * @example
 *   conversationSchema.safeParse({ id: 'c1', title: '部署讨论', updatedAt: '2026-09-03T09:00:00Z', messageCount: 3 })
 *   // => { success: true, data: {...} }
 */
export const conversationSchema = z.never() // ← 替换:z.object({ ... })

/**
 * 会话条目类型 —— 从 schema 推导,**不要手写**。
 * schema 改字段,这里自动跟上,这就是"单一事实来源"。
 *
 * @example
 *   const c: Conversation = { id: 'c1', title: '部署讨论', updatedAt: 'x', messageCount: 3 }
 */
export type Conversation = z.infer<typeof conversationSchema>

// =============================================================
// Part 2 — 🟡 嵌套 schema + 安全解析
// =============================================================

/**
 * 分页响应 schema —— { items: Conversation 数组, pagination: { page, pageSize, total } }。
 *
 * @example
 *   pagedConversationSchema.safeParse({ items: [], pagination: { page: 1, pageSize: 20, total: 0 } })
 *   // => { success: true }
 */
export const pagedConversationSchema = z.never() // ← 替换:z.object({ items: ..., pagination: ... })

/**
 * 分页响应类型 —— 同样从 schema 推导。
 *
 * @example
 *   const p: PagedConversations = { items: [], pagination: { page: 1, pageSize: 20, total: 0 } }
 */
export type PagedConversations = z.infer<typeof pagedConversationSchema>

/**
 * 解析结果 —— Day 2 的 Result 模式回归:两态可辨识联合,判别符 ok。
 * 签名已给出,这是脚手架。
 *
 * @example
 *   const r: ParseResult<Conversation> = { ok: false, errors: ['id: expected string'] }
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] }

/**
 * 安全解析任意来源数据 —— 永不抛异常,任何输入都返回 ParseResult。
 *
 * 实现要求:
 *   1. 用 schema.safeParse(raw)(不要用 parse + try/catch)
 *   2. 成功 → { ok: true, data }
 *   3. 失败 → { ok: false, errors },每条格式 `${path.join('.')}: ${message}`
 *
 * @example
 *   safeParseApi(conversationSchema, JSON.parse('{"id":123}'))
 *   // => { ok: false, errors: ['id: Invalid input: expected string, received number'] }
 */
export function safeParseApi<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): ParseResult<T> {
  void schema
  void raw
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 🔴 可辨识联合 schema
// =============================================================

/**
 * 通知 schema —— Day 1 的可辨识联合,这次带运行时校验。
 * 用 z.discriminatedUnion('type', [email分支, sms分支]):
 *   email:type/id/subject/to(都是 string,type 是字面量 'email')
 *   sms:  type/id/phone/body(同上,字面量 'sms')
 *
 * @example
 *   notificationSchema.safeParse({ type: 'email', id: 'n1', subject: '上线', to: 'a@b.com' })
 *   // => { success: true }
 */
export const notificationSchema = z.never() // ← 替换:z.discriminatedUnion('type', [...])

/**
 * 通知类型 —— z.infer 推导出可辨识联合,可按 type 窄化。
 *
 * @example
 *   const n: AppNotification = { type: 'sms', id: 'n1', phone: '138...', body: '验证码' }
 */
export type AppNotification = z.infer<typeof notificationSchema>
