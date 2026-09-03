import { describe, it, expect, expectTypeOf } from 'vitest'
import { tail } from './solution.js'
import type {
  OrderStatus,
  FilterValue,
  TypeName,
  DropEmpty,
  ExcludeOwn,
  Tail,
  StatusBadge,
  IsText,
  GetEndpoint,
} from './solution.js'

// =============================================================
// 🟢 Part 1 — TypeName / DropEmpty(分布式初体验)
// =============================================================

describe('Day 20 — 🟢 TypeName(联合逐成员打标签)', () => {
  it('五个成员各自拿到自己的标签(分布式的直接证据)', () => {
    expectTypeOf<TypeName<FilterValue>>().toEqualTypeOf<
      'string' | 'number' | 'boolean' | 'null' | 'undefined'
    >()
  })

  it('两个成员的联合拿到两个标签,而不是一个', () => {
    // 如果条件类型不分布,('a' | 1) extends string 整体不成立,只会得到 'number'
    expectTypeOf<TypeName<'a' | 1>>().toEqualTypeOf<'string' | 'number'>()
  })

  it('单个类型只拿到一个标签', () => {
    expectTypeOf<TypeName<string>>().toEqualTypeOf<'string'>()
  })

  it('边界:TypeName<never> = never(空联合直接短路)', () => {
    // Day 19 埋的伏笔在这里兑现:never 是空联合,分布式条件类型对它返回 never
    // 骨架态(never & T)时这条天然通过,实现后它验证空联合特判
    expectTypeOf<TypeName<never>>().toEqualTypeOf<never>()
  })
})

describe('Day 20 — 🟢 DropEmpty(自实现 NonNullable)', () => {
  it('剔除 null 和 undefined', () => {
    expectTypeOf<DropEmpty<string | null | undefined>>().toEqualTypeOf<string>()
  })

  it('对 FilterValue 剔除后剩三种', () => {
    expectTypeOf<DropEmpty<FilterValue>>().toEqualTypeOf<string | number | boolean>()
  })
})

// =============================================================
// 🟡 Part 2 — ExcludeOwn / Tail / StatusBadge
// =============================================================

describe('Day 20 — 🟡 ExcludeOwn(自实现 Exclude)', () => {
  it('从联合中剔除成员', () => {
    expectTypeOf<
      ExcludeOwn<'view' | 'edit' | 'delete', 'edit' | 'delete'>
    >().toEqualTypeOf<'view'>()
  })

  it('对订单状态剔除 cancelled,剩四个', () => {
    expectTypeOf<ExcludeOwn<OrderStatus, 'cancelled'>>().toEqualTypeOf<
      'pending' | 'paid' | 'shipped' | 'completed'
    >()
  })
})

describe('Day 20 — 🟡 Tail(元组去头)', () => {
  it('三个元素去头剩两个', () => {
    expectTypeOf<Tail<[1, 2, 3]>>().toEqualTypeOf<[2, 3]>()
  })

  it('单元素元组去头成空元组', () => {
    expectTypeOf<Tail<['a']>>().toEqualTypeOf<[]>()
  })

  it('空元组去头还是空元组', () => {
    expectTypeOf<Tail<[]>>().toEqualTypeOf<[]>()
  })

  it('普通数组(非元组)走 else 分支,得到空元组', () => {
    expectTypeOf<Tail<string[]>>().toEqualTypeOf<[]>()
  })

  it('readonly 元组也能进(模式里的 readonly 要写对位置)', () => {
    expectTypeOf<Tail<readonly ['a', 'b']>>().toEqualTypeOf<['b']>()
  })

  it('非数组类型必须编译报错(约束拦截)', () => {
    // @ts-expect-error —— number 不满足约束 readonly unknown[]
    type BadTail = Tail<number>
    const probe: BadTail[] = []
    void probe
  })

  it('运行时:tail 去头,空数组不报错', () => {
    expect(tail([1, 2, 3])).toEqual([2, 3])
    expect(tail(['a'])).toEqual([])
    expect(tail([])).toEqual([])
  })
})

describe('Day 20 — 🟡 StatusBadge(联合批量变对象联合)', () => {
  it('每个状态成员各生成一个徽章对象', () => {
    expectTypeOf<StatusBadge<'pending' | 'paid'>>().toEqualTypeOf<
      { status: 'pending' } | { status: 'paid' }
    >()
  })

  it('对完整 OrderStatus 同样成立(五个对象的联合)', () => {
    expectTypeOf<StatusBadge<OrderStatus>>().toEqualTypeOf<
      | { status: 'pending' }
      | { status: 'paid' }
      | { status: 'shipped' }
      | { status: 'completed' }
      | { status: 'cancelled' }
    >()
  })
})

// =============================================================
// 🔴 Part 3 — IsText / GetEndpoint
// =============================================================

describe('Day 20 — 🔴 IsText(阻止分布,整体判断)', () => {
  it('string 整体是文本', () => {
    expectTypeOf<IsText<string>>().toEqualTypeOf<true>()
  })

  it('全是字符串字面量的联合也是文本(整体可赋给 string)', () => {
    expectTypeOf<IsText<'a' | 'b'>>().toEqualTypeOf<true>()
  })

  it('分水岭:混入 number 必须是 false(裸参数版会得到 boolean)', () => {
    // 如果你的实现这里得到 boolean,说明分布式在"正确地工作" —— 你需要 [T] 让它别工作
    expectTypeOf<IsText<'a' | 1>>().toEqualTypeOf<false>()
  })

  it('边界:IsText<never> = true(空联合包进元组后就是普通类型)', () => {
    // 对照:裸参数版对 never 会短路返回 never;[never] extends [string] 成立
    // 骨架态(never & T)时这条天然通过,实现后它验证 [] 的行为
    expectTypeOf<IsText<never>>().toEqualTypeOf<true>()
  })
})

describe('Day 20 — 🔴 GetEndpoint(模板字面量的天生分布式)', () => {
  it('资源名联合 → 端点联合', () => {
    expectTypeOf<GetEndpoint<'user' | 'order'>>().toEqualTypeOf<
      '/api/user' | '/api/order'
    >()
  })

  it('单个资源名 → 单个端点', () => {
    expectTypeOf<GetEndpoint<'user'>>().toEqualTypeOf<'/api/user'>()
  })

  it('非字符串必须编译报错(约束拦截)', () => {
    // @ts-expect-error —— 123 不满足约束 string
    type BadEndpoint = GetEndpoint<123>
    const probe: BadEndpoint[] = []
    void probe
  })
})
