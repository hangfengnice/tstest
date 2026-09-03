# Day 26 — 第三阶段综合:Pinia 风格 Store 的完整类型推导

## 业务场景

写 Vue 项目离不开 Pinia,但你有没有想过:`defineStore({ state, getters, actions })` 返回的 store,为什么 `store.items`(state)、`store.unreadCount`(getters)、`store.markAllRead()`(actions)能**全部平铺、全部带精确类型**?这层类型魔法 = 本周学的全部工具类型(条件 / 映射 / 模板字面量 / 递归 / 元组)的一次总装。

今天**不 import pinia**,用纯 TS 手写一个迷你版:`defineStore` + 六个类型工具 + 运行时实现。业务载体是 chipRunner 的**会话列表 store**。

### 本仓库的简化协议(先读,和真 Pinia 的差别是刻意简化)

- **actions 的第一个参数是 state**(真 Pinia 用 `this`,那要引入 ThisType 体操,超出本周范围):
  `addConversation(s: ConvState, c: Conversation) => void`;
- getters 保持 Pinia 语义:`(state) => 返回值`,store 上暴露的是**调用结果**(每次访问重新计算);
- store 顶层 = state 平铺 + getters 平铺(解包返回值)+ actions 平铺(**去掉首参 state**)+ 四个 `$` 方法:

  | 成员 | 类型 |
  |---|---|
  | `$id` | `string` |
  | `$state` | 解包后的 state 对象类型 |
  | `$snapshot()` | 返回 `DeepReadonly<state>`(深拷贝 + Object.freeze,Day 23 复刻) |
  | `$subscribe` | 按 action 名生成的订阅器 map:键是 `` `on${Capitalize<action名>}` ``,值是 `(cb: ...args 回调) => 取消订阅函数` |

---

## Part 1 — 🟢 基础:state 工厂解包

1. `UnwrapState<ST>`:state 定义允许 `S` 或 `(() => S)` 两种形态,这个工具统一拿到纯对象类型 `S`。条件类型 + `infer` 一发入魂。
   (为什么允许函数?真 Pinia 里 state 用工厂避免多实例共享同一对象引用 —— 和组件 `data()` 必须是函数同一个原因。)

## Part 2 — 🟡 进阶:getters / actions 的参数手术

2. `UnwrapGetters<G>`:`{ unreadCount: (s) => number }` → `{ unreadCount: number }`。映射类型逐个解包 getter 的**返回值**。
3. `DropFirst<T>`:元组去掉第一个元素(Day 24 的元组技能回归):`[1, 2, 3]` → `[2, 3]`,`['x']` → `[]`。
4. `BoundActions<A>`:把 actions 的**首参 state 砍掉**:`{ setFilter: (s, f) => void }` → `{ setFilter: (f) => void }`。
   组合提示:`Parameters<函数>` 拿参数元组、`DropFirst` 砍首参、`(...args: 剩余元组) => ReturnType<函数>` 重组 —— 也可以直接在条件类型里 `infer` 一次完成。

## Part 3 — 🔴 边界:订阅器 + 快照 + 总装

5. `DeepReadonly<T>`:Day 23 复刻(对象 + 数组递归 readonly),用于 `$snapshot` 的返回类型。
6. `ActionEvents<A>`:模板字面量键重映射 —— `{ markAllRead: (s) => void }` → `{ onMarkAllRead: (cb: () => void) => () => void }`。
   需要的知识:`as` 子句重映射键(不是值)、`Capitalize` 内置工具、`` `on${Capitalize<K & string>}` `` 拼接、回调参数复用 `DropFirst`。
7. `StoreInstance<D>`:把 D(definition 对象类型)组装成最终 store 类型 —— 交叉类型 + 上面全部工具 + 四个 `$` 方法。
8. `defineStore` 运行时实现(协议):
   - state 是函数就调用,得到 state 对象;
   - getters 包装成无参函数(每次调用把当前 state 传进去);
   - actions 包装成"自动注入 state"的函数,**执行后触发对应订阅器**;
   - `$snapshot`:深拷贝(提示:`structuredClone`)后逐层 `Object.freeze`;
   - `$subscribe.onXxx`:注册回调、返回取消订阅函数。

---

## 提示区(卡住 15 分钟以上再看)

- `UnwrapState<ST>`:`ST extends () => infer S ? S : ST` —— 工厂函数分支在前
- `UnwrapGetters<G>`:`{ [K in keyof G]: G[K] extends (...args: never[]) => infer R ? R : never }` 的骨架(为什么不直接 `ReturnType<G[K]>`?试试看能不能过)
- `DropFirst<T>`:`T extends readonly [unknown, ...infer Rest] ? Rest : []` —— 空元组兜底成 `[]`
- `ActionEvents` 的键重映射:`{ [K in keyof A as `on${Capitalize<K & string>}]: ... }`;`K & string` 是为了把 `keyof A` 里可能的 symbol/number 排除掉
- `StoreInstance` 里注意:`D['state']`、`D['getters']`、`D['actions']` 索引访问后交给前面的工具,再 `&` 起来
- 运行时的 `$subscribe`:每个 action 名一个 `Set<回调>`,action 包装函数执行完就遍历触发;`onXxx` 返回的取消函数从 Set 里 delete

## 验收清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] 六个类型工具全部实现,零 `any`;运行时 `defineStore` 零 `as`
- [ ] store 顶层:`store.items` / `store.unreadCount` / `store.markAllRead()` 类型与运行时全部正确
- [ ] `store.$subscribe.onMarkAllRead` 订阅触发一次、off 后不再触发
- [ ] `$snapshot` 深拷贝:改 store 不影响已取出的快照
- [ ] 所有 export 有 JSDoc + `@example`;JSDoc 里回答:"BoundActions 为什么要砍首参,而 getters 不用?"

## 写完后

贴 `src/day26/solution.ts` 过来,说:"点评 + 解释为什么"。这是第三阶段收官题,写完把 Day 23-26 四份 solution 一起贴上来,我会做阶段总结。

**建议节奏**:Part 1 15 分钟 → Part 2 40 分钟 → Part 3 60 分钟(总装 + 运行时)。卡超过 15 分钟来要提示,不要答案。
