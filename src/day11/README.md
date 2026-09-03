# Day 11 — 类型安全的发布订阅事件系统

## 业务场景

chipRunner 是 Nuxt4 应用,你在两处用过"全局事件":跨组件的**全局通知**(顶部 toast)、**埋点上报**(登录、下单)。现在要做一个不依赖任何库的事件总线(mitt 的类型安全版),接到 `app.provide` 里全局可用。

事件规格(与后端/埋点组约定):

| 事件名 | payload |
|---|---|
| `notify:success` | `{ title: string; message: string }` |
| `notify:error` | `{ title: string; message: string; code: number }` |
| `user:login` | `{ userId: string }` |
| `modal:close` | 无 payload |

要求:**事件名拼错、payload 形状不对、该传参时不传、不该传参时硬塞 —— 全部编译报错**,而不是运行时才发现。

---

## Part 1 — 🟢 基础:事件表

1. `NotificationEvents`:事件名 → payload 的映射类型(规格见上表,`modal:close` 的值是 `undefined` 表示无 payload)。
   - **必须用 type,不能用 interface** —— JSDoc 里解释为什么(提示:`E extends Record<string, unknown>` 约束 + 隐式索引签名;测试里有 interface 的反例)。
2. `EventHandler<E, K>`:处理事件 K 的处理器,参数就是 `E[K]`。

## Part 2 — 🟡 进阶:on / off / emit 泛型签名

3. `EventBus<E>` 接口,三个方法占位都是 `never`,从测试反推签名:
   - `on('user:login', h)`:h 的参数类型由事件名决定 —— **泛型 K extends keyof E**;
   - `off` 与 `on` 同签名(退订传同一个函数引用);
   - `emit`:事件名 + payload 联动(见 Part 3)。
4. `createEventBus<E>()` 工厂:内部 `Map<事件名, Set<handler>>`。
   - **参数逆变的死结**:存进去的 handler 各不相同,取出来统一调用 —— 没有任何统一的签名能同时"收得下所有 handler"和"可被安全调用"。提示:想想 `never` 在**参数位**的意义。内部允许**一次 `as`**,必须带 `// TODO(reason)` 注释说明为什么绕不开。

## Part 3 — 🔴 边界:emit 的条件参数

5. `emit` 的压轴约束:**无 payload 事件调用时不传参,有 payload 事件必须传**:
   - `emit('modal:close')` 合法,`emit('modal:close', {...})` 编译报错;
   - `emit('notify:success', { title, message })` 合法,`emit('notify:success')` 编译报错。
   - 提示:rest 参数 + 条件元组 —— `...args: E[K] extends undefined ? [] : [payload: E[K]]`。想清楚 `'modal:close'` 的值是 `undefined` 时,为什么正好走 `[]` 分支。

---

## 验收清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] 零 `any`;`createEventBus` 内部至多一次 `as`,带 `// TODO(reason)` 注释
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 事件表用 type 定义,JSDoc 解释 interface 为什么不行
- [ ] 未知事件名 on/emit 都编译报错(测试有反例)
- [ ] 无 payload 事件:emit 不传参合法、硬塞参数报错;handler 收到 undefined
- [ ] handler 参数类型由事件名联动:要求多余字段的 handler 编译报错(参数逆变)
- [ ] off 之后不再触发;off 只移除指定 handler

## 写完后

贴 `src/day11/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 15 分钟 → Part 2 30 分钟(死结想不通就来问,要提示)→ Part 3 20 分钟。
