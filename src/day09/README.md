# Day 9 — 复杂表单类型设计:条件字段 + 嵌套 + 校验状态

## 重学导读

**前置知识**：Day 1 判别联合；Day 5 泛型；Day 7 Partial/Record。

**今天要学会**：把表单条件字段和错误状态分别建模，避免不可能的字段组合。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 条件字段 | 邮箱模式与手机模式各有必填字段，用 method 把字段绑定到分支；两个可选字段无法表达“至少选一种”。 |
| 错误映射 | 字段名由 keyof T 限定，错误只覆盖部分字段，所以再加 Partial。表单值与错误状态应分开。 |
| 泛型与分支 | 收窄一个值不代表泛型参数 T 本身被替换。返回 FieldErrors<T> 时要保留调用方字段关系，并说明构造的依据。 |

### 动手顺序

先列合法/非法表单 → 定义嵌套数据 → 做 errors/touched 映射 → 写不可变更新 → 最后实现校验函数。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为何 Record<string, string> 无法发现拼错的字段？TS 类型能否保证邮箱字符串格式正确？
- **迁移**：把注册方式改成个人 / 企业申请，列出每种模式独有的必填字段。
- **验收**：在项目根目录运行 `pnpm check:day 09`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

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
   注意：这里通过判别联合与对象字面量的多余属性检查验收，不是“精确对象类型”。已有变量可能携带额外字段；外部数据若要求拒绝额外字段，应另做运行时校验。
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
   - 传 `EmailRegisterForm` 必须得到 `FieldErrors<EmailRegisterForm>`,传 `PhoneRegisterForm` 得到 `FieldErrors<PhoneRegisterForm>` —— 返回类型要**跟着入参收窄**,本题主线使用泛型；参考答案另有重载方案。
   - 运行时规则见 JSDoc(用户名空 / 密码短 / 邮箱格式 / 验证码位数 / 手机号位数)。
   - **预告一个坑**:分支里 `form.method === 'email'` 收窄了 `form`,但泛型 `T` 不会跟着收窄(它可能是 `EmailRegisterForm` 的子类型)。构造好的对象字面量赋不进 `FieldErrors<T>`。本题允许**至多一次 `as FieldErrors<T>`**，并说明当前构造方式中编译器无法证明的关联；重载方案可作为对照。

---

## 验收清单

- [ ] `pnpm check:day 09` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 零 `any`;`validateRegisterForm` 里至多一次 `as`,且带原因注释
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 条件字段进类型系统:选 `email` 传 `phone` 字段、选 `phone` 缺 `smsCode`,都是编译错误(测试有 `@ts-expect-error` 反例)
- [ ] `Address` 的可选字段在 `exactOptionalPropertyTypes` 下拒收显式 `undefined`
- [ ] `setFieldError` 不可变:新对象新 errors,原 state 原样
- [ ] 主线使用泛型保留入参类型；重载对照方案也须支持邮箱、手机和联合变量调用，并通过相同验收

## 写完后

贴 `src/day09/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 20 分钟 → Part 2 25 分钟 → Part 3 35 分钟。卡超过 10 分钟再来问,要提示不要答案。

---

[上一题：Day 8](../day08/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 10](../day10/README.md)
