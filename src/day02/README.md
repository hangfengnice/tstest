# Day 2 — API 响应类型 + Result<T, E> + 泛型登场

## 重学导读

**前置知识**：Day 1：字面量联合、分支收窄、函数参数与返回类型。

**今天要学会**：让相同结果结构携带不同业务数据，并区分请求过程与最终结果。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 泛型 T | T 是调用时确定的类型参数。`Box<T>` 可以在同一个结构中分别装用户或订单；它保留输入输出之间的关系，不等于任意类型。 |
| 组合类型 | 先描述 Conversation，再把它放进 Paged，最后放进请求状态。每一层只负责一种关系，读类型时由外到内拆开。 |
| 状态与结果 | RequestState 描述尚未开始、进行中以及结束后的 UI；Result 描述一次操作成功或失败。只在成功分支提供 data，避免到处判空。 |

### 动手顺序

先做 Part 1 的数据与分页 → Part 2 的四态与渲染 → Part 3 的结果转换。Part 0 是 Day 1 难点的回看实验，可等 Day 8 后补；故意报错的代码只做临时观察，不留在验收文件中。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：Paged<User> 与 Paged<Order> 哪些结构相同？mapResult 失败时为何不调用转换函数？
- **迁移**：为商品列表设计分页结果，写出 loading 和 success 两种值，说明在哪一层取 items。
- **验收**：在项目根目录运行 `pnpm check:day 02`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 的**对话列表页**。你每天在 Nuxt4 里写的 `useAsyncData` 背后,核心就是一套"请求状态 + 数据 + 分页"的类型模型。今天把这套模型亲手设计一遍。

后端接口约定:

- 成功:`{ code: 0, data: { items: [...], pagination: { page, pageSize, total } } }`
- 失败:`{ code: 500, message: '服务器开小差了' }`

---

## Part 0 — 热身:亲手复验 Day 1 的两个结论(15 分钟)

昨天 NOTES.md 里记了两个"AI 讲的、还没二次验证"的结论,今天先验掉:

### 实验 1：Omit 对联合只处理公共键

在编辑器里写(可放 solution.ts 顶部实验区):

```ts
import type { EmailNotification, SmsNotification } from '../day01/solution.js'

type EmailOrSms = EmailNotification | SmsNotification
type OmitResult = Omit<EmailOrSms, 'id' | 'createdAt' | 'isRead' | 'type'>
//                       ↑ 鼠标悬停 OmitResult,看 TS 推出什么
```

**预期**：只剩 `{ body: string }`。内置 Omit 先基于 `keyof` 联合的公共键再排除指定键，并不是先分别 Omit 两个分支再求交叉。
测试里有一条 `expectTypeOf` 断言会替你判卷。

### 实验 2:泛型上 `Extract` 不收窄

```ts
import type { Notification, NotificationType } from '../day01/solution.js'

function pickByType<K extends NotificationType>(
  k: K,
): Extract<Notification, { type: K }> {
  // 尝试 1:在函数体里 return 一个完整的 EmailNotification 对象
  // 观察:TS 让不让过?报错信息怎么说?
  // 尝试 2:把返回类型 Extract<...> 悬停看展开结果
}
```

**预期**:函数体内 `return` 任何单个分支对象都会报错 —— 因为 `Extract<Notification, { type: K }>` 在泛型 `K` 上退化成"无法精确定位"的类型。
这个实验**不进测试**,写完在函数上方加一行注释,写下你看到的报错/展开结果。

---

## Part 1 — 🟢 基础:业务数据 + 第一个泛型

1. `Conversation`(对话):
   `id`(string)、`title`(string)、`updatedAt`(string)、`messageCount`(number)

2. `Pagination`(分页):
   `page`、`pageSize`、`total`(都是 number)

3. **`Paged<T>`(分页包装)** —— 今天第一个泛型:

   ```ts
   // 语义:任何"一页数据"都是 { items: T 数组, pagination }
   // 用 Paged<Conversation>、Paged<User> 都能表达
   ```

   在 JSDoc 里回答:**为什么 items 不直接写 `Conversation[]`,而要引入泛型 T?**

## Part 2 — 🟡 进阶:可辨识联合建模请求状态

4. `ApiError`:`{ code: number; message: string }`

5. **`RequestState<T>`** —— Vue `useAsyncData` 的核心模型,四态:

   | status | 携带数据 |
   |---|---|
   | `'idle'` | 无(还没发请求) |
   | `'loading'` | 无 |
   | `'success'` | `data: T` |
   | `'error'` | `error: ApiError` |

6. **`Result<T, E>`** —— Rust 风格的结果类型,两态:

   ```ts
   // { ok: true, data: T } 或 { ok: false, error: E }
   ```

   思考并写进 JSDoc:**RequestState 和 Result 都是可辨识联合,各自的判别符是什么(status / ok)?一个用于 UI 状态,一个用于函数返回值,什么时候用哪个?**

7. `renderState(state: RequestState<Paged<Conversation>>): string`:
   用 `switch` + `never` 穷尽检查(昨天的技能),返回:
   - idle → `'还没有对话'`
   - loading → `'加载中…'`
   - success → `` `共 ${data.items.length} 个对话` ``
   - error → `` `出错了(${error.code}):${error.message}` ``

## Part 3 — 🔴 边界:泛型组合子

8. `mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E>`
   - 成功分支:用 `fn` 转换 data,保持 `ok: true`
   - 失败分支:**原样透传**(不调用 fn)
   - 难点:签名自己设计。提示:`fn` 的参数类型必须跟 `result` 的 data 类型对齐,返回类型由 `fn` 决定 —— 这正是泛型参数化的事

9. `unwrapOr<T, E>(result: Result<T, E>, fallback: T): T`
   - 成功返回 data,失败返回 fallback

---

## 验收点

- [ ] `pnpm check:day 02` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 零 `any`、零一段式 `as`
- [ ] 所有 export 类型有 JSDoc + `@example`
- [ ] `Paged<T>` 的 JSDoc 里回答了"为什么要泛型"
- [ ] `RequestState` / `Result` 的 JSDoc 里回答了"判别符与使用场景对比"
- [ ] 实验 2 可在 Day 8 后补；做过后把实际报错与解释写入 NOTES，故意失败的实现不留在验收源码中

## 写完后

贴 `solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 0 15 分钟 → Part 1+2 40 分钟 → Part 3 30 分钟。卡超过 10 分钟再来问,要提示不要答案。

---

[上一题：Day 1](../day01/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 3](../day03/README.md)
