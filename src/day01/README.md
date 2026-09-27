# Day 1 — 联合 / 交叉 / 字面量 / type vs interface

## 重学导读

**前置知识**：会写 JS 对象、函数、if/switch 即可；不要求先学泛型。

**今天要学会**：用类型描述“哪些通知合法”，并让分支自动知道可用字段。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 类型与值 | `const n = ...` 创建运行时值；`type N = ...` 描述值的形状，编译后不会生成校验代码。 |
| 字面量、联合、交叉 | `string` 接受任意字符串，`'email'` 只接受一个值；`A \| B` 表示满足其中一种，`A & B` 表示同时满足两者。交叉中冲突字段可能变成 never。 |
| 判别联合 | 把 type 与该分支必填字段放在同一个对象类型里。检查 type 后，编译器才能保留二者的关联；把所有字段写成可选会允许不完整数据。 |

### 动手顺序

先写三种通知的合法样例 → 定义公共字段和联合 → 做格式化与图标 → 最后做创建函数。创建函数先用判别联合参数；泛型 Extract 的对照留到 Day 8 后再回看。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么只有 email 分支可以读取 subject？增加一种通知后，怎样让遗漏的 switch 分支报错？
- **迁移**：把通知换成“银行卡 / 微信支付”，只写两种合法输入和一种应被拒绝的输入。
- **验收**：在项目根目录运行 `pnpm check:day 01`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

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

7. 写 `getNotificationIcon(n: Notification): 'mail' | 'phone' | 'bell'`,返回字面量联合。
8. 写 `createNotification`,要求:**传 `type: 'email'` 时 payload 必须有 `subject` / `body` / `to`,传错立刻编译报错**。
   - 先按测试中的调用形状定义判别联合参数，让 type 和 payload 放在同一分支，再用 switch 收窄。
   - 可在 Day 8 后对照泛型 `Extract` 方案，观察泛型实现体内收窄的限制。第一次学习不要求先解决这个难点。

### type 与 interface 先怎么选

两者都能描述普通对象；这里用 type 便于组合联合和交叉。interface 适合描述可扩展对象契约，但不能直接为一个联合类型起别名。不要把“本题用 type”理解成“对象只能用 type”。

## 验收点

运行 `pnpm check:day 01`，类型检查和运行时测试必须全部通过。

- [ ] 不允许出现 `any`(允许 `unknown`)
- [ ] 所有 `export` 的类型必须有 JSDoc 和一个使用示例(`@example`)
- [ ] `formatNotification` 用 `switch` 穷尽处理(借助 TS 的 `never` 检查更佳)
- [ ] `createNotification` 必须是**类型安全**的:传入 `type: 'email'` 时 `payload` 必须有 `subject` 字段,否则编译报错

## 写完后给我(我)的对话模板

把 `src/day01/solution.ts` 贴过来,说一句:
> 点评我的代码,指出所有不够严谨的地方,并解释为什么。

我会指出问题 → 你重写 → 我再点评 → 跑测试验收。

---

[开始重学](../../docs/LEARNING-ORDER.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 2](../day02/README.md)
