# Day 9 — 复杂表单类型设计:条件字段 + 嵌套 + 校验状态

## 业务场景

chipRunner 团队后台要做一个**新成员注册页**。产品要求:

- 注册方式二选一:**邮箱注册** / **手机号注册**。
- 选了邮箱,`email` + `emailCode`(邮箱验证码)必填;选了手机,`phone` + `smsCode` 必填 —— **字段之间有依赖,不是平行可选**。
- 所有注册方式都要填:用户名、密码、收货地址(国家/城市必填,详细地址和邮编可省)。
- 表单组件里维护一份运行时状态:当前值、每个字段的错误信息、哪些字段被"碰过"(blur 过才显示错误)、提交次数。

这类"条件字段 + 嵌套对象 + errors 映射"是 Vue 表单组合式函数(你写过的 `useForm`)的核心类型。今天不用任何表单库,把类型层亲手搭一遍。

---

## Part 1 — 🟢 基础:条件字段 + 嵌套字段

1. `RegisterMethod`:`'email' | 'phone'` 字面量联合。想清楚:它是**判别符**,为什么不能是 `string`?
2. `Address` 嵌套类型:`country` / `city` 必填,`detail` / `zip` 可选。
   - 注意仓库开了 `exactOptionalPropertyTypes`:可选属性**不允许显式传 `undefined`**(测试有反例)。
3. `EmailRegisterForm` / `PhoneRegisterForm`:两组互斥的条件字段,各自带 `method` 字面量判别符 + 公共字段(username / password / address)。
4. `RegisterForm = 两者联合`。思考并写进 JSDoc:如果用 `email?: string; phone?: string` 两个平行可选字段,会丢掉什么保证?

## Part 2 — 🟡 进阶:校验状态(errors / touched 映射)

5. `FieldErrors<T>`:`Partial<Record<keyof T, string>>`。
   - JSDoc 必须回答:为什么不用 `Record<string, string>`?(两个原因:键安全 + 非全量)
6. `getFieldError(errors, field): string | undefined` —— 签名已给,填实现。
   - 想想返回值为什么**天然**是 `string | undefined`,不需要你手写。
7. `setFieldError(state, field, message): FormState<T>` —— 不可变更新,原对象不能被修改(测试用 `toBe`/`toEqual` 双重断言检查)。

## Part 3 — 🔴 边界:FormState + 泛型校验函数(签名从测试反推)

8. `FormState<T>`:四件套 `{ values, errors, touched, submitCount }`,其中 `touched` 也是映射类型(哪个字段被碰过记 true)。
9. `validateRegisterForm` —— **占位签名是错的**(`form: never`),从 `solution.test.ts` 反推:
   - 传 `EmailRegisterForm` 必须得到 `FieldErrors<EmailRegisterForm>`,传 `PhoneRegisterForm` 得到 `FieldErrors<PhoneRegisterForm>` —— 返回类型要**跟着入参收窄**,这逼你用泛型。
   - 运行时规则见 JSDoc(用户名空 / 密码短 / 邮箱格式 / 验证码位数 / 手机号位数)。
   - **预告一个坑**:分支里 `form.method === 'email'` 收窄了 `form`,但泛型 `T` 不会跟着收窄(它可能是 `EmailRegisterForm` 的子类型)。构造好的对象字面量赋不进 `FieldErrors<T>`。本题允许**恰好一次 `as FieldErrors<T>`**,并在旁边注释解释为什么这里绕不开。

---

## 验收清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] 零 `any`;`validateRegisterForm` 里至多一次 `as`,且带原因注释
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 条件字段进类型系统:选 `email` 传 `phone` 字段、选 `phone` 缺 `smsCode`,都是编译错误(测试有 `@ts-expect-error` 反例)
- [ ] `Address` 的可选字段在 `exactOptionalPropertyTypes` 下拒收显式 `undefined`
- [ ] `setFieldError` 不可变:新对象新 errors,原 state 原样
- [ ] `validateRegisterForm` 签名是泛型:返回类型跟着入参收窄

## 写完后

贴 `src/day09/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 20 分钟 → Part 2 25 分钟 → Part 3 35 分钟。卡超过 10 分钟再来问,要提示不要答案。
