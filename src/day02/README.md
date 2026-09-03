# Day 2 — API 响应类型 + Result<T, E> + 泛型登场

## 业务场景

chipRunner 的**对话列表页**。你每天在 Nuxt4 里写的 `useAsyncData` 背后,核心就是一套"请求状态 + 数据 + 分页"的类型模型。今天把这套模型亲手设计一遍。

后端接口约定:

- 成功:`{ code: 0, data: { items: [...], pagination: { page, pageSize, total } } }`
- 失败:`{ code: 500, message: '服务器开小差了' }`

---

## Part 0 — 热身:亲手复验 Day 1 的两个结论(15 分钟)

昨天 NOTES.md 里记了两个"AI 讲的、还没二次验证"的结论,今天先验掉:

### 实验 1:`Omit<联合, Keys>` 求交集

在编辑器里写(可放 solution.ts 顶部实验区):

```ts
import type { EmailNotification, SmsNotification } from '../day01/solution.js'

type EmailOrSms = EmailNotification | SmsNotification
type OmitResult = Omit<EmailOrSms, 'id' | 'createdAt' | 'isRead' | 'type'>
//                       ↑ 鼠标悬停 OmitResult,看 TS 推出什么
```

**预期**:只剩 `{ body: string }`(两个分支分别 Omit 后的交集)。
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

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] 零 `any`、零一段式 `as`
- [ ] 所有 export 类型有 JSDoc + `@example`
- [ ] `Paged<T>` 的 JSDoc 里回答了"为什么要泛型"
- [ ] `RequestState` / `Result` 的 JSDoc 里回答了"判别符与使用场景对比"
- [ ] 实验 2 的观察结论写在 `pickByType` 上方注释里

## 写完后

贴 `solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 0 15 分钟 → Part 1+2 40 分钟 → Part 3 30 分钟。卡超过 10 分钟再来问,要提示不要答案。