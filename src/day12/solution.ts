/**
 * Day 12 — 迷你 Store:state / getters / actions 的类型推导(纯 TS 模拟 Pinia)
 *
 * 学习目标:
 *   1. StateFactory / GetterFn:先热身两个小泛型
 *   2. StoreInstance<S, G, A>:实例形状 —— A 的语义是"action 名 → payload 类型"
 *   3. 🔴 defineStore 的签名(从测试反推):映射类型反向推导(reverse mapped type)
 *      —— Pinia 类型工程的核心技巧:用镜像映射让"选项对象 ↔ 推断结果"互推
 *   4. this 参数:action 里的 this 从哪来(this: S + call 绑定)
 *
 * 规则:
 *   - 不允许 any;动态键循环处允许 as,必须带 // TODO(reason) 注释
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 1 — 基础:两个小泛型 + 业务状态
// =============================================================

/**
 * 状态工厂 —— 为什么 state 是函数不是对象:避免多个 store 实例共享同一个引用
 * (Pinia 的 state: () => ({ ... }) 同款原因)。
 *
 * @example
 *   const f: StateFactory<CartState> = () => ({ items: [], coupon: null })
 */
export type StateFactory<S> = S & never // ← 替换(占位结果就是 never;& never 只是为了先"用掉"泛型参数)

/**
 * getter 函数 —— 输入 state,输出派生值。
 *
 * @example
 *   const g: GetterFn<CartState, number> = (s) => s.items.length
 */
export type GetterFn<S, R> = ((state: S) => R) & never // ← 替换(占位结果就是 never)

/**
 * 购物车状态(测试用的具体业务):items 是商品名列表,
 * coupon 是优惠券码,没有时是 null(注意是 null 不是 undefined —— 想想为什么)。
 *
 * @example
 *   const s: CartState = { items: ['芯片A'], coupon: 'SALE10' }
 */
export interface CartState {
  items: never // ← 替换
  coupon: never // ← 替换
}

// =============================================================
// Part 2 — StoreInstance:实例形状
// =============================================================

/**
 * store 实例的形状(state / getters / actions 三块)。
 *
 * 关键理解:A 的语义是"action 名 → payload 类型",
 * 实例上的 actions 是**绑定好 state 的调用器**,只剩 payload 参数:
 *   type A = { addItem: string; clear: void }
 *   // void 表示 clear 无参数(调用时可省略 —— void 在参数位的独有待遇)
 *
 * getters 在实例上是"求值结果"而不是函数 —— 为什么?
 *
 * @example
 *   const inst: StoreInstance<CartState, { count: number }, { addItem: string }> = {
 *     state: { items: [], coupon: null },
 *     getters: { count: 0 },
 *     actions: { addItem: (p) => {} },
 *   }
 */
export interface StoreInstance<S, G, A> {
  state: S & never // ← 替换(占位结果就是 never)
  getters: G & never // ← 替换
  actions: A & never // ← 替换
}

// =============================================================
// Part 3 — defineStore(签名从测试反推)
// =============================================================

/**
 * 创建迷你 store。**占位签名是错的**,从 solution.test.ts 反推。
 *
 * 反推线索:
 *   1. 传入的 getters 是"函数对象",实例上的 getters 是"求值结果"
 *      —— 泛型 G 推的是结果,参数里需要一层镜像映射让 TS 反向推导
 *   2. 传入的 actions 是 (this: state, payload) => void 的函数对象,
 *      泛型 A 推的是"payload 映射",实例上只剩 payload 参数
 *   3. 推导出来的 S 同时服务于 getters 的参数和 actions 的 this
 *
 * 运行时提示:
 *   - getters 用 Object.defineProperty 做成"每次访问重算"(模拟响应式)
 *   - actions 调用时用 .call(state, payload) 把 state 绑到 this
 *
 * @example
 *   const cart = defineStore({
 *     state: () => ({ items: [], coupon: null }),
 *     getters: { count: (s) => s.items.length },
 *     actions: {
 *       addItem(this: CartState, item: string) { this.items.push(item) },
 *     },
 *   })
 *   cart.actions.addItem('芯片A')
 *   cart.getters.count // => 1
 */
export function defineStore(options: never): never {
  // TODO: 签名自己设计(测试就是规格)
  // 提示:泛型 <S, G, A> + 参数内联镜像映射 + 返回 StoreInstance<S, G, A>
  void options
  throw new Error('TODO')
}
