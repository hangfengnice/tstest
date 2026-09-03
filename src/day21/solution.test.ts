import { describe, it, expect, expectTypeOf } from 'vitest'
import { toRefsOwn } from './solution.js'
import type {
  UserProfile,
  ServerOrder,
  MyPartial,
  MyReadonly,
  Mutable,
  RequiredAll,
  Refs,
  OmitOwn,
  RenameKeys,
} from './solution.js'

// =============================================================
// 🟢 Part 1 — MyPartial / MyReadonly
// =============================================================

describe('Day 21 — 🟢 MyPartial(自实现 Partial)', () => {
  it('所有字段变可选', () => {
    expectTypeOf<MyPartial<{ name: string; age: number }>>().toEqualTypeOf<{
      name?: string | undefined
      age?: number | undefined
    }>()
  })

  it('与内置 Partial 完全相等', () => {
    expectTypeOf<MyPartial<UserProfile>>().toEqualTypeOf<Partial<UserProfile>>()
  })

  it('可选字段 + | undefined:显式传 undefined 也合法(exactOptionalPropertyTypes 下)', () => {
    const draft: MyPartial<UserProfile> = { name: undefined }
    void draft
  })
})

describe('Day 21 — 🟢 MyReadonly(自实现 Readonly)', () => {
  it('所有字段加 readonly', () => {
    expectTypeOf<MyReadonly<{ name: string }>>().toEqualTypeOf<{
      readonly name: string
    }>()
  })

  it('与内置 Readonly 完全相等', () => {
    expectTypeOf<MyReadonly<UserProfile>>().toEqualTypeOf<Readonly<UserProfile>>()
  })

  it('readonly 属性赋值必须编译报错(只读性是可验证的)', () => {
    const frozen: MyReadonly<UserProfile> = { id: 'u1', name: '张三', age: 30 }
    // @ts-expect-error —— readonly 属性不可重新赋值(实现后此处报错)
    frozen.name = '李四'
    void frozen
  })
})

// =============================================================
// 🟡 Part 2 — Mutable / RequiredAll / Refs
// =============================================================

describe('Day 21 — 🟡 Mutable(-readonly 解除只读)', () => {
  it('MyReadonly 之后 Mutable,回到可写原形状', () => {
    expectTypeOf<Mutable<MyReadonly<UserProfile>>>().toEqualTypeOf<UserProfile>()
  })

  it('对内置 Readonly 同样成立', () => {
    expectTypeOf<Mutable<Readonly<{ a: 1 }>>>().toEqualTypeOf<{ a: 1 }>()
  })

  it('解冻后可以赋值(与 MyReadonly 测试互为镜像)', () => {
    const editable: Mutable<MyReadonly<UserProfile>> = {
      id: 'u1',
      name: '张三',
      age: 30,
    }
    editable.name = '李四' // 解冻后合法,不报错
    expect(editable.name).toBe('李四')
  })
})

describe('Day 21 — 🟡 RequiredAll(-? 全必填)', () => {
  it('可选字段全部变必填,且 undefined 被减掉', () => {
    expectTypeOf<RequiredAll<Partial<{ name: string; age: number }>>>().toEqualTypeOf<{
      name: string
      age: number
    }>()
  })

  it('与内置 Required 相等', () => {
    expectTypeOf<RequiredAll<Partial<UserProfile>>>().toEqualTypeOf<
      Required<Partial<UserProfile>>
    >()
  })

  it('缺字段必须编译报错(email 被减成必填)', () => {
    // @ts-expect-error —— email 是 UserProfile 的可选字段,-? 后必填,缺它必须报错
    const bad: RequiredAll<UserProfile> = { id: 'u1', name: '张三', age: 30 }
    void bad
  })
})

describe('Day 21 — 🟡 Refs(值包装成 Ref 形状)', () => {
  it('每个属性变成 { value }', () => {
    expectTypeOf<Refs<{ count: number; name: string }>>().toEqualTypeOf<{
      count: { value: number }
      name: { value: string }
    }>()
  })

  it('字面量类型原样保留', () => {
    expectTypeOf<Refs<{ tag: 'a' | 'b' }>>().toEqualTypeOf<{
      tag: { value: 'a' | 'b' }
    }>()
  })
})

// =============================================================
// 🔴 Part 3 — OmitOwn / RenameKeys / toRefsOwn
// =============================================================

describe('Day 21 — 🔴 OmitOwn(as never 剔键)', () => {
  it('剔除指定键', () => {
    expectTypeOf<OmitOwn<UserProfile, 'id'>>().toEqualTypeOf<{
      name: string
      age: number
      email?: string
    }>()
  })

  it('与内置 Omit 完全相等', () => {
    expectTypeOf<OmitOwn<UserProfile, 'id'>>().toEqualTypeOf<Omit<UserProfile, 'id'>>()
  })

  it('传不存在的键必须编译报错(约束拦截)', () => {
    // @ts-expect-error —— 'foo' 不是 UserProfile 的键
    type Bad = OmitOwn<UserProfile, 'foo'>
    const probe: Bad[] = []
    void probe
  })
})

describe('Day 21 — 🔴 RenameKeys(as 改键名)', () => {
  it('映射表里的键被改名,没在表里的保持原名', () => {
    expectTypeOf<
      RenameKeys<{ desc: string; amount: number }, { desc: 'description' }>
    >().toEqualTypeOf<{ description: string; amount: number }>()
  })

  it('对后端订单做全称化(readonly 修饰符随键一起保留)', () => {
    expectTypeOf<
      RenameKeys<ServerOrder, { desc: 'description'; amt: 'amount' }>
    >().toEqualTypeOf<{
      readonly description: string
      readonly amount: number
      note: string
    }>()
  })
})

describe('Day 21 — 🔴 toRefsOwn(运行时 + 类型双实现)', () => {
  it('返回类型:每个属性都是 { value }', () => {
    const refs = toRefsOwn({ count: 1, name: 'chip' })
    expectTypeOf(refs).toEqualTypeOf<{
      count: { value: number }
      name: { value: string }
    }>()
  })

  it('运行时:属性包成 { value },读值正确', () => {
    const refs = toRefsOwn({ count: 1, name: 'chip' })
    expect(refs.count.value).toBe(1)
    expect(refs.name.value).toBe('chip')
  })

  it('运行时:不共享原对象引用(改 value 不影响原对象)', () => {
    const original = { count: 1 }
    const refs = toRefsOwn(original)
    refs.count.value = 99
    expect(original.count).toBe(1)
    expect(refs.count.value).toBe(99)
  })
})
