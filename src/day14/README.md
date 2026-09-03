# Day 14 — provide/inject 类型安全 + emits 事件映射(纯 TS 模拟)

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

Vue 源码里的定义是 `interface InjectionKey<T> extends Symbol {}`(一行都没多)。
这里多出的 `__injectionType?: T` 是**幽灵属性**:因为本仓库开了 `noUnusedLocals`,
T 不被任何成员读到会报 TS6133;幽灵属性运行时永远是 undefined,类型层行为与 Vue 原版完全一致。
它的工作原理:**接口继承 `Symbol`,泛型 T 只出现在类型标注上**,
于是 `InjectionKey<ThemeContext>` 和 `InjectionKey<CurrentUser>` 就是两个不同的类型标注。

任务:

1. 定义 `ThemeMode`(字面量联合)、`ThemeContext`、`CurrentUser`、`NotificationSettings`(形状见测试,JSDoc 里写明用途)。
2. `THEME_KEY` / `USER_KEY` 已经照 Vue 的写法给出,读懂它们;然后**照葫芦画瓢**声明 `SETTINGS_KEY`,
   让它携带 `NotificationSettings`。
3. 在 `SETTINGS_KEY` 的 JSDoc 里回答:**为什么 key 用 `symbol` 而不是 `string`?**
   (提示:两个 npm 包都用 `'theme'` 当 key 会发生什么?)

### 思考题(写进 NOTES.md,不进测试)

- `InjectionKey<A>` 和 `InjectionKey<B>` 结构上完全相同(T 没出现在任何属性里),
  TS 却能在 `inject` 时区分它们,靠的是什么?(答案和"结构化类型"有关,想想推断发生在哪一步)
- Vue 源码里 `inject` 的实现内部有两处 `as`。为什么"全世界最讲类型安全的框架"也逃不掉?

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
   允许**一处** `as`/`unknown` 转换,必须紧跟 `// TODO(reason)` 说明(这就是 Vue 源码里那两处 as 的处境)。

---

## Part 3 — 🔴 边界:inject 的重载签名(从测试反推)

7. `inject` 的占位签名是**错的**。从测试反推,它需要**函数重载**表达两种行为:
   - 只传 key:可能没有祖先提供过 → 返回 `T | undefined`
   - 传了默认值:保证有值 → 返回 `T`(不是 `T | undefined`!)

   验收里有反例:`inject(THEME_KEY, 'dark')` 必须编译报错(默认值类型不符)。
   想想为什么单签名 `inject<T>(key, defaultValue?: T): T | undefined` 不够好 ——
   它会让"传了默认值"的调用也背上 `| undefined`,调用方就得写非空断言。

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm vitest run src/day14` 全过
- [ ] 零 `any`、除事件存储擦除点外零 `as`(擦除点必须有 TODO(reason) 注释)
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] `SETTINGS_KEY` 的 JSDoc 回答了"为什么用 symbol 不用 string"
- [ ] `emit('user:rename', '不是数字', 'x')` 这类调用编译报错(测试有 @ts-expect-error 反例)
- [ ] `inject` 是重载签名;传默认值时返回类型**没有** `undefined`

## 写完后

贴 `solution.ts`,说:"点评 + 解释为什么"。
卡超过 10 分钟来要提示(不要答案)。建议节奏:Part 1 20 分钟 → Part 2 40 分钟 → Part 3 30 分钟。
