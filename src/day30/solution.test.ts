// Day 30 判卷测试 —— 快问快答的客观题部分:
// Q1-Q12 / Q14 用 expectTypeOf 判类型答案,Q13 另有运行时断言。
// "解释"注释是人工判卷项,测试不管。
// 骨架是 never 占位:类型断言全红、Q13 运行时 throw TODO —— 预期的红。
import { describe, it, expect, expectTypeOf } from 'vitest'
import { isNumberList } from './solution.js'
import type {
  Q1,
  Q2,
  Q3,
  Q4,
  Q6,
  Q7,
  Q10,
  Q11,
  Q12,
  Q14,
  Unwrap,
  MyPartial,
  Greet,
} from './solution.js'

// =============================================================
// 🟢 快问快答
// =============================================================

describe('Day 30 — 🟢 Q1-Q4', () => {
  it('Q1:判别联合收窄后访问分支字段,能编译(true)', () => {
    expectTypeOf<Q1>().toEqualTypeOf<true>()
  })

  it('Q2:宽 string 判别符让 never 穷尽检查失效(false)', () => {
    expectTypeOf<Q2>().toEqualTypeOf<false>()
  })

  it('Q3:违反泛型约束编译不过(false)', () => {
    expectTypeOf<Q3>().toEqualTypeOf<false>()
  })

  it('Q4:todoList 匹配 `${string}List` → 1', () => {
    expectTypeOf<Q4>().toEqualTypeOf<1>()
  })
})

// =============================================================
// 🟡 判断 + 动手
// =============================================================

describe('Day 30 — 🟡 Q5-Q8', () => {
  it('Q5:Unwrap 挖一层 Promise', () => {
    expectTypeOf<Unwrap<Promise<number>>>().toEqualTypeOf<number>()
    expectTypeOf<Unwrap<Promise<Promise<string>>>>().toEqualTypeOf<Promise<string>>()
    expectTypeOf<Unwrap<string>>().toEqualTypeOf<never>()
  })

  it('Q6:unknown 上访问属性会编译报错(true)', () => {
    expectTypeOf<Q6>().toEqualTypeOf<true>()
  })

  it('Q7:any 上链式调用不报错(false)', () => {
    expectTypeOf<Q7>().toEqualTypeOf<false>()
  })

  it('Q8:MyPartial 可选化所有属性(两个实例化都验)', () => {
    expectTypeOf<MyPartial<{ id: string; done: boolean }>>().toEqualTypeOf<{
      id?: string
      done?: boolean
    }>()
    expectTypeOf<MyPartial<{ a: number }>>().toEqualTypeOf<{ a?: number }>()
  })
})

// =============================================================
// 🔴 边界
// =============================================================

describe('Day 30 — 🔴 Q9-Q14', () => {
  it('Q9:Greet 模板字面量拼接', () => {
    expectTypeOf<Greet<'todo'>>().toEqualTypeOf<'hello-todo'>()
    expectTypeOf<Greet<'day30'>>().toEqualTypeOf<'hello-day30'>()
  })

  it('Q10:keyof 交叉 = 键的并集', () => {
    expectTypeOf<Q10>().toEqualTypeOf<'a' | 'b' | 'c'>()
  })

  it('Q11:as const + satisfies 保留字面量窄化(true)', () => {
    expectTypeOf<Q11>().toEqualTypeOf<true>()
  })

  it('Q12:as const 得到 readonly 元组', () => {
    expectTypeOf<Q12>().toEqualTypeOf<readonly ['a', 'b']>()
  })

  it('Q13:isNumberList 运行时判定', () => {
    expect(isNumberList([])).toBe(true)
    expect(isNumberList([1, 2, 3])).toBe(true)
    expect(isNumberList([1, '2'])).toBe(false)
    expect(isNumberList('x')).toBe(false)
    expect(isNumberList([1, null])).toBe(false)
    expect(isNumberList([[1]])).toBe(false)
    expect(isNumberList({})).toBe(false)
    expect(isNumberList(null)).toBe(false)
  })

  it('Q13:守卫触发 narrowing(unknown 收敛为 number[])', () => {
    const v: unknown = [1, 2]
    expect(isNumberList(v)).toBe(true)
    if (isNumberList(v)) {
      expectTypeOf(v).toEqualTypeOf<number[]>()
    }
  })

  it('Q14:Omit 作用于联合不做分发,剩不下东西(false)', () => {
    expectTypeOf<Q14>().toEqualTypeOf<false>()
  })
})
