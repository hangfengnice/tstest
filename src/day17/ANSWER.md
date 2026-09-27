# Day 17 — 参考答案 + 点评要点

> 使用规则：自己写完、`pnpm check:day 17` 全绿之后再打开这份文件。
> 对照的目的不是"对答案"，是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下实现**已通过本 day 全部验收测试**（vitest 17/17 双通道全绿，运行时 + 类型检查）+
`pnpm typecheck`（day17 相关错误全部消失，无新增）。
文中的错误码和运行时现象全部经过本机 TS 5.6 + strict 实测，不是"理论上会错"。

---

## 一、参考实现

```ts
// =============================================================
// Part 1 — 基础:错误与结果
// =============================================================

/**
 * HTTP 方法字面量联合。
 * 用字面量而不是 string:string 是"任何动词都行",联合是"只这四个,拼错动词编译期就红"。
 *
 * @example
 * const m: Method = 'GET'   // ✅
 * const n: Method = 'FETCH' // ❌ 编译错误
 */
export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * 后端信封错误的形状(失败分支的 code + 人话 message)。
 *
 * @example
 * const e: ApiError = { code: 429, message: '太快了' }
 */
export type ApiError = { code: number; message: string }

/**
 * 两态结果:成功带 data,失败带 error。
 *
 * **为什么 E 的默认值是 ApiError?**
 * 默认泛型参数的原则:默认成"90% 场景会用到的那一个"。
 * 本项目里 Result 的最大来源是 request —— 失败原因几乎总是信封错误(ApiError),
 * 所以 `Result<User>` 不写第二个参数就能直接用,读的人也默认它在说"业务失败"。
 * 换 E 的场景真实存在但属少数:比如在 zod 解析层包一层
 * `Result<Config, ZodError>`(校验失败和业务失败是两种错误,不能共用一个形状)。
 * 默认参数 = 让最常用的写法最短,而不是让类型最通用。
 *
 * @example
 * const r: Result<User> = { ok: true, data: { id: 'u1', name: '吴' } }
 * if (!r.ok) console.error(r.error.message) // E 默认是 ApiError
 * const z: Result<User, { tag: 'parse' }> = { ok: false, error: { tag: 'parse' } }
 */
export type Result<T, E = ApiError> = { ok: true; data: T } | { ok: false; error: E }

// =============================================================
// Part 2 — 进阶:信封 + 端点描述 + 注册表
// =============================================================

/**
 * 后端响应信封,以"有没有 data 字段"为可靠判别符的联合。
 *
 * 为什么失败分支不能写 `data?: undefined`?
 * 判别联合靠**判别符字面量**收窄(code: 0 vs code: number)。number 包含 0,
 * `envelope.code === 0` 之后 TS 仍认为两个分支都可能,收窄失败;
 * 而 `'data' in envelope` 用**字段存在性**收窄,失败分支干脆不声明 data,一分就开。
 * (exactOptionalPropertyTypes 下可选属性也不接受显式 undefined,双保险。)
 *
 * @example
 * const ok: ApiEnvelope<User> = { code: 0, data: { id: 'u1', name: '吴' } }
 * const fail: ApiEnvelope<User> = { code: 429, message: '太快了' }
 */
export type ApiEnvelope<T> =
  | { code: 0; data: T; message?: string }
  | { code: number; message?: string }

/**
 * 端点描述:路径模板 + 方法 + 幽灵属性 _response。
 * 本题不创建 _response 字段；该可选字段用于携带类型，不做运行时响应校验。
 * 它是"响应类型"的运输工具:request 从 endpoint 的类型参数里拿到 Resp,
 * 调用处零重复、零 as(和 Day 14 的 InjectionKey 同一个思想:用类型位置当口袋装类型)。
 *
 * @example
 * const getUser: EndpointDef<'/users/:id', User> = { path: '/users/:id', method: 'GET' }
 * // getUser._response —— 类型是 User | undefined,运行时是 undefined
 */
export type EndpointDef<P extends string, Resp> = {
  path: P
  method: Method
  /** 幽灵属性:仅用于携带响应类型,运行时不存在,不要读写 */
  _response?: Resp
}

/**
 * 端点注册表的"最低门槛"形状:任意字符串键 → 合法端点。
 * 只用于 satisfies 校验,不用于存储实际对象(否则所有端点都被拍平成 EndpointDef<string, unknown>)。
 *
 * @example
 * const endpoints = { getUser } satisfies ApiRegistry
 */
export type ApiRegistry = Record<string, EndpointDef<string, unknown>>

// ---- 业务数据(可直接用,不是考点) ----

/** 用户(Day 15 同款) */
export type User = { id: string; name: string }

/** 通知(Day 1 同款,精简版) */
export type Notification = { id: string; title: string; isRead: boolean }

// 端点定义:显式标注携带响应类型,不需要 as(对象字面量被标注上下文精确化)
const getUser: EndpointDef<'/users/:id', User> = {
  path: '/users/:id',
  method: 'GET',
}

const listNotifications: EndpointDef<'/notifications', Notification[]> = {
  path: '/notifications',
  method: 'GET',
}

/**
 * 端点注册表。
 * satisfies 的价值:按 ApiRegistry **校验**"每项都是合法端点",
 * 同时**保留**每项的精确类型 —— endpoints.getUser 还是 EndpointDef<'/users/:id', User>,
 * 不会被拓宽成 EndpointDef<string, unknown>(那是 `: ApiRegistry` 注解的后果)。
 *
 * @example
 * endpoints.getUser.path // 类型是 '/users/:id',不是 string
 */
export const endpoints = { getUser, listNotifications } satisfies ApiRegistry

// =============================================================
// Part 3 — 边界:路径参数模板 + request
// =============================================================

/**
 * 从路径模板提取参数名集合(内部用,PathParams 的原料)。
 * 递归拆解:先看":param/后面还有"的分支,再看":param 在结尾"的分支,都没有参数就是 never。
 *
 * @example
 * type A = ParamKeys<'/posts/:postId/comments/:commentId'> // 'postId' | 'commentId'
 */
type ParamKeys<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ParamKeys<Rest>
  : P extends `${string}:${infer Param}`
    ? Param
    : never

/**
 * 路径模板 → 参数对象类型。
 * 无参路径必须是 `Record<string, never>` 而不是 `{}`:
 * `{}` 没有属性,多余属性检查对它不生效,`{ id: 'x' }` 也赋得进去;
 * `Record<string, never>` 有索引签名 `[x: string]: never`,任何键的任何值都过不了 ——
 * "任何键都不合法"必须用索引签名才能表达。
 *
 * @example
 * PathParams<'/users/:id'>                         // { id: string }
 * PathParams<'/posts/:postId/comments/:commentId'> // { postId: string; commentId: string }
 * PathParams<'/health'>                            // Record<string, never>
 */
export type PathParams<P extends string> = ParamKeys<P> extends never
  ? Record<string, never>
  : { [K in ParamKeys<P>]: string }

/**
 * 键存在性守卫:把 object 收窄成"可按 string 索引读 unknown 的字典"。
 *
 * 为什么不直接 `name in params`?in 收窄只对**字面量键**生效(`'id' in x`),
 * 变量键(name: string)收窄不出索引签名,后续 `params[name]` 直接 TS7053。
 * 自定义谓词是诚实的:对象只要有这个键,把它的值**当 unknown 读**永远安全 ——
 * 这是 Day 4 的标准姿势(动态数据用 unknown + 守卫,而不是 as 或 any)。
 *
 * @example
 * const obj: object = JSON.parse('{"id":"u1"}')
 * if (hasKey(obj, 'id')) obj.id // unknown
 */
function hasKey(obj: object, key: string): obj is Record<string, unknown> {
  return key in obj
}

/**
 * 运行时填路径参数:把 `:name` 替换成 params 里的值。
 * params 收 object 而不是具体类型 —— 调用侧的 PathParams<P> 是延迟求值的条件类型,
 * 进了这个非泛型函数就退化成黑盒,收宽一点才接得住。
 * 类型层已经保证键齐全,运行时的缺参抛错是防御(Day 4 的习惯:边界大声失败)。
 *
 * @example
 * fillPathParams('/users/:id', { id: 'u1' }) // '/users/u1'
 */
function fillPathParams(path: string, params: object): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_raw, name: string) => {
    if (hasKey(params, name)) {
      return String(params[name])
    }
    throw new Error(`路径参数 ${name} 缺失(路径 ${path})`)
  })
}

/**
 * 类型化请求(签名已给,补运行时)。
 *
 * @example
 *   const r = await request(endpoints.getUser, {
 *     params: { id: 'u1' },
 *     transport: async () => ({ code: 0, data: { id: 'u1', name: '吴' } }),
 *   })
 *   // r: Result<User> —— r.ok 为 true 时 r.data 是 User
 */
export async function request<P extends string, Resp>(
  endpoint: EndpointDef<P, Resp>,
  options: {
    params: PathParams<P>
    query?: Record<string, string | number | boolean>
    transport: (path: string) => Promise<ApiEnvelope<Resp>>
  },
): Promise<Result<Resp>> {
  const { params, query, transport } = options

  // 1. 填路径参数(PathParams<P> 在这里是延迟条件类型,交给收 object 的辅助函数处理)。
  //    放在 async 函数体里,防御性抛错会变成 promise rejection 冒给调用方,而不是同步炸
  let path = fillPathParams(endpoint.path, params)

  // 2. 拼 query:按 Object.keys 顺序,值一律 String()
  if (query !== undefined) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join('&')
    path = `${path}?${qs}`
  }

  // 3. 发请求;transport 可能 reject,catch 到的是 unknown(useUnknownInCatchVariables)
  try {
    const envelope = await transport(path)
    // 4. 收窄信封:失败分支没声明 data,字段存在性一分就开(见 ApiEnvelope 的 JSDoc)
    if ('data' in envelope) {
      return { ok: true, data: envelope.data }
    }
    // message 缺省给默认文案(exactOptionalPropertyTypes 下它不在就是不在,别读它)
    return {
      ok: false,
      error: { code: envelope.code, message: envelope.message ?? '未知错误' },
    }
  } catch {
    // reject 的原因在这个层面不可知也不重要,统一降级成网络错误
    return { ok: false, error: { code: -1, message: '网络错误' } }
  }
}
```

---

## 二、常见错误写法（点评人视角）

### 1. 信封失败分支写 `data?: undefined`（判别符失效）

❌

```ts
export type ApiEnvelope<T> =
  | { code: 0; data: T; message?: string }
  | { code: number; data?: undefined; message?: string }
```

现象：测试 `expectTypeOf<ApiEnvelope<User>>()` 断言直接红（形状对不上）；
就算测试放过，运行时 `envelope.code === 0` 之后 TS 依然认为两个分支都可能 ——
`code: number` **包含** `0`，字面量 `0` 对 `number` 收不了窄，判别形同虚设。
为什么错：判别联合收窄要求判别符位置是**互斥的字面量**（如 `ok: true` vs `ok: false`）。
`0` vs `number` 是包含关系，不是互斥关系。

✅ 失败分支**干脆不声明 data**，让 `'data' in envelope` 用字段存在性收窄。
（`in` 收窄是 Day 3 的知识 —— 它对联合里"有的成员有该键、有的没有"一分就开。）

### 2. endpoints 用 `: ApiRegistry` 注解而不是 satisfies（类型被拍平）

❌ `export const endpoints: ApiRegistry = { getUser, listNotifications }`

现象：`expectTypeOf(endpoints.getUser).toEqualTypeOf<EndpointDef<'/users/:id', User>>()`
红 —— 它被注解拍平成了 `EndpointDef<string, unknown>`。
为什么错：注解是"声明变量类型"，上下文类型会把对象字面量**向着注解收**；
path 的 `'/users/:id'` 字面量在展示时仍是字面量，但**读取 endpoints.getUser 时
拿到的是注解类型**，幽灵属性 `_response?: unknown` 让 Resp 信息彻底丢失，
`request(endpoints.getUser, ...)` 就推不出 `Result<User>` 了。
satisfies 是"只校验、不注解"：检查兼容性后保留字面量推导。

✅ `export const endpoints = { getUser, listNotifications } satisfies ApiRegistry`

### 3. 端点对象不写标注，指望 satisfies 提供精确类型

❌

```ts
const endpoints = {
  getUser: { path: '/users/:id', method: 'GET' },
} satisfies ApiRegistry
```

现象：`path` 被拓宽成 `string`（可变属性上的字面量会拓宽），
`request(endpoints.getUser, { params: { id: 'u1' } })` 里 `P` 推成 `string`，
`PathParams<string>` 是个"任意键"的宽松类型 —— 缺参反例抓不住了。
为什么错：satisfies 只校验，**推导仍按对象字面量的默认规则走**；
不对 path 收窄，PathParams 就没有原料。

✅ 两步走：先给每个端点写**显式标注**（类型口袋），再 satisfies 组装：

```ts
const getUser: EndpointDef<'/users/:id', User> = { path: '/users/:id', method: 'GET' }
export const endpoints = { getUser, listNotifications } satisfies ApiRegistry
```

（进阶写法：`{ path: '/users/:id', method: 'GET' } satisfies EndpointDef<'/users/:id', User>`
内联也行 —— satisfies 的上下文类型同样能保留字面量。但先标注再组装的可读性更好。）

### 4. PathParams 无参分支写成 `{}` 或 `Record<never, never>`（反例抓不住）

❌ `P extends \`${string}:${infer Param}\` ? { [K in Param]: string } : {}`

现象（实测）：`const bad: PathParams<'/health'> = { id: 'x' }` **编译通过**，
`// @ts-expect-error` 变成 TS2578（Unused directive），反例测试红。
为什么错：多余属性检查（excess property check）**不会对空目标生效** ——
`{}` 没有任何已知属性，TS 认为没有"多余"可言。`Record<never, never>` 展开后
同样是 `{}`，一个待遇。
（这也是 README 提示的坑，实测确认：`const a: {} = { id: 'x' }` 与
`const b: Record<never, never> = { id: 'x' }` 都不报错。）

✅ `Record<string, never>`：它有索引签名 `[x: string]: never`，
"任何键的任何值"都不可赋给 never —— 多传任何键都 TS2322。
"**任何键都不合法**"这个语义，只有索引签名能表达。

### 5. PathParams 递归版：把 keyof 递归结果直接并进映射（string 泄漏）

❌（能过本 day 测试，但藏着类型漏洞）

```ts
type PathParams<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof PathParams<Rest>]: string }
  : P extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>
```

现象（实测）：`PathParams<'/a/:x/static'>` 是"任意字符串键都行"的索引签名类型
—— `const x: PathParams<'/a/:x/static'> = { x: '1', 任意键: '都行' }` 不报错！
为什么错：`Rest` 是 `'static'`（后面没有参数了）时，递归落到
`Record<string, never>` 分支，而 `keyof Record<string, never>` = **`string`**，
这个 `string` 混进 `Param | keyof PathParams<Rest>` 的键联合，映射出全开索引签名。
本 day 的测试路径恰好参数都在结尾（`/users/:id`）或参数后紧跟参数
（`:postId/comments/:commentId`），踩不到这个分支 —— 你可能侥幸全绿。

✅ **先收集键、再统一映射**，把"没有参数"表示为 `never`（never 并进联合是无害的）：

```ts
type ParamKeys<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ParamKeys<Rest>
  : P extends `${string}:${infer Param}`
    ? Param
    : never

export type PathParams<P extends string> = ParamKeys<P> extends never
  ? Record<string, never>
  : { [K in ParamKeys<P>]: string }
```

`never extends never` 为真 → 无参路径走 `Record<string, never>`；有参数时映射。
键集合与对象形状分开表达，递归边界就不会污染形状。

### 6. 单参数版 `${string}:${infer Param}` 糊弄多参数（不递归）

❌ `P extends \`${string}:${infer Param}\` ? { [K in Param]: string } : Record<string, never>`

现象：`PathParams<'/posts/:postId/comments/:commentId'>` 会把**整段尾巴**
`postId/comments/:commentId` 当成一个参数名（第一个 `/` 前的 `postId` ——
注意 `${infer Param}` 遇到字面量 `/` 会停在第一个 `/`），丢掉 commentId。
测试的多参数断言红。
为什么错：模板匹配只拆一次。`:a/b/:c` 必须先按"参数 + 后续路径"递归拆，
拆到没有 `:` 为止。

✅ 见第 5 条的正确版（三分支：有后续 / 参数在结尾 / 无参数）。

### 7. request 里用 `as` 强转 params（本 day 明令禁止）

❌ `const record = params as Record<string, string>`

为什么错：as 是"我说服编译器别查了"。而这里根本不需要说服 —— 用**类型守卫**走正门：

✅ 自定义谓词（见参考实现 hasKey）。它是诚实收窄：只要键存在，
"把值当 unknown 读"永远安全。这就是"零 as"的底气 —— 不是硬憋，是换姿势。

### 8. 变量键直接 `name in params` 就想索引（TS7053）

❌

```ts
if (name in params) {
  return String(params[name]) // TS7053
}
```

现象（实测）：`error TS7053: Element implicitly has an 'any' type because
expression of type 'string' can't be used to index type '{}'`。
为什么错：TS 4.9 的 in 收窄只对**字面量键**（`'id' in x`）生效；
变量键的 in 检查收窄不出索引签名。很多人在这里被迫上 as —— 然后就越陷越深。

✅ 包一层守卫 `hasKey(obj, key): obj is Record<string, unknown>`（参考实现）。

### 9. 防御性抛错写在同步阶段（测试的 .catch 兜不住）

❌ `request` 用普通 function，`fillPathParams` 的 throw 在**返回 promise 之前**同步发生。

现象（实测）：反例测试
`await request(endpoints.getUser, { params: {} }).catch(() => undefined)`
直接把整个用例炸红 —— `.catch` 只能兜 **promise rejection**，兜不住同步 throw。
为什么错：`@ts-expect-error` 只压类型不压运行时，这些反例调用**真的会执行**；
缺参的防御抛错必须以 rejection 的形式冒出来。

✅ 把 request 写成 **async 函数**（签名声明的 `Promise<Result<Resp>>` 不变）：
async 函数体里（包括 await 之前的）任何 throw 都自动变成 rejection。
这也是为什么注释里强调"签名已给"不等于"函数形态不能加 async"。

### 10. catch 里读 error.message（unknown 上没有属性）

❌

```ts
catch (e) {
  return { ok: false, error: { code: -1, message: e.message } } // TS2339/18046
}
```

现象：`Property 'message' does not exist on type 'unknown'`。
（tsconfig 开了 useUnknownInCatchVariables，catch 变量是 unknown。）
为什么错：unknown 上没有任何属性。真要用 message 得先 `e instanceof Error` 守卫；
但本 day 语义上统一报"网络错误"，压根不该读它。

✅ `catch { ... }` 连变量都不绑定，直接返回 `{ code: -1, message: '网络错误' }`。

### 11. query 拼接忘了 `if (query !== undefined)`（undefined 上 Object.entries 炸）

❌ 无条件 `Object.entries(query).map(...)`

现象：不传 query 的用例运行时
`TypeError: Cannot convert undefined or null to object`。
为什么错：`query?: ...` 是可选的。注意 exactOptionalPropertyTypes 下
可选属性的类型是"没有 | 值"，判存在用 `!== undefined` 而不是 `!== null`（语义不同）。
反例测试传的显式 `query: undefined` 同样走这条路 —— 类型上它被拒了（TS2322），
运行时它就是 undefined。

✅ 先判 `query !== undefined` 再拼；无 query 时路径不带 `?`。

### 12. 成功分支读 `envelope.message ?? '未知错误'`（message 在成功分支也可选）

现象：能编译，但语义错 —— 成功分支要的是 data，默认文案属于失败分支。
点评视角：这不是编译错误，是"判别联合的分支语义"没对齐。
每个分支只读自己声明的字段，读不到的交给收窄后的类型说话。

✅ 成功分支 `return { ok: true, data: envelope.data }`；
失败分支才处理 `message ?? '未知错误'`。

---

## 三、思考题参考答案

### 为什么 E 的默认值是 ApiError？（Result 的 JSDoc 考点）

- 默认泛型参数的选型原则：**默认成绝大多数使用场景的那个**，让最常用的写法最短。
- `Result<User>`：request 的返回值，失败几乎总是信封错误 —— 写一半就够了，
  调用方 `if (!r.ok) r.error.code` 直接可用。
- `Result<User, ZodError>`：解析/校验层。校验失败和业务失败是**两种错误**，
  形状不同（ZodError 有 issues 列表），硬塞进 ApiError 是削足适履。
- 反面教材：把 E 默认成 `unknown`"最通用"——结果是每个调用方都得先收窄 error，
  90% 的场景为 10% 的灵活性买单。**默认参数是使用频率的投票，不是通用性投票。**

### 为什么失败分支不能写 `data?: undefined`？

三个理由（README 预告 + 实测确认）：

1. **判别失效**：判别联合的收窄依赖判别符位置的字面量互斥。`code: 0` 对 `code: number`
   是包含关系不是互斥关系，`envelope.code === 0` 之后两分支都活着，
   `envelope.data` 的类型是 `T | undefined` —— 每次用都得再判 undefined。
2. **exactOptionalPropertyTypes 下可选属性不接受显式 undefined**：`data?: undefined`
   语义微妙（"可以有键但值必须是 undefined"），和"没有这个键"是两回事。
3. **`'data' in envelope` 是更可靠的判别**：失败分支根本不声明 data，
   字段存在性检查天然互斥，收窄一步到位。**判别联合的判别符要选"互斥且可靠"的维度** ——
   这里是"有没有 data"，而不是"code 是不是 0"。

### 幽灵属性 `_response` 和 Day 14 InjectionKey 的共同思想

**用"只存在于类型系统的属性"当类型的运输工具**。本题不创建该可选字段，接口声明不生成运行时属性（
不影响序列化），但类型上它把 Resp "焊"在对象上 —— `request` 的签名
`endpoint: EndpointDef<P, Resp>` 一看到 endpoints.getUser 就同时拿到 P 和 Resp。
与 InjectionKey<T>（symbol 上的幽灵类型）互为镜像：一个是属性位置，一个是 key 位置。

---

## 四、验收自查清单

- [ ] `pnpm check:day 17` 通过（类型检查 + 运行时测试）
- [ ] Result 的 JSDoc 回答了"为什么 E 默认 ApiError"（对照：默认 = 使用频率投票）
- [ ] endpoints 用了 satisfies，且各项类型**没有**被拓宽
  （`endpoints.getUser` 还是 `EndpointDef<'/users/:id', User>`）
- [ ] PathParams 无参路径是 `Record<string, never>`，反例多传键编译报错
- [ ] 缺路径参数 / query 传显式 undefined / 未知参数键 —— 三个反例全部编译报错
- [ ] request 内部零 as（信封用 `'data' in` 收窄，catch 用 unknown，params 索引用守卫）
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] 额外自查：你的 PathParams 对 `/a/:x/static` 这种"参数后面还有静态段"的路径
  会泄漏任意键吗？（参考第 5 条 —— 测试没覆盖，但这是真实路由的常见形状）
- [ ] 额外自查：request 是 async 函数吗？防御性抛错能被 `.catch` 兜住吗？（第 9 条）
