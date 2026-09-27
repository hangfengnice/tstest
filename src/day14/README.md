# Day 14 — provide/inject 类型安全 + emits 事件映射(纯 TS 模拟)

## 重学导读

**前置知识**：Day 10 重载、Day 11 事件关联；Part 1 的 Symbol 脚手架可直接使用。

**今天要学会**：让注入 key 携带值类型，并精确表达缺省值和事件参数列表。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| Symbol 与类型 | Symbol 在运行时提供唯一键，InjectionKey<T> 在类型层连接键和值；载荷结构相同的类型不因此获得名义隔离。 |
| 缺失与默认值 | 未提供默认值的读取可能缺失；提供默认值后返回类型可更精确。先分别列出两种调用，再写重载。 |
| 元组事件 | 把载荷扩展为参数元组后，一个事件可以有多个参数；空元组仍表示零参数，参数位置和数量都受检查。 |

### 动手顺序

先读上下文栈脚手架 → 定义领域类型与 key → 实现 provide/inject → 完成事件映射 → 检查嵌套查找和取消订阅。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：类型标注会创建幽灵字段吗？为什么 inject 的一次断言需要依赖 provide 的写入约定？
- **迁移**：为表格编辑页设计一个服务 key，说明没有提供服务时调用方应如何处理。
- **验收**：在项目根目录运行 `pnpm check:day 14`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 的通知中心是三层组件树:`App` → `NotificationPanel` → `NotificationItem`。
主题服务、当前用户这类"全局依赖"如果层层 props 传递会写到吐血,Vue 的答案就是 provide/inject。
但你一定也见过它的黑暗面:**key 是裸字符串、注入值是 any、改名之后运行时才炸**。

今天不 import vue,用纯 TS 把 Vue 的两套类型机制亲手造一遍:

1. **InjectionKey 模式** —— 让 key 本身"携带"值的类型(vue 3 的核心设计之一)
2. **emits 事件映射** —— 事件名 → 参数元组,`emit` 时参数类型全量检查

---

## Part 1 — 🟢 基础:InjectionKey 模式

`solution.ts` 里已经给了骨架:

```ts
export interface InjectionKey<T> extends Symbol {
  readonly __injectionType?: T
}
```

这里的 `__injectionType?: T` 是本练习的**幽灵属性**，用于在类型结构中携带 T，
同时避免未使用类型参数的报错。这是教学用的简化模型，不声称与 Vue 源码定义完全一致。
本题通过 `Symbol()` 创建 key，不创建这个可选属性；接口声明本身不会生成运行时字段。
它的工作原理:**接口继承 `Symbol`,泛型 T 只出现在类型标注上**,
于是 `InjectionKey<ThemeContext>` 和 `InjectionKey<CurrentUser>` 就是两个不同的类型标注。

任务:

1. 定义 `ThemeMode`(字面量联合)、`ThemeContext`、`CurrentUser`、`NotificationSettings`(形状见测试,JSDoc 里写明用途)。
2. `THEME_KEY` / `USER_KEY` 已经照 Vue 的写法给出,读懂它们;然后**照葫芦画瓢**声明 `SETTINGS_KEY`,
   让它携带 `NotificationSettings`。
3. 在 `SETTINGS_KEY` 的 JSDoc 里回答:**为什么 key 用 `symbol` 而不是 `string`?**
   (提示:两个 npm 包都用 `'theme'` 当 key 会发生什么?)

### 思考题(写进 NOTES.md,不进测试)

- `__injectionType?: T` 如何参与泛型推断？当 A、B 结构相同或不同时，key 的赋值兼容性分别怎样？
- 本练习的 inject 从保存 unknown 的容器读取值时，如何恢复 T？若使用断言，需要哪些运行时不变量支撑？

---

## Part 2 — 🟡 进阶:实现 provide / inject

上下文栈的脚手架(`runWithContext` / `lookupKey`)已经写好,**不需要你实现**,
你要写的是真正暴露给"组件"用的两个函数:

4. `provide<T>(key: InjectionKey<T>, value: T): void` —— 签名已给,补运行时:
   把 `value` 写进当前栈顶的上下文。**栈为空时抛错**(在 `runWithContext` 外调用 = 在组件外 provide)。
5. 事件映射:`NotificationEvents`,三个事件(形状从测试反推,注意 `panel:close` 是**零参数事件**):
   - `theme:change`
   - `user:rename`
   - `panel:close`
6. `EventHandler` + `Emitter<E>` + `createEmitter<E>()`:
   - `on(event, handler)` 返回取消订阅函数
   - `emit(event, ...args)` 参数逐个类型检查
   - **难点**:内部存储用什么类型?事件名是异构的,你总会在某一行遇到类型擦除 ——
   事件存储允许**一处**类型断言，inject 从 unknown 恢复 T 另允许**一处**；各自用 `// TODO(reason)` 说明写入与读取的关联依据。

---

## Part 3 — 🔴 边界:inject 的重载签名(从测试反推)

7. `inject` 的占位签名是**错的**。从测试反推,它需要**函数重载**表达两种行为:
   - 只传 key:可能没有祖先提供过 → 返回 `T | undefined`
   - 传了默认值:保证有值 → 返回 `T`(不是 `T | undefined`!)

   验收里有反例:`inject(THEME_KEY, 'dark')` 必须编译报错(默认值类型不符)。
   想想为什么单签名 `inject<T>(key, defaultValue?: T): T | undefined` 不够好 ——
   它会让"传了默认值"的调用也背上 `| undefined`,调用方就得写非空断言。

## 验收点

- [ ] `pnpm check:day 14` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 零 `any`；类型断言仅允许两处：事件存储一次、inject 取值一次，各带 TODO(reason) 说明
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] `SETTINGS_KEY` 的 JSDoc 回答了"为什么用 symbol 不用 string"
- [ ] `emit('user:rename', '不是数字', 'x')` 这类调用编译报错(测试有 @ts-expect-error 反例)
- [ ] `inject` 是重载签名;传默认值时返回类型**没有** `undefined`

## 写完后

贴 `solution.ts`,说:"点评 + 解释为什么"。
卡超过 10 分钟来要提示(不要答案)。建议节奏:Part 1 20 分钟 → Part 2 40 分钟 → Part 3 30 分钟。

---

[上一题：Day 13](../day13/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 15](../day15/README.md)
