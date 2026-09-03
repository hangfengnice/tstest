# Day 1 — 联合 / 交叉 / 字面量 / type vs interface

## 业务场景

你正在做一个**消息中心**(类似 Slack 的通知列表)。系统会从三种来源接收通知:

| 来源 | 关键字段 |
|---|---|
| Email | `subject`(主题)、`body`(正文)、`to`(收件人) |
| SMS | `phone`(手机号)、`body`(正文) |
| Push | `deviceId`(设备 ID)、`title`(推送标题)、`body`(正文) |

每条通知都有公共字段:`id`(字符串)、`createdAt`(ISO 时间字符串)、`isRead`(布尔)。

## 任务(按难度梯度)

### 🟢 基础题

1. 用**字面量类型**定义 `NotificationType` 联合:`'email' | 'sms' | 'push'`。
2. 定义每种通知的**数据形状**,每种类型必须带一个 `type` 字段作为**可辨识符**,且这个字段必须是字面量类型(不能用 `string`)。
3. 在 JSDoc 里用一句话解释:**这里为什么用 `type` 而不是 `interface`?**

### 🟡 进阶题

4. 用**交叉类型**抽出公共字段,定义为 `BaseNotification`。
5. 定义 `Notification` 类型别名 = 三种通知的联合。
6. 写 `formatNotification(n: Notification): string`,用 `switch (n.type)` 分支处理。注意 `noFallthroughCasesInSwitch` —— 每个 case 必须 `return` 或 `break`。

### 🔴 进阶题

8. 写 `getNotificationIcon(n: Notification): 'mail' | 'phone' | 'bell'`,返回字面量联合。
9. 写 `createNotification<K extends NotificationType>(type: K, payload: Omit<Extract<Notification, { type: K }>, 'id' | 'createdAt' | 'isRead' | 'type'>): Notification`。思考:`Extract` 在这里起什么作用?为什么不用 `as` 强转?

## 验收点

跑 `pnpm typecheck` 和 `pnpm test` 必须全部通过。

- [ ] 不允许出现 `any`(允许 `unknown`)
- [ ] 所有 `export` 的类型必须有 JSDoc 和一个使用示例(`@example`)
- [ ] `formatNotification` 用 `switch` 穷尽处理(借助 TS 的 `never` 检查更佳)
- [ ] `createNotification` 必须是**类型安全**的:传入 `type: 'email'` 时 `payload` 必须有 `subject` 字段,否则编译报错

## 写完后给我(我)的对话模板

把 `src/day01/solution.ts` 贴过来,说一句:
> 点评我的代码,指出所有不够严谨的地方,并解释为什么。

我会指出问题 → 你重写 → 我再点评 → 跑测试验收。