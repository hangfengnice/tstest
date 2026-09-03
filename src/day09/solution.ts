/**
 * Day 9 — 复杂表单的类型设计(条件字段 + 嵌套字段 + 校验状态)
 *
 * 学习目标:
 *   1. 条件字段:选了注册方式 A,字段组 B 必填(可辨识联合建模表单)
 *   2. 嵌套字段:地址对象,体验 exactOptionalPropertyTypes 对可选属性的影响
 *   3. 校验状态:errors / touched 映射 —— Partial + Record 的组合拳
 *   4. 🔴 validateRegisterForm 的泛型签名(从测试反推)
 *
 * 规则:
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 所有 export 必须有 JSDoc + @example
 *   - 类型占位是 never,函数体是 throw new Error('TODO'),逐个替换
 */

// =============================================================
// Part 1 — 基础:条件字段 + 嵌套字段
// =============================================================

/**
 * 注册方式 —— 只有两种,字面量联合。
 *
 * 思考:为什么不用 string?
 * 它是表单联合的判别符(method),必须是字面量类型,
 * `if (form.method === 'email')` 才能触发收窄。
 *
 * @example
 *   const m: RegisterMethod = 'email'
 */
export type RegisterMethod = never // ← 替换

/**
 * 地址 —— 嵌套字段。注意 detail / zip 要设计成可选的:
 * 在 exactOptionalPropertyTypes 下,`detail: undefined` 显式传入会编译报错
 * (可选 ≠ 可以为 undefined,而是"可以不存在")。
 *
 * @example
 *   const a: Address = { country: '中国', city: '上海' }  // detail/zip 缺省,合法
 */
export type Address = never // ← 替换

/**
 * 邮箱注册表单 —— method 为 'email' 时,email + emailCode 必填。
 *
 * @example
 *   const f: EmailRegisterForm = {
 *     method: 'email', username: 'hf', password: '12345678',
 *     email: 'hf@example.com', emailCode: '123456',
 *     address: { country: '中国', city: '上海' },
 *   }
 */
export type EmailRegisterForm = never // ← 替换

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
export type PhoneRegisterForm = never // ← 替换

/**
 * 注册表单 —— 两种互斥的字段组合,用可辨识联合建模。
 *
 * 思考:用 `email?: string; phone?: string` 两个可选字段为什么是"弱建模"?
 *
 * @example
 *   const f: RegisterForm = emailForm
 *   if (f.method === 'email') f.emailCode  // 已收窄,不再是 string | undefined
 */
export type RegisterForm = never // ← 替换

// =============================================================
// Part 2 — 进阶:校验状态(errors / touched 映射)
// =============================================================

/**
 * 字段错误映射 —— 表单 T 的每个字段名,至多对应一条错误信息。
 *
 * 思考:为什么是 Partial<Record<keyof T, string>> 而不是 Record<string, string>?
 *
 * @example
 *   const errs: FieldErrors<EmailRegisterForm> = { email: '邮箱格式不正确' }
 *   // errs.foo = 'x' ← 编译报错,foo 不是表单字段
 */
export type FieldErrors<T> = T & never // ← 替换(占位结果就是 never;T & never 只是为了先"用掉"泛型参数)

/**
 * 读取某个字段的错误信息;没有错误时返回 undefined。
 *
 * 思考:为什么返回值天然是 string | undefined,不需要手动加?
 *
 * @example
 *   getFieldError({ email: '邮箱格式不正确' }, 'email')  // => '邮箱格式不正确'
 *   getFieldError({}, 'email')                            // => undefined
 */
export function getFieldError<T extends object>(
  errors: FieldErrors<T>,
  field: keyof T,
): string | undefined {
  // TODO: 实现(提示:一行就够)
  void errors
  void field
  throw new Error('TODO')
}

/**
 * 不可变地写入一条字段错误,返回新的 FormState(原对象不动)。
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
  // TODO: 不可变更新——先浅拷贝 errors,再写入,最后返回新 state
  void state
  void field
  void message
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:FormState + 泛型校验函数(签名从测试反推!)
// =============================================================

/**
 * 表单运行时状态 —— Vue 表单组合式函数里最常见的四件套。
 *
 * touched 也是映射类型:哪个字段被碰过(blur 过)就记 true,
 * 用于"没碰过的字段不显示错误"。
 *
 * @example
 *   const state: FormState<EmailRegisterForm> = {
 *     values: emailForm,
 *     errors: {},
 *     touched: { username: true },
 *     submitCount: 0,
 *   }
 */
export type FormState<T> = T & never // ← 替换(占位结果就是 never;T & never 只是为了先"用掉"泛型参数)

/**
 * 校验注册表单,返回所有字段的错误映射(全部通过时返回空对象)。
 *
 * 校验规则:
 *   - username 去掉首尾空格后为空 → '用户名必填'
 *   - password 长度 < 8 → '密码至少 8 位'
 *   - email 分支:email 不含 '@' → '邮箱格式不正确'
 *                 emailCode 长度 ≠ 6 → '验证码必须是 6 位'
 *   - phone 分支:phone 长度 ≠ 11 → '手机号必须是 11 位'
 *                smsCode 长度 ≠ 6 → '验证码必须是 6 位'
 *
 * @example
 *   validateRegisterForm({ ...emailForm, email: 'not-an-email' })
 *   // => { email: '邮箱格式不正确' }
 */
export function validateRegisterForm(form: never): never {
  // TODO: 上面的占位签名是错的,从 solution.test.ts 反推正确的泛型签名
  // 提示:返回类型必须跟着入参收窄 —— 传 EmailRegisterForm 得到 FieldErrors<EmailRegisterForm>
  void form
  throw new Error('TODO')
}
