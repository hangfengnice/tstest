# Day 25 — Zod 运行时校验 + z.infer 类型推导

## 业务场景

chipRunner 的对话列表页:`await fetch('/api/conversations')` 拿到的 JSON,在 TS 眼里是 `unknown` —— 这是**正确的**:网络对端的数据永远不可信。

没有校验层的两种死法:

- 写 `const data = json as Paged<Conversation>`(一段式 `as`):后端把 `messageCount` 改成字符串,前端**静默** NaN,崩在线上才发现;
- 手写一份 `Conversation` 接口 + 手写一份运行时校验函数:两份数据形状,迟早不同步。

Zod 一次解决两个问题:**schema 是唯一事实来源** —— 运行时它校验数据,类型层 `z.infer` 免费把类型推导出来。改字段只改 schema 一处。

本仓库已装 zod v4(`import { z } from 'zod'`),今天只用到:`z.object` / `z.string` / `z.number` / `z.literal` / `z.array` / `z.discriminatedUnion` / `z.never` / `safeParse` / `z.infer`。

---

## Part 1 — 🟢 基础:第一个 schema + z.infer

1. `conversationSchema`:单条会话的 schema,四个字段(题面规定,别改名):

   | 字段 | schema |
   |---|---|
   | `id` | `z.string()` |
   | `title` | `z.string()` |
   | `updatedAt` | `z.string()` |
   | `messageCount` | `z.number()` |

2. `type Conversation = z.infer<typeof conversationSchema>`(已在骨架里给出这行)。
   体会 `typeof` 在这里干了什么:**从值拿到它的类型** —— schema 是值,z.infer 是桥梁。这就是"类型从数据定义来"和"数据定义从类型来"的方向差别。

## Part 2 — 🟡 进阶:嵌套 schema + 安全解析函数

3. `pagedConversationSchema`:分页响应,嵌套结构:

   ```txt
   { items: Conversation 数组, pagination: { page, pageSize, total(都是 number) } }
   ```

4. `safeParseApi<T>(schema, raw): ParseResult<T>`(签名已给出,填实现):
   - 用 `schema.safeParse(raw)`(注意:**不是** `parse` —— `parse` 失败会抛异常,我们要求这个函数**永不抛错**,自己管理错误);
   - 成功 → `{ ok: true, data }`;
   - 失败 → `{ ok: false, errors }`,`errors` 是人能读的字符串数组,每条格式 `` `${path.join('.')}: ${message}` ``(path 用 `.` 连接)。失败信息从 `result.error.issues` 里取:每个 issue 都有 `path`(字段路径数组)和 `message`。

## Part 3 — 🔴 边界:可辨识联合 schema + 类型窄化

5. `notificationSchema`:消息通知的可辨识联合(Day 1 的场景回归,这次带上运行时校验)。用 `z.discriminatedUnion('type', [..两个 z.object..])`,两个分支:

   | 分支 | 字段 |
   |---|---|
   | email | `type: z.literal('email')` + `id: z.string()` + `subject: z.string()` + `to: z.string()` |
   | sms | `type: z.literal('sms')` + `id: z.string()` + `phone: z.string()` + `body: z.string()` |

6. `AppNotification = z.infer<typeof notificationSchema>` 应得到一个**可辨识联合**:按 `n.type === 'email'` 窄化后能访问 `n.subject`。运行时:缺字段的 email 失败、`type: 'voicemail'`(不在联合)失败。

---

## 提示区(卡住 10 分钟以上再看)

- 骨架里的 `z.never()` 只是占位符(校验必失败),把它整个替换成你的 `z.object({...})`
- `z.infer<typeof s>` 的 `s` 必须是 `const`,不能是函数参数里的 schema
- `safeParse` 返回可辨识联合:`{ success: true, data } | { success: false, error }`,`success` 就是判别符 —— Day 1/2 学的窄化技巧直接用
- `error.issues` 是数组,`map` 出字符串;`path` 可能是空数组(根级错误),`join('.')` 得到空串,没关系
- `discriminatedUnion` 的第一个参数是判别字段名,它会让 zod 先按 type 分流再校验对应分支

## 验收清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] `Conversation` / `PagedConversations` / `AppNotification` **全部来自 z.infer**,没有手写重复的接口
- [ ] `safeParseApi` 永不抛异常:任何输入都返回 `ParseResult`
- [ ] 失败分支的 `errors` 包含出错字段名(如 `id`)
- [ ] 零 `any`、零 `as`(`JSON.parse` 返回的 any 要立即用 `: unknown` 标注收窄)
- [ ] 所有 export 有 JSDoc + `@example`;JSDoc 里回答:"为什么测试里用 safeParse 而不是 parse + try/catch?"

## 写完后

贴 `src/day25/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 20 分钟 → Part 2 35 分钟 → Part 3 30 分钟。卡超过 10 分钟来要提示,不要答案。
