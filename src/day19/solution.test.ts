import { describe, it, expect, expectTypeOf } from 'vitest'
import { withCache } from './solution.js'
import type {
  User,
  Pagination,
  Paged,
  ElementOf,
  ReturnOf,
  UnwrapPromise,
  ParamsOf,
  FirstParamOf,
} from './solution.js'

// =============================================================
// 测试数据(业务类型已给出,不是考点)
// =============================================================

const userA: User = { id: 'u1', name: '张三', role: 'editor' }
const pageOne: Pagination = { page: 1, pageSize: 20, total: 1 }

// =============================================================
// 🟢 Part 1 — ElementOf
// =============================================================

describe('Day 19 — 🟢 ElementOf(数组提元素)', () => {
  it('从可变数组提出元素类型', () => {
    expectTypeOf<ElementOf<string[]>>().toEqualTypeOf<string>()
    expectTypeOf<ElementOf<User[]>>().toEqualTypeOf<User>()
  })

  it('从 readonly 数组提元素(约束必须带 readonly)', () => {
    expectTypeOf<ElementOf<readonly number[]>>().toEqualTypeOf<number>()
  })

  it('从 as const 元组提出字面量联合', () => {
    expectTypeOf<ElementOf<readonly ['a', 'b']>>().toEqualTypeOf<'a' | 'b'>()
  })

  it('非数组类型必须编译报错(约束拦截)', () => {
    // @ts-expect-error —— string 不满足约束 readonly unknown[]
    type BadElement = ElementOf<string>
    const probe: BadElement[] = []
    void probe
  })
})

// =============================================================
// 🟡 Part 2 — ReturnOf / UnwrapPromise
// =============================================================

describe('Day 19 — 🟡 ReturnOf(函数提返回值)', () => {
  it('无参函数 → 返回值', () => {
    expectTypeOf<ReturnOf<() => string>>().toEqualTypeOf<string>()
  })

  it('有参函数 → 返回值(Promise 原样保留,不剥壳)', () => {
    expectTypeOf<
      ReturnOf<(q: string) => Promise<Paged<User>>>
    >().toEqualTypeOf<Promise<Paged<User>>>()
  })

  it('职责分界:ReturnOf 看函数,UnwrapPromise 剥壳,组合后拿到解析值', () => {
    expectTypeOf<
      UnwrapPromise<ReturnOf<(q: string) => Promise<Paged<User>>>>
    >().toEqualTypeOf<Paged<User>>()
  })

  it('非函数类型必须编译报错(约束拦截)', () => {
    // @ts-expect-error —— number 不满足函数约束
    type BadReturn = ReturnOf<number>
    const probe: BadReturn[] = []
    void probe
  })
})

describe('Day 19 — 🟡 UnwrapPromise(剥一层壳)', () => {
  it('剥一层 Promise', () => {
    expectTypeOf<UnwrapPromise<Promise<User>>>().toEqualTypeOf<User>()
  })

  it('嵌套 Promise 只剥一层(非递归)', () => {
    expectTypeOf<UnwrapPromise<Promise<Promise<User>>>>().toEqualTypeOf<Promise<User>>()
  })

  it('非 Promise 原样透传,字面量不变宽', () => {
    expectTypeOf<UnwrapPromise<User>>().toEqualTypeOf<User>()
    expectTypeOf<UnwrapPromise<42>>().toEqualTypeOf<42>()
  })

  it('边界:UnwrapPromise<never> = never(原因 Day 20 揭晓)', () => {
    // never 是"空联合",条件类型对它有特判 —— 今天先把行为钉进测试,明天解释
    expectTypeOf<UnwrapPromise<never>>().toEqualTypeOf<never>()
  })
})

// =============================================================
// 🔴 Part 3 — ParamsOf / FirstParamOf
// =============================================================

describe('Day 19 — 🔴 ParamsOf(函数提参数元组)', () => {
  it('整个参数列表收成一个元组', () => {
    expectTypeOf<
      ParamsOf<(q: string, page: number) => void>
    >().toEqualTypeOf<[string, number]>()
  })

  it('无参函数 → 空元组', () => {
    expectTypeOf<ParamsOf<() => void>>().toEqualTypeOf<[]>()
  })
})

describe('Day 19 — 🔴 FirstParamOf(只取首参)', () => {
  it('有参函数 → 第一个参数的类型', () => {
    expectTypeOf<
      FirstParamOf<(q: string, page: number) => void>
    >().toEqualTypeOf<string>()
  })

  it('边界:无参函数 → unknown(把观察结论写进 JSDoc)', () => {
    // 无参函数去匹配"(first: infer F, ...rest) => ..."模式时,洞被填成了 unknown
    expectTypeOf<FirstParamOf<() => void>>().toEqualTypeOf<unknown>()
  })
})

// =============================================================
// 🔴 Part 3 — withCache(组合运用)
// =============================================================

describe('Day 19 — 🔴 withCache(签名从测试反推)', () => {
  it('返回函数的签名:参数同原函数,返回 Promise<已解析值>', () => {
    const fetchPaged = (q: string): Promise<Paged<User>> =>
      Promise.resolve({ items: [{ ...userA, name: q }], pagination: pageOne })
    const cached = withCache(fetchPaged)
    expectTypeOf(cached).toEqualTypeOf<(q: string) => Promise<Paged<User>>>()
  })

  it('同参数第二次调用命中缓存:原函数只执行一次,结果同一引用', async () => {
    let calls = 0
    const fetchPaged = (q: string): Promise<Paged<User>> => {
      calls++
      return Promise.resolve({ items: [{ ...userA, name: q }], pagination: pageOne })
    }
    const cached = withCache(fetchPaged)
    const r1 = await cached('chip')
    const r2 = await cached('chip')
    expect(calls).toBe(1)
    expect(r2).toBe(r1)
  })

  it('不同参数不共享缓存', async () => {
    let calls = 0
    const fetchPaged = (q: string): Promise<Paged<User>> => {
      calls++
      return Promise.resolve({ items: [{ ...userA, name: q }], pagination: pageOne })
    }
    const cached = withCache(fetchPaged)
    await cached('chip')
    await cached('runner')
    expect(calls).toBe(2)
  })
})
