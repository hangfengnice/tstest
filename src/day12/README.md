# Day 12 — 迷你 Store:state / getters / actions 的类型推导

## 重学导读

**前置知识**：Day 5–8 泛型与映射；会用普通函数的 this、call 和属性访问器。

**今天要学会**：让 Store 的状态、getter 结果和 action 参数从定义对象推导。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 定义与实例 | 定义里的 getter 是函数，实例上的 getter 是结果值。先画出输入与输出形状，再写映射。 |
| 反向映射推断 | 参数的映射结构把返回值放在 G[K] 位置，编译器可从传入的 getter 函数反推 G；从一个键的例子开始理解。 |
| this 绑定 | TS 的 this 参数只用于类型检查；运行时仍要用 call 等方式绑定。箭头函数使用词法 this，不能当作同一种绑定方式。 |

### 动手顺序

先做一个 state + 一个 getter + 一个 action → 观察实例类型 → 再补多键推断 → 实现访问器和 action 绑定 → 检查多实例是否共享状态。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么每次读取 getter 都重新计算？只有 this 类型声明却没有运行时绑定，会发生什么？
- **迁移**：为购物车新增总价 getter，先说明它依赖哪些 state，再预测暴露类型。
- **验收**：在项目根目录运行 `pnpm check:day 12`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

你天天用 Pinia,但有没有想过:`defineStore({...})` 一扔,`store.getters.count` 是 `number`、`store.actions.addItem('x')` 只收 string —— **这些类型是怎么从你写的选项对象里推出来的**?今天不 import 任何库,用纯 TS 把一个迷你 Pinia 的类型层搭出来。

业务就用购物车(测试已定):

- **state**:`{ items: string[]; coupon: string | null }`(优惠券没有时是 `null`,想清楚为什么状态字段不用 `undefined`)
- **getters**:`count`(件数)、`hasCoupon`、`summary`(文案)
- **actions**:`addItem` / `removeItem` / `applyCoupon` / `clear`(clear 无参)

关键设定:**action 里用 `this` 访问 state**(和 Pinia 一样),无参 action 的 payload 写 `_p: void`。

---

## Part 1 — 🟢 基础:热身泛型 + 业务状态

1. `StateFactory<S>` = `() => S`。JSDoc 回答:为什么 Pinia 的 state 是**函数**而不是对象?
2. `GetterFn<S, R>` = `(state: S) => R`。
3. `CartState`:形状见上(测试断言 `coupon` 是 `string | null`)。

## Part 2 — 🟡 进阶:StoreInstance 实例形状

4. `StoreInstance<S, G, A>`:
   - `state: S`;
   - `getters: G` —— 注意:实例上的 getter 是**求值结果**(`count: number`),不是函数。G 推的就是结果形状;
   - `actions: { [K in keyof A]: (payload: A[K]) => void }` —— 实例上的 action 是**绑定好 state 的调用器**,只剩 payload 参数。
   - **A 的语义**:action 名 → payload 类型(`{ addItem: string; clear: void }`)。`clear: void` 为什么就能 `cart.actions.clear()` 无参调用?(void 在参数位的独有待遇)

## Part 3 — 🔴 边界:defineStore 签名(从测试反推)

5. `defineStore` —— **占位签名是错的**,从测试反推。要同时满足:
   - 传入 `getters: { count: (s) => s.items.length, ... }`,推出 `G = { count: number; hasCoupon: boolean; summary: string }`;
   - 传入 `actions: { addItem(this: CartState, item: string) {...}, ... }`,推出 `A = { addItem: string; ...; clear: void }`;
   - `s` 的类型、`this` 的类型都来自 S(state 工厂的返回值);访问不存在的字段要编译报错(测试有反例)。
   - **核心技巧**:映射类型反向推导(reverse mapped type)—— 参数里写 `{ [K in keyof G]: (state: S) => G[K] }` 这样的镜像映射,TS 能从传入的函数对象**反着推出 G**。这是 Pinia / Vue 类型工程的地基。
   - 提示:当前编译器支持通过类型别名和 options 接口保留镜像反向推导；内联只是便于观察，不是硬性要求。
6. 运行时实现:
   - getters 用 `Object.defineProperty` 做成"每次访问重算"(模拟响应式);
   - actions 包装一层,`fn.call(state, payload)` 把 state 绑到 this;
   - 动态键循环(`Object.keys`)处允许 `as`,带 `// TODO(reason)` 注释(和 Day 11 呼应:动态键场景类型系统无能为力)。

---

## 验收清单

- [ ] `pnpm check:day 12` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 零 `any`;动态键循环处至多两次 `as`,各带 `// TODO(reason)`
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] getters / actions 的类型**全部自动推导**,不需要手动标泛型(测试直接 `defineStore({...})`)
- [ ] getter 的 `s`、action 的 `this` 类型来自 state;访问不存在字段编译报错
- [ ] 实例 actions 只剩 payload 参数;`clear()` 可无参调用但 `clear('x')` 报错
- [ ] action 修改 state 后,getter 再访问反映新值(defineProperty 惰性求值)

## 写完后

贴 `src/day12/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 10 分钟 → Part 2 20 分钟 → Part 3 45 分钟(镜像映射是今天主角;想 10 分钟没头绪就来要提示)。

---

[上一题：Day 11](../day11/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 13](../day13/README.md)
