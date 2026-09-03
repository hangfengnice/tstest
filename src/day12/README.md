# Day 12 — 迷你 Store:state / getters / actions 的类型推导

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
   - 提示:映射类型要**直接内联在参数类型里**,不要先定义成接口再引用(隔一层推导就失效)。
6. 运行时实现:
   - getters 用 `Object.defineProperty` 做成"每次访问重算"(模拟响应式);
   - actions 包装一层,`fn.call(state, payload)` 把 state 绑到 this;
   - 动态键循环(`Object.keys`)处允许 `as`,带 `// TODO(reason)` 注释(和 Day 11 呼应:动态键场景类型系统无能为力)。

---

## 验收清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] 零 `any`;动态键循环处至多两次 `as`,各带 `// TODO(reason)`
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] getters / actions 的类型**全部自动推导**,不需要手动标泛型(测试直接 `defineStore({...})`)
- [ ] getter 的 `s`、action 的 `this` 类型来自 state;访问不存在字段编译报错
- [ ] 实例 actions 只剩 payload 参数;`clear()` 可无参调用但 `clear('x')` 报错
- [ ] action 修改 state 后,getter 再访问反映新值(defineProperty 惰性求值)

## 写完后

贴 `src/day12/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 10 分钟 → Part 2 20 分钟 → Part 3 45 分钟(镜像映射是今天主角;想 10 分钟没头绪就来要提示)。
