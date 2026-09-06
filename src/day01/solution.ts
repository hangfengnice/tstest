/**
 * Day 1 — 消息通知系统的类型设计
 *
 * 学习目标:
 *   1. 字面量类型 + 可辨识联合(discriminated union)
 *   2. 交叉类型抽公共字段
 *   3. type vs interface 的取舍
 *   4. 理解泛型上 Extract 不收窄的限制,用判别联合参数替代(踩坑记录见 NOTES.md)
 *
 * 规则:
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 所有 export 必须有 JSDoc + @example
 *   - 自己先写,写不出来再看测试反推
 */

// =============================================================
// 类型定义
// =============================================================

/**
 * 通知来源类型 —— 三种枚举值,字面量联合而非宽 string,
 * 这样才能在 discriminated union 里做辨识符。
 */
export type NotificationType = 'email' | 'sms' | 'push'

/**
 * 通知公共字段 —— 任何通知都有的元数据。
 *
 * @example
 *   const meta: BaseNotification = {
 *     id: 'n1',
 *     createdAt: '2026-09-02T10:00:00Z',
 *     isRead: false,
 *   }
 */
export type BaseNotification = {
  id: string
  createdAt: string
  isRead: boolean
}

/** 邮件通知 —— subject + body + to,(可选 cc) */
export type EmailNotification = BaseNotification & {
  type: 'email'
  subject: string
  body: string
  to: string
  cc?: string
}

/** 短信通知 —— phone + body */
export type SmsNotification = BaseNotification & {
  type: 'sms'
  phone: string
  body: string
}

/** 推送通知 —— deviceId + title + body */
export type PushNotification = BaseNotification & {
  type: 'push'
  deviceId: string
  title: string
  body: string
}

/**
 * 通知联合类型 —— 可辨识联合(discriminated union)的并集。
 *
 * **为什么用 type 不用 interface**:`Notification` 是三种通知的并集,
 * `interface` 无法表达联合类型(`A | B`);且本类型**不需要**声明合并能力,
 * 所以用 `type`。若日后需要扩展全局 `Notification` 形状,改用 `interface`
 * 并利用声明合并(declaration merging)。
 */
export type Notification =
  | EmailNotification
  | SmsNotification
  | PushNotification

/**
 * 通知图标名 —— 与 NotificationType 的映射见 getNotificationIcon。
 * 独立定义而非复用 NotificationType:图标域和业务类型域各自演化,
 * 硬绑一起会让"加一种通知但暂不配图标"变得不可能。
 *
 * @example
 *   const icon: IconName = 'mail'
 */
export type IconName = 'mail' | 'phone' | 'bell'

// =============================================================
// 函数实现
// =============================================================

/**
 * 把通知格式化成展示字符串(用于消息中心列表渲染)
 *
 * @example
 *   formatNotification({
 *     type: 'email',
 *     id: '1', createdAt: '2026-09-02T00:00:00Z', isRead: false,
 *     subject: 'hi', body: '...', to: 'a@b.com',
 *   })
 *   // => '[邮件] hi — a@b.com'
 */
export function formatNotification(n: Notification): string {
  switch (n.type) {
    case 'email':
      return `[邮件] ${n.subject} — ${n.to}`
    case 'sms':
      return `[短信] ${n.body} — ${n.phone}`
    case 'push':
      return `[推送] ${n.title} — ${n.deviceId}`
    default:
      const _exhaustiveCheck: never = n
      return _exhaustiveCheck
  }
}

/**
 * 根据通知类型返回图标名 —— 映射关系固定,用查表替代 switch。
 * 穷尽性保障换了位置但没丢:typeToIcon 必须覆盖 NotificationType 的
 * 每个成员,否则 n.type 索引处直接编译报错(比 default: never 报得更早)。
 *
 * @example
 *   getNotificationIcon(emailNotif)  // => 'mail'
 */
const typeToIcon = {
  email: 'mail',
  sms: 'phone',
  push: 'bell',
} as const

export function getNotificationIcon(n: Notification): IconName {
  return typeToIcon[n.type]
}

/**
 * 创建通知的输入 —— 判别联合参数让 TS 自动按 type 收窄 payload。
 * 不需要重载、不需要 as、零逃生通道。
 *
 * @example
 *   createNotification({
 *     type: 'email',
 *     payload: { subject: 'hi', body: '...', to: 'a@b.com' },
 *   })
 *   // 返回 EmailNotification,id / createdAt / isRead 自动补全
 */
/**
 * 通知的"用户可填"载荷 —— 去掉系统生成的元字段(id/createdAt/isRead)和判别符。
 * 泛型化(Day 2 知识回炉):Omit 的字段清单从三份收成一份,
 * 以后调整"哪些字段算系统字段"只改这一处。
 *
 * @typeParam N - 具体某种通知(extends Notification 约束,不能乱传)
 */
type CreatePayload<N extends Notification> = Omit<
  N,
  'id' | 'createdAt' | 'isRead' | 'type'
>

export type CreateNotificationInput =
  | { type: 'email'; payload: CreatePayload<EmailNotification> }
  | { type: 'sms'; payload: CreatePayload<SmsNotification> }
  | { type: 'push'; payload: CreatePayload<PushNotification> }

/**
 * 工厂函数 —— 按 type 收窄 payload,补全系统字段后返回对应通知。
 * 三个分支的公共骨架(id/createdAt/isRead)提炼为 base,分支只声明差异。
 *
 * @example
 *   createNotification({
 *     type: 'email',
 *     payload: { subject: 'hi', body: '...', to: 'a@b.com' },
 *   })
 */
export function createNotification(
  input: CreateNotificationInput,
): Notification {
  // 系统生成的公共元数据,三个分支共用
  const base = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    isRead: false,
  }
  switch (input.type) {
    case 'email':
      return { type: 'email', ...base, ...input.payload }
    case 'sms':
      return { type: 'sms', ...base, ...input.payload }
    case 'push':
      return { type: 'push', ...base, ...input.payload }
    default:
      const _exhaustiveCheck: never = input
      return _exhaustiveCheck
  }
}
