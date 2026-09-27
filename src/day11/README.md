# Day 11 — 类型安全的发布订阅事件系统

## 重学导读

**前置知识**：Day 6 事件映射、Day 8 条件类型；会用 Map/Set。

**今天要学会**：让事件名决定处理器参数，并处理无载荷事件与取消订阅。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 按键关联 | 用同一个 K 连接事件名和 E[K]；如果各写一个无关联联合，调用点可能把两个事件的数据配错。 |
| 参数元组 | rest 参数可以接收元组。空元组表示零个参数，单元素元组表示一个必传参数；条件类型决定是哪一种。 |
| 异构容器 | 不同事件的处理器有不同参数。内部统一存储会擦除信息，需要把断言限制在边界，并用同键写入/读取的规则支撑。 |

### 动手顺序

先写事件表 → 定义 on/off → 处理 emit 条件参数 → 再实现容器。用同一个函数引用测试 off，只删除指定订阅。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：无载荷事件与 payload 可选是一回事吗？为什么要求更多字段的处理器不能接收更宽的事件载荷？
- **迁移**：为全局提示设计成功、失败、关闭三类事件，并写出合法的调用形状。
- **验收**：在项目根目录运行 `pnpm check:day 11`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 是 Nuxt4 应用,你在两处用过"全局事件":跨组件的**全局通知**(顶部 toast)、**埋点上报**(登录、下单)。现在要做一个不依赖任何库的事件总线(mitt 的类型安全版),接到 `app.provide` 里全局可用。

事件规格(与后端/埋点组约定):

| 事件名 | payload |
|---|---|
| `notify:success` | `{ title: string; message: string }` |
| `notify:error` | `{ title: string; message: string; code: number }` |
| `user:login` | `{ userId: string }` |
| `modal:close` | 无 payload |

要求:**事件名拼错、payload 形状不对、该传参时不传、不该传参时硬塞 —— 全部编译报错**,而不是运行时才发现。

---

## Part 1 — 🟢 基础:事件表

1. `NotificationEvents`:事件名 → payload 的映射类型(规格见上表,`modal:close` 的值是 `undefined` 表示无 payload)。
   - **本题采用 type**，保留精确事件键；解释为什么测试中的无索引签名 interface 不满足 `Record<string, unknown>`。显式添加索引签名可满足约束，但会拓宽 keyof，影响未知事件名检查。
2. `EventHandler<E, K>`:处理事件 K 的处理器,参数就是 `E[K]`。

## Part 2 — 🟡 进阶:on / off / emit 泛型签名

3. `EventBus<E>` 接口,三个方法占位都是 `never`,从测试反推签名:
   - `on('user:login', h)`:h 的参数类型由事件名决定 —— **泛型 K extends keyof E**;
   - `off` 与 `on` 同签名(退订传同一个函数引用);
   - `emit`:事件名 + payload 联动(见 Part 3)。
4. `createEventBus<E>()` 工厂:内部 `Map<事件名, Set<handler>>`。
   - **参数逆变的死结**:存进去的 handler 各不相同,取出来统一调用 —— 没有任何统一的签名能同时"收得下所有 handler"和"可被安全调用"。提示:想想 `never` 在**参数位**的意义。内部允许**一次 `as`**,必须带 `// TODO(reason)` 注释说明为什么绕不开。

## Part 3 — 🔴 边界:emit 的条件参数

5. `emit` 的压轴约束:**无 payload 事件调用时不传参,有 payload 事件必须传**:
   - `emit('modal:close')` 合法,`emit('modal:close', {...})` 编译报错;
   - `emit('notify:success', { title, message })` 合法,`emit('notify:success')` 编译报错。
   - 提示:rest 参数 + 条件元组 —— `...args: E[K] extends undefined ? [] : [payload: E[K]]`。想清楚 `'modal:close'` 的值是 `undefined` 时,为什么正好走 `[]` 分支。

---

## 验收清单

- [ ] `pnpm check:day 11` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 零 `any`;`createEventBus` 内部至多一次 `as`,带 `// TODO(reason)` 注释
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 事件表用 type 定义,JSDoc 解释无索引签名 interface 在当前约束下为什么不行
- [ ] 未知事件名 on/emit 都编译报错(测试有反例)
- [ ] 无 payload 事件:emit 不传参合法、硬塞参数报错;handler 收到 undefined
- [ ] handler 参数类型由事件名联动:要求多余字段的 handler 编译报错(参数逆变)
- [ ] off 之后不再触发;off 只移除指定 handler

## 写完后

贴 `src/day11/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 15 分钟 → Part 2 30 分钟(死结想不通就来问,要提示)→ Part 3 20 分钟。

---

[上一题：Day 10](../day10/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 12](../day12/README.md)
