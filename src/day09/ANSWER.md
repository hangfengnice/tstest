# Day 9 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 09` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下参考实现已通过本 day 全部验收测试(`npx vitest run src/day09` 38/38 全绿,`pnpm typecheck` 本 day 零错误)。
特别说明:本 day README 明确授权 `validateRegisterForm` 里**恰好一次** `as FieldErrors<T>`(这是教学点本身,不属于违反"零 as"军规);文末另附一份**实测同样全绿的零 as 重载版**,两种都吃透才算把这题吃透。

## 一、参考实现

```ts
/**
 * Day 9 — 复杂表单的类型设计(条件字段 + 嵌套字段 + 校验状态)
 *
 * 规则:零 any(README 授权 validateRegisterForm 恰好一次 as),
 * export 带 JSDoc + @example
 */

// =============================================================
// Part 1 — 基础:条件字段 + 嵌套字段
// =============================================================

/**
 * 注册方式 —— 只有两种,字面量联合。
 *
 * 为什么不用 string:它是表单联合的**判别符**(method 字段)。
 * 判别符必须是字面量类型,`if (form.method === 'email')` 才能触发
 * TS 的判别收窄;如果是 string,比较之后 form 还是整个联合。
 *
 * @example
 *   const m: RegisterMethod = 'email'
 */
export type RegisterMethod = 'email' | 'phone'

/**
 * 地址 —— 嵌套字段。detail / zip 可选。
 *
 * exactOptionalPropertyTypes 下的语义:`detail?: string` 表示
 * "键可以不存在",而不是"值可以是 undefined" ——
 * `{ detail: undefined }` 显式传入会编译报错(TS2375)。
 *
 * @example
 *   const a: Address = { country: '中国', city: '上海' }  // detail/zip 缺省,合法
 */
export type Address = {
  country: string
  city: string
  detail?: string
  zip?: string
}

/**
 * 邮箱注册表单 —— method 为 'email' 时,email + emailCode 必填。
 * "选了哪种方式决定哪些字段必填"这层依赖,由联合成员的边界表达。
 *
 * @example
 *   const f: EmailRegisterForm = {
 *     method: 'email', username: 'hf', password: '12345678',
 *     email: 'hf@example.com', emailCode: '123456',
 *     address: { country: '中国', city: '上海' },
 *   }
 */
export type EmailRegisterForm = {
  method: 'email'
  username: string
  password: string
  email: string
  emailCode: string
  address: Address
}

/**
 * 手机号注册表单 —— method 为 'phone' 时,phone + smsCode 必填。
 *
 * @example
 *   const f: PhoneRegisterForm = {
 *     method: 'phone', username: 'hf', password: '12345678',
 *     phone: '13800000000', smsCode: '654321',
 *     address: { country: '中国', city: '上海' },
 *   }
 */
export type PhoneRegisterForm = {
  method: 'phone'
  username: string
  password: string
  phone: string
  smsCode: string
  address: Address
}

/**
 * 注册表单 —— 两种互斥的字段组合,用可辨识联合建模。
 *
 * 【如果用 `email?: string; phone?: string` 两个平行可选字段,丢掉什么?】
 * 丢三样:
 *   1. 必填保证:email 变成"可以不填",编译器不再拦"选了邮箱却没填 email";
 *   2. 互斥保证:email / phone 可以同时出现或同时缺席,四种组合全合法;
 *   3. 判别收窄:`form.method === 'email'` 之后 form.email 仍是
 *      `string | undefined`,每个使用点都要判空。
 * 平行可选字段表达"有什么字段",表达不了"字段之间的依赖" ——
 * 依赖要靠联合成员的边界来表达。
 *
 * @example
 *   const f: RegisterForm = emailForm
 *   if (f.method === 'email') f.emailCode  // 已收窄,不是 string | undefined
 */
export type RegisterForm = EmailRegisterForm | PhoneRegisterForm

// =============================================================
// Part 2 — 进阶:校验状态(errors / touched 映射)
// =============================================================

/**
 * 字段错误映射 —— 表单 T 的每个字段名,至多对应一条错误信息。
 *
 * 【为什么不是 Record<string, string>?两个原因:】
 *   1. 键安全:string 下标什么都收,`errors.foo`(拼错字段名)静默通过;
 *      keyof T 限定后直接编译报错,拼写错误当场现形;
 *   2. 非全量:错误是"至多一条"而不是"必有一条",Partial 让键可选 ——
 *      没出错的字段键可以不存在,和 Record(全必填)语义不同。
 *
 * @example
 *   const errs: FieldErrors<EmailRegisterForm> = { email: '邮箱格式不正确' }
 *   // errs.foo = 'x' ← 编译报错,foo 不是表单字段
 */
export type FieldErrors<T> = Partial<Record<keyof T, string>>

/**
 * 读取某个字段的错误信息;没有错误时返回 undefined。
 *
 * 返回值为什么天然是 string | undefined:索引读取一个**可能不存在**的
 * 可选属性,TS 自动并入 undefined —— "键可能不存在"语义在类型上的投影。
 *
 * @example
 *   getFieldError({ email: '邮箱格式不正确' }, 'email')  // => '邮箱格式不正确'
 *   getFieldError({}, 'email')                            // => undefined
 */
export function getFieldError<T extends object>(
  errors: FieldErrors<T>,
  field: keyof T,
): string | undefined {
  return errors[field]
}

/**
 * 不可变地写入一条字段错误,返回新的 FormState(原对象不动)。
 *
 * 两步:浅拷贝 errors 再写入;values / touched / submitCount 引用透传。
 *
 * @example
 *   const next = setFieldError(state, 'email', '邮箱格式不正确')
 *   next.errors.email  // => '邮箱格式不正确'
 *   state.errors.email // => 仍是 undefined(原对象未被修改)
 */
export function setFieldError<T extends object>(
  state: FormState<T>,
  field: keyof T,
  message: string,
): FormState<T> {
  const errors: FieldErrors<T> = { ...state.errors }
  errors[field] = message
  return { ...state, errors }
}

// =============================================================
// Part 3 — 边界:FormState + 泛型校验函数
// =============================================================

/**
 * 表单运行时状态 —— 四件套。touched 与 FieldErrors 同构但值是 boolean:
 * 哪个字段被碰过(blur 过)就记 true,用于"没碰过的字段不显示错误"。
 *
 * @example
 *   const state: FormState<EmailRegisterForm> = {
 *     values: emailForm,
 *     errors: {},
 *     touched: { username: true },
 *     submitCount: 0,
 *   }
 */
export type FormState<T> = {
  values: T
  errors: FieldErrors<T>
  touched: Partial<Record<keyof T, boolean>>
  submitCount: number
}

/**
 * 校验注册表单,返回所有字段的错误映射(全部通过时返回空对象)。
 *
 * 签名从测试反推:传 EmailRegisterForm 得 FieldErrors<EmailRegisterForm>,
 * 传 PhoneRegisterForm 得 FieldErrors<PhoneRegisterForm> ——
 * 返回类型跟着入参收窄，本题主线采用 `<T extends RegisterForm>(form: T): FieldErrors<T>`。
 *
 * 校验规则:
 *   - username 去掉首尾空格后为空 → '用户名必填'
 *   - password 长度 < 8 → '密码至少 8 位'
 *   - email 分支:email 不含 '@' → '邮箱格式不正确'
 *                 emailCode 长度 ≠ 6 → '验证码必须是 6 位'
 *   - phone 分支:phone 长度 ≠ 11 → '手机号必须是 11 位'
 *                smsCode 长度 ≠ 6 → '验证码必须是 6 位'
 *
 * 为什么这里恰好需要一次 as(README 预告的坑):
 *   `form.method === 'email'` 收窄了 **form**(值,T & EmailRegisterForm),
 *   但泛型 **T 本身不收窄**(它可能是 EmailRegisterForm 的任何子类型)。
 *   公共字段的键在 keyof RegisterForm 里,errors.username 可以直接写;
 *   分支字段(email / emailCode / phone / smsCode)不在 keyof RegisterForm 里,
 *   写不进 FieldErrors<T> —— 只能先在具体类型上构造好再交回去,
 *   而"具体字面量"是否兼容"任意子类型 T 的错误表"对编译器不可判定。
 *   这是泛型收窄边界的经典死角,按 README 授权用恰好一次 as 跨过去。
 *
 * @example
 *   validateRegisterForm({ ...emailForm, email: 'not-an-email' })
 *   // => { email: '邮箱格式不正确' }
 */
export function validateRegisterForm<T extends RegisterForm>(form: T): FieldErrors<T> {
  const errors: FieldErrors<T> = {}

  // 公共校验:这两个键在 keyof RegisterForm 里,直接可写
  if (form.username.trim() === '') {
    errors.username = '用户名必填'
  }
  if (form.password.length < 8) {
    errors.password = '密码至少 8 位'
  }

  // 分支字段:先在具体类型上构造(收窄后的 form 字段随便用)
  let branch: FieldErrors<EmailRegisterForm> | FieldErrors<PhoneRegisterForm> = {}
  if (form.method === 'email') {
    const emailBranch: FieldErrors<EmailRegisterForm> = {}
    if (!form.email.includes('@')) {
      emailBranch.email = '邮箱格式不正确'
    }
    if (form.emailCode.length !== 6) {
      emailBranch.emailCode = '验证码必须是 6 位'
    }
    branch = emailBranch
  } else {
    const phoneBranch: FieldErrors<PhoneRegisterForm> = {}
    if (form.phone.length !== 11) {
      phoneBranch.phone = '手机号必须是 11 位'
    }
    if (form.smsCode.length !== 6) {
      phoneBranch.smsCode = '验证码必须是 6 位'
    }
    branch = phoneBranch
  }

  // 本次 as 是 README 授权的唯一断言:值收窄了(form),T 没收窄
  // (它可能是 EmailRegisterForm 的任意子类型),TS 无法证明
  // "具体构造的错误对象"兼容"任意子类型的 FieldErrors<T>"。
  return { ...errors, ...branch } as FieldErrors<T>
}
```

### 附:零 as 的重载版（纳入 check:textbook 验证）

"返回类型跟着入参走"除了泛型还有第二条路:**函数重载**。实现签名吃具体联合,
函数体内全是具体类型,一次 as 都不用:

```ts
export function validateRegisterForm(form: EmailRegisterForm): FieldErrors<EmailRegisterForm>
export function validateRegisterForm(form: PhoneRegisterForm): FieldErrors<PhoneRegisterForm>
export function validateRegisterForm(form: RegisterForm): FieldErrors<RegisterForm>
export function validateRegisterForm(
  form: RegisterForm,
): FieldErrors<EmailRegisterForm> | FieldErrors<PhoneRegisterForm> {
  // 公共键的窄类型(只在 keyof RegisterForm 里取键)
  const common: Partial<Record<'method' | 'username' | 'password' | 'address', string>> = {}
  if (form.username.trim() === '') common.username = '用户名必填'
  if (form.password.length < 8) common.password = '密码至少 8 位'

  if (form.method === 'email') {
    // form 已收窄到具体类型,分支字段随便写 —— 泛型版卡住的地方在这里畅通
    const branch: FieldErrors<EmailRegisterForm> = { ...common }
    if (!form.email.includes('@')) branch.email = '邮箱格式不正确'
    if (form.emailCode.length !== 6) branch.emailCode = '验证码必须是 6 位'
    return branch
  }
  const branch: FieldErrors<PhoneRegisterForm> = { ...common }
  if (form.phone.length !== 11) branch.phone = '手机号必须是 11 位'
  if (form.smsCode.length !== 6) branch.smsCode = '验证码必须是 6 位'
  return branch
}
```

两版取舍(记进 NOTES 的素材):
- 泛型版：保留入参子类型的键信息；主参考实现需要一次说明理由的断言。
- 重载版：零 as；分别列出邮箱、手机以及联合参数三条对外签名。联合变量需要第三条重载，调用方看不到实现签名；新增注册方式时同步维护列表。
- 还有个邪道:分支里 `Object.assign(errors, emailBranch)` —— 能编译(Object.assign 的签名不查键兼容),但那是钻签名宽松的空子,**把不可判定藏在库的漏洞里**,不如明写一次 as 加注释诚实。工程上"显式断言 + 原因注释"优于"隐式漏洞"。

## 二、常见错误写法(点评人视角)

### 1. 平行可选字段代替判别联合(本 day 建模层头号坑)

```ts
// ❌
type WeakForm = {
  method: 'email' | 'phone'
  email?: string; emailCode?: string
  phone?: string; smsCode?: string
  username: string; password: string; address: Address
}
```

实测两个"静默丢保证"的现象:

```ts
const w: WeakForm = { method: 'email', username: 'u', password: 'p', address }
// ↑ 合法!选了邮箱却什么都没填,编译器不吭声 —— 必填保证没了

declare const wf: WeakForm
if (wf.method === 'email') {
  const e: string = wf.email
  // error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  // 收窄了 method 也救不了 email —— 使用点还是要判空
}
```

✅ 判别联合:成员边界 = 依赖关系;测试里两条 `@ts-expect-error`
(选 email 出现 phone、选 phone 缺 smsCode)只有联合版能点亮。

### 2. Address 可选字段显式传 undefined(eOPT 坑)

```ts
// ❌
const bad: Address = { country: '中国', city: '上海', detail: undefined }
```

现象:`error TS2375 ... with 'exactOptionalPropertyTypes: true'`(测试反例已锁)。
"没有详细地址"就别写 detail 这个键;要"构造时可能没有"就用条件展开
(`...(x !== undefined ? { detail: x } : {})`)—— 和 Day 7 的 toEditForm 同一个知识点。

### 3. FieldErrors 写成 Record<string, string>

```ts
// ❌
export type FieldErrors<T> = Record<string, string>
const errs: FieldErrors<EmailRegisterForm> = {}
getFieldError(errs, 'foo')   // 不报错 —— 拼错字段名静默通过
```

另半个问题:`Record<string, string>` 所有键**必填**,`{}` 都赋不进去。
✅ `Partial<Record<keyof T, string>>`:键受限 + 非全量,一步到位。

### 4. setFieldError 忘了拷贝(可变性坑)

```ts
// ❌ 看起来最短
export function setFieldError<T extends object>(
  state: FormState<T>, field: keyof T, message: string,
): FormState<T> {
  state.errors[field] = message  // 直接改原对象
  return state
}
```

现象:编译零报错(完全合法的写入),测试 `expect(emptyState.errors).toEqual({})` 红。
类型系统不管可变性 —— **不可变是设计决定,不是类型推论**。
顺带:写 `errors[field] = message` 时 errors 的类型要是 `FieldErrors<T>`
(而不是从 state.errors 直接推导),泛型键写入才畅通。

### 5. validateRegisterForm 分支里直接写 errors.email(README 预告的坑)

```ts
// ❌
export function validateRegisterForm<T extends RegisterForm>(form: T): FieldErrors<T> {
  const errors: FieldErrors<T> = {}
  if (form.method === 'email') {
    if (!form.email.includes('@')) {
      errors.email = '邮箱格式不正确'   // ← 卡死在这
    }
  }
  ...
```

现象(实测):

```
error TS2339: Property 'email' does not exist on type 'Partial<Record<keyof T, string>>'.
```

注意对比:`errors.username = ...` **不报错** —— 公共键在 keyof RegisterForm
(联合的公共键)里;`email` 只在 EmailRegisterForm 里,keyof T(延迟求值)
看不见它。`form.method === 'email'` 收窄的是值,T 不会跟着收窄
(Day 2/Day 6 同一结论第三次出现,这次挡的是**写入**)。
✅ 分支错误先在具体类型上构造,再合并返回(见参考实现,合并处用授权的一次 as)。

### 6. 返回类型不跟着入参走(签名没反推到位)

```ts
// ❌ 看起来省事
export function validateRegisterForm(form: RegisterForm): FieldErrors<RegisterForm> { ... }
```

现象:传 emailForm 返回的是 `FieldErrors<RegisterForm>`
(键只剩 method/username/password/address 公共四个),
测试 `expectTypeOf(errs).toEqualTypeOf<FieldErrors<EmailRegisterForm>>()` 红;
`getFieldError(errs, 'email')` 也随之报错。
✅ `<T extends RegisterForm>(form: T): FieldErrors<T>`,或用重载(见附录)。

### 7. getFieldError 里手写 undefined 判断(多余)

```ts
// ⚠️ 能跑,但暴露了对类型的误解
return errors[field] === undefined ? undefined : errors[field]
```

`errors[field]` 本来就是 `string | undefined`(可选属性索引读取),
直接 return 即可 —— 测试 `expectTypeOf(getFieldError(...)).toEqualTypeOf<string | undefined>()`
考的就是你知道这个"天然"。

## 三、思考题参考答案

### Part 1 第 1 题:RegisterMethod 为什么不能是 string?

它是判别符。判别收窄的前提:判别符字段在各成员里是**不同的字面量类型**,
和字面量比较后 TS 才能删掉不匹配的成员。string 在每个成员上都一样,
比完等于没比 —— 联合白建了。

### Part 1 第 4 题:平行可选字段丢掉什么?

三个保证:必填(选了 email 就必须填 email)、对象字面量的多余字段检查、
收窄后的非空(收窄分支里字段仍是 `xxx | undefined`)。
一句话:可选字段表达"有什么",联合成员表达"什么时候必须有什么"。

### Part 2 第 5 题:为什么不用 Record<string, string>?

键安全(拼错字段名当场报错 vs 静默查空)+ 非全量(错误是"至多一条",
Partial 语义;Record 全必填连 `{}` 都不合法)。

### Part 2 第 6 题:返回值为什么天然是 string | undefined?

`FieldErrors<T>` 的键全是可选的;索引读取可能不存在的可选属性,
TS 自动并入 undefined —— 不用手写,写了反而说明没读懂类型从哪来。

### Part 3 第 9 题:为什么恰好一次 as 绕不开(泛型版)?

- 值收窄 ≠ 类型参数收窄:`form.method === 'email'` 后 form 是
  `T & EmailRegisterForm`,T 还是那个"可能是任何子类型"的 T;
- `FieldErrors<T>` 是延迟求值类型,分支键(email 等)不在其约束的键集里,
  具体构造的对象无法被证明兼容任意子类型的错误表;
- 所以:公共部分直接写、分支部分具体构造、合并处一次 as + 注释。
- 想彻底零 as → 放弃"泛型跟随",改用重载(见附录,实测同样全绿);
  两条路各有代价,理解取舍比背答案重要。

## 四、验收自查清单

- [ ] `pnpm check:day 09` 通过（类型检查 + 运行时测试）
- [ ] 零 `any`;`validateRegisterForm` 里至多一次 `as`,且带原因注释
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 条件字段进类型系统:选 email 传 phone、选 phone 缺 smsCode 都是编译错误
- [ ] `Address` 的可选字段在 exactOptionalPropertyTypes 下拒收显式 `undefined`
- [ ] `setFieldError` 不可变:新对象新 errors,原 state 原样
- [ ] `validateRegisterForm` 签名是泛型:返回类型跟着入参收窄
- [ ] (加分)弄懂附录的重载版,能说出两版各自的代价
