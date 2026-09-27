# Day 10 — 状态机类型:消息发送流转

## 重学导读

**前置知识**：Day 1–2 判别联合；Day 6 映射表。

**今天要学会**：同时约束合法状态、合法转移和转移产生的数据。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 状态与转移 | 状态描述“现在有什么”；转移描述“从哪里能到哪里”。同一个目标状态可能从不同来源到达，不能只校验目标名。 |
| never | 终态没有合法后继，用 never 表达空集合；它不是 null，也不是一个可返回的普通值。 |
| 重载 | 多个公开签名分别描述参数组合及结果，单个实现体处理运行时逻辑；实现签名不会自动作为额外调用方式公开。 |

### 动手顺序

先画四条合法边 → 为每个状态填数据 → 定义并检查转移表 → 做运行时查表 → 最后写精确返回类型的 transition。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：类型已拦非法转移，运行时为什么还查一次？从 failed 重试时哪些字段保留、哪些更新？
- **迁移**：设计一个审批流程，列出终态和重试路径，再给一条非法转移。
- **验收**：在项目根目录运行 `pnpm check:day 10`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 的聊天输入框里,每条消息都有发送状态。你肯定写过这种代码:

```
if (msg.status === 'sending' && msg.retryCount > 2) { ... }
```

但真正的发送流程是一个**状态机**,状态和它携带的数据是绑定的:

```
draft ──发送──▶ sending ──确认──▶ sent(终态)
                    │
                    └──失败──▶ failed ──重试──▶ sending(attempt + 1)
```

| 状态 | 携带数据 |
|---|---|
| `draft` | `content`(还没发) |
| `sending` | `content` + `requestId`(对账用)+ `attempt`(第几次尝试) |
| `sent` | `content` + `messageId` + `sentAt`(终态) |
| `failed` | `content` + `requestId` + `reason` + `attempt` |

合法转移**只有四条**:draft→sending、sending→sent、sending→failed、failed→sending。其余全部非法(sent 是终态;draft 不能直接 sent)。今天把这个约束同时做进**类型层**(编译期拦截)和**运行时**(动态数据兜底)。

---

## Part 1 — 🟢 基础:状态建模

1. `SendStatus`:四个字面量。
2. 四个状态类型 `DraftMessage` / `SendingMessage` / `SentMessage` / `FailedMessage`,每个自带 `status` 字面量判别符 + 该状态的数据(见上表)。
3. `MessageSendState` 联合。JSDoc 回答:为什么不用 `{ status; content; requestId?; messageId?; ... }` 一个大对象堆可选字段?

## Part 2 — 🟡 进阶:合法转移表

4. `AllowedTransitions` 映射类型:键 = 从哪来,值 = 能去哪的字面量联合。
   - `sent` 行用什么表达"哪里都去不了"?(想想 never)
5. `TransitionTable`:**值也受约束**的映射类型 —— `draft` 行只能放 `'sending'` 的数组,`sent` 行的值类型是 `never[]`(只能空数组)。声明运行时转移表 `TRANSITIONS` 并用它锁死。
6. `isTransitionAllowed(from, to)` —— 签名已给,填实现。**两个坑都在注释里**:
   - 宽字符串索引的字典读取可能得到 undefined；以合法键访问有限映射的必填键不自动增加 undefined，按实际声明判断;
   - 各行数组类型不同,直接 `.includes(to)` 参数会被要求成交集 `never` —— 想"窄存储、宽读取"。

## Part 3 — 🔴 边界:transition(签名从测试反推)

7. `TransitionPayload` 判别联合:`to` 是目标状态,补充数据跟着 `to` 走(发出去要 `requestId`,送达要 `messageId`+`sentAt`,失败要 `reason`)。
8. `transition(state, event)` —— **占位签名是错的**,从测试反推:
   - 四条合法转移各自返回**精确的目标状态类型**(传 draft + `{ to: 'sending' }` 得到 `SendingMessage`);
   - 非法转移(sent→sending、draft→sent……)在类型层就没有匹配的签名,编译报错;
   - 运行时再兜底:非法转移抛 Error(信息含"非法转移")。
   - **提示**:Day 2 实验 2 验证过"泛型上 `Extract` 不收窄"。想让"参数组合 → 返回类型"一一对应,还有别的语言机制(你在业务代码里见过,只是没往类型上想)。
   - attempt 规则:从 draft 首发是 1,从 failed 重试是 +1;requestId / attempt 在 sending → failed 时透传;content 全程不动。

---

## 验收清单

- [ ] `pnpm check:day 10` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 零 `any`;实现里至多一次 `as`,且带原因注释(应该可以做到零 `as`)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 每个状态的数据只在该状态分支可见(draft 分支取 `requestId` 编译报错,测试有反例)
- [ ] `TransitionTable` 让非法转移表编译报错(测试有两条反例)
- [ ] `transition` 四条转移返回类型精确;非法转移类型层报错 + 运行时抛错
- [ ] `isTransitionAllowed` 正确处理 `noUncheckedIndexedAccess` 的 undefined

## 写完后

贴 `src/day10/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 15 分钟 → Part 2 25 分钟 → Part 3 40 分钟(重载是今天的主角,值得磨)。

---

[上一题：Day 9](../day09/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 11](../day11/README.md)
