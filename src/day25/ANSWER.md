# Day 25 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试(15/15,vitest typecheck 模式双跑 30/30)+ `pnpm typecheck` 该目录零错误。

```ts
import { z } from 'zod'

// Part 1:第一个 schema —— 四字段,题面规定
export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
})

// 类型从 schema 推导,不手写第二份
export type Conversation = z.infer<typeof conversationSchema>

// Part 2:嵌套 —— z.array 直接复用上面的 schema,两层永远同步
export const pagedConversationSchema = z.object({
  items: z.array(conversationSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }),
})

export type PagedConversations = z.infer<typeof pagedConversationSchema>

// 脚手架已给:两态可辨识联合,判别符 ok
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] }

// 泛型 T 从传入的 schema 推导,调用点零标注拿到完整类型
export function safeParseApi<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): ParseResult<T> {
  const result = schema.safeParse(raw)
  if (result.success) {
    return { ok: true, data: result.data }
  }
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    ),
  }
}

// Part 3:可辨识联合 —— 判别字段用 z.literal 钉死
export const notificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    id: z.string(),
    subject: z.string(),
    to: z.string(),
  }),
  z.object({
    type: z.literal('sms'),
    id: z.string(),
    phone: z.string(),
    body: z.string(),
  }),
])

export type AppNotification = z.infer<typeof notificationSchema>
```

## 二、常见错误写法(点评人视角)

### 1. 用 parse + try/catch 实现安全解析

```ts
❌ export function safeParseApi<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
     try {
       return { ok: true, data: schema.parse(raw) }
     } catch (e) {
       return { ok: false, errors: [String(e)] }   // e 是 unknown(useUnknownInCatchVariables)
     }
   }
```

现象:能编译甚至能跑,但处处别扭 —— ① catch 到的 `e` 是 **unknown**
(本仓库开着 useUnknownInCatchVariables),要再收窄一次才能读 message;
② 异常是**跳转型**控制流,类型系统看不见,"哪些路径会失败"全靠人肉记;
③ 错误信息是一整坨字符串,拿不到结构化的 path/message(想拼
`path: message` 得先 `e instanceof ZodError` 判断再转型)。
safeParse 把失败变成**返回值**:`{ success: false, error }` 是普通对象,
error.issues 结构化,窄化靠 if 分支,编译器检查你处理了失败分支。
预期内的业务分支用返回值建模(try/catch 留给真正的意外),
这是 Day 2 Result 模式的完整理由。

### 2. 忘了窄化就读 result.data

```ts
❌ const result = schema.safeParse(raw)
   return { ok: true, data: result.data }   // data: T | undefined,不是纯 T
```

现象:zod v4 里两态分支都带 `data?: never` / `error?: never`(成功分支
`error?: never`、失败分支 `data?: never`),所以不窄化也能**编译通过** ——
但 `result.data` 的类型是 `T | undefined`,你拿到一个"可能是 undefined
的成功数据",下游还得再判一次空,判错就运行时炸。先 `if (result.success)`
窄化,success 分支的 data 才是纯 T(参考实现正是这么写的)。这是 v4 与
v3 的行为差异:v3 里不窄化直接 **TS2339**(Property 'data' does not exist),
报错反而更响 —— v4 放宽成 `| undefined`,更要靠自觉窄化。

### 3. errors 丢了字段名(不拼 path)

```ts
❌ errors: result.error.issues.map((issue) => issue.message)
```

现象:错误信息只剩 "Invalid input: expected string, received number",
不知道是哪个字段 —— 测试 `errors.some((e) => e.includes('id'))` 挂,
更别说真实排障。issue 的 `path` 是字段路径数组(嵌套时是
`['items', '0', 'id']` 这种),`join('.')` 展平成人能读的键链。
根级错误的 path 是空数组,join 出空串,格式变成 ': xxx' —— 可接受,
不影响定位。

### 4. 判别字段写成 z.string() 而不是 z.literal()

```ts
❌ z.discriminatedUnion('type', [
     z.object({ type: z.string(), id: z.string(), subject: z.string(), to: z.string() }),
     ...
   ])
```

现象:两连挂 —— ① `AppNotification` 推导出 `{ type: string; ... } | { type: string; ... }`,
toEqualTypeOf 断言挂(测试要求 `type: 'email'` 字面量);② **窄化失效**:
`n.type === 'email'` 对 `type: string` 窄不出任何分支,n.subject 报 TS2339。
可辨识联合的"辨识"依赖字面量判别符 —— schema 层对应物就是 z.literal。
顺带:type: 'voicemail' 也会通过校验(string 照单全收),"不在联合里失败"
的测试一起挂。

### 5. schema 分支漏字段(比如忘写 to)

```ts
❌ z.object({ type: z.literal('email'), id: z.string(), subject: z.string() })
```

现象:校验变松 —— 测试"缺必填字段(to)失败"反向挂:
`{type:'email', id, subject}`(缺 to)本该 fail,你的 schema 里根本没有 to,
于是 success,测试里 `if (r.ok) throw new Error('应当失败')` 触发。
zod 默认**忽略**额外字段、但**要求**声明过的必填字段在场 ——
schema 就是契约全文,少写一条字段 = 契约少一条约束。

### 6. 手写一份 Conversation 接口"配合" schema

```ts
❌ interface Conversation { id: string; title: string; ... }   // 手写
   export const conversationSchema = z.object({ ... })          // 又一份
```

现象:今天能过,明天改 schema 忘改接口(或反过来),运行时校验和
类型声明**静默分裂** —— 后端把 messageCount 改成 string,schema 拦住了,
类型却说没问题(或反之)。这正是 README 开头"两种死法"的第二种,
zod 存在的全部意义就是消灭它:类型必须 `z.infer<typeof schema>` 推导,
一处定义,两个世界共用。

### 7. safeParseApi 的 raw 参数写成具体类型

```ts
❌ export function safeParseApi<T>(schema: z.ZodType<T>, raw: Conversation): ParseResult<T>
```

现象:调用侧灾难 —— 测试传进来的是 `unknown`(JSON.parse 收窄后的
正确形态),直接 TS2341/TS2345 编译不过;为了传参,调用方只好
`raw as Conversation` —— 把"待校验的数据"as 成"校验通过的类型",
校验彻底失去意义(先斩后奏)。raw 必须是 `unknown`:函数的语义就是
"我不信任输入,校验后才给你类型"。

### 8. JSON.parse 的 any 直接往下流

```ts
❌ const raw = JSON.parse(text)        // any!
   safeParseApi(conversationSchema, raw)  // 能跑,但 any 已渗进调用链
```

现象:不报错 —— 这正是 any 的可怕之处。JSON.parse 的返回类型是 any,
本仓库规则是**立即用 `: unknown` 收窄**(测试文件顶部那排
`const rawX: unknown = JSON.parse(...)` 就是示范)。unknown 进 safeParseApi
零阻力(参数本来就是 unknown),而 any 会一路关闭沿途所有类型检查。
校验函数的 raw 是 unknown,和"调用方在入口收窄"是同一原则的两端。

### 9. z.infer 的 typeof 用在函数参数上(概念坑)

```ts
❌ function render(schema: z.ZodType) {
     type Data = z.infer<typeof schema>   // = unknown,不是具体形状!
   }
```

现象:不报错但推导出 unknown —— `z.infer<typeof s>` 要求 s 是**具体的
const**(typeof 读的是它的精确类型);函数参数的类型是宽泛的 ZodType,
infer 拿不到形状。所以 safeParseApi 用**泛型接线**:
`schema: z.ZodType<T>` 让 T 在调用点从具体 schema 推导,返回
ParseResult<T> —— 这是对"z.infer 需要 const"的类型层解决方案,
也是本 day 签名设计的核心一课。

## 三、思考题参考答案

### 为什么测试里用 safeParse 而不是 parse + try/catch?

见常见错误 1 的完整论证。一句话版:**预期内的失败是业务分支,不是异常** ——
返回值让失败路径可被类型系统检查、错误信息可结构化、调用处可窄化;
try/catch 三样都做不到。zod 把两个 API 都给你,选哪个是设计态度问题。

### `typeof` 在 `z.infer<typeof conversationSchema>` 里干了什么?

它是"从值到类型"的桥:schema 是一个**值**(运行时真实存在的对象),
typeof 取它的静态类型(ZodObject<...> 全量形状信息),z.infer 再从里面
抽出"校验通过的数据是什么形状"。体会两个方向:
interface 是"类型驱动数据"(写类型,运行时没有它);
schema + infer 是"数据驱动类型"(写运行时定义,类型免费跟上)。
运行时校验只有后一个方向能同时喂饱两个世界。

### discriminatedUnion 与 Day 1 的可辨识联合是什么关系?

同一件事的两个层:Day 1 你手写 `{type:'email'|...}` 联合并靠 `===` 窄化;
今天 schema 层用 `z.literal` 钉判别符 + `z.discriminatedUnion('type', ...)` 分流,
z.infer 把它翻回同一形状的类型联合。运行时(校验分流)和类型层
(窄化)在同一个判别符上会师 —— 这就是"schema 是唯一事实来源"的完整体。

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] `Conversation` / `PagedConversations` / `AppNotification` 全部来自 z.infer,
      没有手写重复接口
- [ ] `safeParseApi` 永不抛异常:非对象输入也返回 `{ ok: false, ... }`
- [ ] 失败分支 errors 带 `path.join('.')` 前缀,包含出错字段名(id / to)
- [ ] 零 `any`、零 `as`;raw 参数是 unknown,JSON.parse 产物立即 `: unknown` 收窄
- [ ] 判别字段是 `z.literal('email')` / `z.literal('sms')`,窄化测试通过
- [ ] 缺 messageCount 的 Conversation 赋值,@ts-expect-error 精准命中(无 TS2578)
- [ ] 所有 export 有 JSDoc + `@example`,JSDoc 回答了 safeParse vs parse 问题
