import { describe, it, expect, expectTypeOf } from 'vitest'
import { defineStore } from './solution.js'
import type {
  StateFactory,
  GetterFn,
  CartState,
  StoreInstance,
} from './solution.js'

// =============================================================
// Part 1 — 热身泛型 + 业务状态
// =============================================================

describe('Day 12 — Part 1 热身泛型', () => {
  it('StateFactory<S> 是 () => S', () => {
    expectTypeOf<StateFactory<CartState>>().toEqualTypeOf<() => CartState>()
  })

  it('GetterFn<S, R> 是 (state: S) => R', () => {
    expectTypeOf<GetterFn<CartState, number>>().toEqualTypeOf<
      (state: CartState) => number
    >()
  })

  it('CartState:coupon 是 string | null(不是 undefined)', () => {
    expectTypeOf<CartState['coupon']>().toEqualTypeOf<string | null>()
    expectTypeOf<CartState['items']>().toEqualTypeOf<string[]>()
  })
})

// =============================================================
// Part 2+3 — defineStore(签名从测试反推)
// =============================================================

/** 测试期望推导出的 getters 结果类型 */
type CartGetters = {
  count: number
  hasCoupon: boolean
  summary: string
}

/** 测试期望推导出的 actions payload 映射(clear 用 void 表示无参数) */
type CartActionPayloads = {
  addItem: string
  removeItem: string
  applyCoupon: string
  clear: void
}

describe('Day 12 — defineStore 类型推导', () => {
  it('state / getters / actions 全部自动推导(从测试反推 defineStore 签名)', () => {
    const cart = defineStore({
      state: (): CartState => ({ items: [], coupon: null }),
      getters: {
        count: (s) => s.items.length,
        hasCoupon: (s) => s.coupon !== null,
        summary: (s) => `购物车共 ${s.items.length} 件`,
      },
      actions: {
        addItem(this: CartState, item: string) {
          this.items.push(item)
        },
        removeItem(this: CartState, item: string) {
          this.items = this.items.filter((i) => i !== item)
        },
        applyCoupon(this: CartState, code: string) {
          this.coupon = code
        },
        clear(this: CartState, _p: void) {
          this.items = []
          this.coupon = null
        },
      },
    })

    expectTypeOf(cart).toEqualTypeOf<
      StoreInstance<CartState, CartGetters, CartActionPayloads>
    >()
    expectTypeOf(cart.state).toEqualTypeOf<CartState>()
    expectTypeOf(cart.getters.count).toEqualTypeOf<number>()
    expectTypeOf(cart.getters.hasCoupon).toEqualTypeOf<boolean>()
  })

  it('getters:参数 s 的类型是 state,访问不存在字段编译报错', () => {
    defineStore({
      state: (): CartState => ({ items: [], coupon: null }),
      // @ts-expect-error —— s 上没有 nope 字段(s 的类型 = state 的类型)
      getters: { bad: (s) => s.nope },
      actions: {},
    })
  })

  it('actions:this 上访问不存在字段编译报错', () => {
    defineStore({
      state: (): CartState => ({ items: [], coupon: null }),
      getters: {},
      actions: {
        bad(this: CartState, _p: void) {
          // @ts-expect-error —— this 是 CartState,没有 nope 字段
          this.nope = 1
        },
      },
    })
  })

  it('实例上的 actions 只剩 payload 参数', () => {
    const cart = defineStore({
      state: (): CartState => ({ items: [], coupon: null }),
      getters: { count: (s) => s.items.length },
      actions: {
        addItem(this: CartState, item: string) {
          this.items.push(item)
        },
      },
    })
    expectTypeOf(cart.actions.addItem).toEqualTypeOf<(payload: string) => void>()
    // @ts-expect-error —— addItem 的 payload 是 string,不能传 number
    cart.actions.addItem(123)
  })

  it('void payload 的 action 调用时可省略参数', () => {
    const cart = defineStore({
      state: (): CartState => ({ items: [], coupon: null }),
      getters: {},
      actions: {
        clear(this: CartState, _p: void) {
          this.items = []
        },
      },
    })
    cart.actions.clear() // void 参数位:可省略
    // @ts-expect-error —— 但不能传非 undefined 的实参
    cart.actions.clear('x')
  })
})

describe('Day 12 — 运行时行为', () => {
  function makeCart() {
    return defineStore({
      state: (): CartState => ({ items: [], coupon: null }),
      getters: {
        count: (s) => s.items.length,
        hasCoupon: (s) => s.coupon !== null,
        summary: (s) => `购物车共 ${s.items.length} 件`,
      },
      actions: {
        addItem(this: CartState, item: string) {
          this.items.push(item)
        },
        removeItem(this: CartState, item: string) {
          this.items = this.items.filter((i) => i !== item)
        },
        applyCoupon(this: CartState, code: string) {
          this.coupon = code
        },
        clear(this: CartState, _p: void) {
          this.items = []
          this.coupon = null
        },
      },
    })
  }

  it('action 通过 this 修改 state', () => {
    const cart = makeCart()
    cart.actions.addItem('芯片A')
    cart.actions.addItem('芯片B')
    expect(cart.state.items).toEqual(['芯片A', '芯片B'])
  })

  it('getter 基于当前 state 求值,action 修改后自动反映', () => {
    const cart = makeCart()
    expect(cart.getters.count).toBe(0)
    expect(cart.getters.hasCoupon).toBe(false)
    expect(cart.getters.summary).toBe('购物车共 0 件')

    cart.actions.addItem('芯片A')
    cart.actions.applyCoupon('SALE10')
    expect(cart.getters.count).toBe(1)
    expect(cart.getters.hasCoupon).toBe(true)
    expect(cart.getters.summary).toBe('购物车共 1 件')
  })

  it('removeItem / clear 正常工作', () => {
    const cart = makeCart()
    cart.actions.addItem('芯片A')
    cart.actions.addItem('芯片B')
    cart.actions.removeItem('芯片A')
    expect(cart.state.items).toEqual(['芯片B'])
    cart.actions.clear()
    expect(cart.state.items).toEqual([])
    expect(cart.state.coupon).toBeNull()
  })
})
