# Day 1 复盘笔记

> 记录于 2026-09-02 ~ 09-03。周末复盘时以此为准,可随时补充修正。

## 今天我主动设计了什么

- `BaseNotification` 公共字段分层 + 三种通知用交叉类型组合
- `formatNotification` / `getNotificationIcon` 的 `switch` + `never` 穷尽检查
- 自己扩展 `EmailNotification.cc?: string`(可选字段实验)
- 发现测试里 `as never` 擦掉报错后,主动改成 `expectTypeOf(...).not.toMatchTypeOf<...>()` 静态断言

## 哪里依赖了 AI

- `createNotification` 最终方案(`CreateNotificationInput` 判别联合参数)是 AI 给的,**自己没有从零推出来**
- "泛型上 `Extract` 不收窄"、"`Omit<联合>` 求交集"这两个结论是 AI 讲的,还没亲手二次验证 ← **Day 2 安排复验**

## 踩的坑(带错误码,周末复盘用)

| 错误码 | 现象 | 根因 |
|---|---|---|
| ts(2578) | Unused '@ts-expect-error' directive | `as never` 把报错擦掉了,指令落空 |
| ts(2352) | Conversion ... may be a mistake | 一段式 `as` 强转,源/目标类型重叠度不够 |
| ts(2322) | missing `subject`, `to` | 泛型 `K` 上 `Extract<Union, { type: K }>` 不收窄,payload 几乎没有字段 |
| ts(2322) | missing ...(第二次) | `Omit<联合, Keys>` = 各分支分别 Omit 后**求交集**,只剩 `{ body }` |

## 一句话带走

> "参数 A 决定参数 B 的形状" → 优先**判别联合参数** `{ type, payload }` + switch 收窄;不用泛型 Extract,不用函数重载,零 `as`。