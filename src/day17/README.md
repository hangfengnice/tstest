# Day 17 — API client 类型设计(泛型请求 / 路径参数模板 / Result 包装)

## 业务场景

chipRunner 的后端约定:

- 路径参数写在路径里:`/users/:id`、`/posts/:postId/comments/:commentId`
- 查询参数平铺:`?page=2&pageSize=20`
- 响应是**信封**(Day 2 的老朋友):成功 `{ code: 0, data: T }`;失败 `{ code: 429, message: '太快了' }`

你要写一个类型化的 `request(endpoint, options)`:端点描述决定一切 ——
路径的参数元组、响应的类型,全部从**端点的类型标注**推导,调用处零重复。

```ts
const user = await request(endpoints.getUser, {
  params: { id: 'u1' },                    // 缺 id 直接编译报错
  transport: mockTransport,                // 注入传输层,测试可控
})
if (user.ok) user.data // 已经是 User
```

---

## Part 1 — 🟢 基础:错误与结果

1. `Method`:`'GET' | 'POST' | 'PUT' | 'DELETE'`。
2. `ApiError`:`{ code: number; message: string }`。
3. `Result<T, E = ApiError>`:两态 `{ ok: true; data: T } | { ok: false; error: E }`。
   **默认泛型参数**是本关考点 —— JSDoc 里回答:为什么 E 的默认值是 ApiError?
   (提示:`Result<User>` 和 `Result<User, ZodError>` 各自适用什么场景)

## Part 2 — 🟡 进阶:信封 + 端点描述 + 注册表

4. `ApiEnvelope<T>` —— 建模信封:
   - 成功:`{ code: 0; data: T; message?: string }`
   - 失败:`{ code: number; message?: string }`(**不声明 data 字段**)
   - 为什么失败分支不能写 `data?: undefined`?因为 `code: 0`(字面量)对 `code: number`
     **收不了窄** —— number 包含 0,`envelope.code === 0` 之后 TS 仍然认为两个分支都可能。
     正确姿势:失败分支干脆没有 data,在 request 里用 `'data' in envelope` 收窄(Day 3 的 in 守卫)。
   注意 exactOptionalPropertyTypes:可选属性不接受显式 undefined。
5. `EndpointDef<P extends string, Resp>` —— 端点描述:
   - `{ path: P; method: Method }` + **幽灵属性** `_response?: Resp`
     (和 Day 14 的 InjectionKey 同一个思想:类型只存在于标注里,运行时永远是 undefined)
   - 用法:`const getUser: EndpointDef<'/users/:id', User> = { path: '/users/:id', method: 'GET' }` —— 不需要 as
6. `endpoints` 注册表 + **satisfies**(Day 6 技能):
   - `ApiRegistry = Record<string, EndpointDef<string, unknown>>`
   - `export const endpoints = { getUser, listNotifications } satisfies ApiRegistry`
   - satisfies 的价值:校验"每项都是合法端点",同时**保留**每个端点的精确类型
     (用 `expectTypeOf(endpoints.getUser)` 验证,它应该还是 `EndpointDef<'/users/:id', User>`)

## Part 3 — 🔴 边界:路径参数模板 + request 运行时

7. `PathParams<P extends string>` —— 从路径模板提取参数(本天最难点,条件类型 + infer 的预习,
   Day 19-20 会正式展开):
   - `PathParams<'/users/:id'>` → `{ id: string }`
   - `PathParams<'/posts/:postId/comments/:commentId'>` → `{ postId: string; commentId: string }`(要递归)
   - `PathParams<'/health'>` → **必须是 `Record<string, never>`**(任何键都不合法;写成 `{}` 或
     `Record<never, never>` 会导致反例测试挂掉,想想为什么 —— 提示:多余属性检查不会对空目标生效)
   - 阶梯提示:先写只支持**一个参数**的版本(`${string}:${infer Param}`),跑过单参数测试;
     再处理 `:a/b/:c` 的递归分支
8. `request` 运行时(签名已给,补实现):
   - 把 `:param` 替换成 `options.params` 里的值;运行时缺参就抛错(类型层已经拦了,这是防御)
   - query 按 `Object.keys` 顺序拼成 `?k=v&k=v`,值用 `String()`
   - 信封用 `'data' in envelope` 收窄(见 Part 2 的解释);失败分支 message 缺省用 `'未知错误'`
   - transport reject(catch 到的是 unknown)→ `{ code: -1, message: '网络错误' }`

---

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm vitest run src/day17` 全过
- [ ] `Result` 的 JSDoc 回答了"为什么 E 默认 ApiError"
- [ ] `endpoints` 用了 satisfies,且各项类型**没有**被拓宽
- [ ] `PathParams` 无参路径是 `Record<string, never>`(反例:多传键必须编译报错)
- [ ] 缺路径参数、query 传显式 undefined、未知参数键 —— 三个反例全部编译报错
- [ ] request 内部零 as(信封用判别联合收窄,catch 用 unknown 守卫)
- [ ] 所有 export 有中文 JSDoc + `@example`

## 写完后

贴 `solution.ts`,说:"点评 + 解释为什么"。
建议节奏:Part 1 15 分钟 → Part 2 35 分钟 → Part 3 50 分钟(PathParams 值得花时间)。
卡超过 15 分钟来要提示 —— 这题的提示是分阶梯的,不会直接给答案。
