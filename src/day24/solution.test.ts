import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  PERMISSIONS,
  firstOf,
  lengthOf,
  concatTuples,
  hasPermission,
  unwrapAll,
  type First,
  type Length,
  type TupleToUnion,
  type Concat,
  type Awaited,
  type Permission,
} from './solution.js'

// 表单字段顺序 —— as const 元组,类型信息完整
const FORM_FIELDS = ['title', 'content', 'tags'] as const

// =============================================================
// Part 1 — 🟢 First / Length
// =============================================================

describe('Day 24 — Part 1 First / Length', () => {
  it('First<T> 取元组首元素的字面量类型', () => {
    expectTypeOf<First<typeof FORM_FIELDS>>().toEqualTypeOf<'title'>()
    expectTypeOf<First<[number, string]>>().toEqualTypeOf<number>()
  })

  it('First<[]> 是 never:空元组没有首元素', () => {
    expectTypeOf<First<[]>>().toEqualTypeOf<never>()
  })

  it('Length<T> 是数字字面量,不是宽 number', () => {
    expectTypeOf<Length<typeof FORM_FIELDS>>().toEqualTypeOf<3>()
    expectTypeOf<Length<['a']>>().toEqualTypeOf<1>()
    // 非元组退化:普通数组的 length 是 number
    expectTypeOf<Length<string[]>>().toEqualTypeOf<number>()
  })

  it('firstOf 运行时取第一个,类型同步正确', () => {
    expect(firstOf(FORM_FIELDS)).toBe('title')
    expectTypeOf(firstOf(FORM_FIELDS)).toEqualTypeOf<'title'>()
  })

  it('lengthOf 运行时返回长度,类型是字面量 3', () => {
    expect(lengthOf(FORM_FIELDS)).toBe(3)
    expectTypeOf(lengthOf(FORM_FIELDS)).toEqualTypeOf<3>()
  })
})

// =============================================================
// Part 2 — 🟡 TupleToUnion / Concat / Permission
// =============================================================

describe('Day 24 — Part 2 TupleToUnion / Concat', () => {
  it('TupleToUnion:元组转联合', () => {
    expectTypeOf<TupleToUnion<['a', 'b', 'c']>>().toEqualTypeOf<
      'a' | 'b' | 'c'
    >()
    // 非元组退化:元素类型的联合就是它自己
    expectTypeOf<TupleToUnion<string[]>>().toEqualTypeOf<string>()
  })

  it('Permission 从权限表推导,单一事实来源', () => {
    expectTypeOf<Permission>().toEqualTypeOf<
      'conversation:read' | 'conversation:write' | 'admin:panel'
    >()
  })

  it('hasPermission:合法权限返回 true', () => {
    expect(hasPermission('conversation:read')).toBe(true)
    expect(hasPermission('admin:panel')).toBe(true)
  })

  it('权限表外的名字编译期被拒绝', () => {
    // @ts-expect-error —— 'conversation:delete' 不在 PERMISSIONS 推导出的联合里
    hasPermission('conversation:delete')
  })

  it('Concat 拼接元组,精确到每个元素', () => {
    expectTypeOf<
      Concat<readonly ['src'], readonly ['components', 'App.vue']>
    >().toEqualTypeOf<readonly ['src', 'components', 'App.vue']>()
    expectTypeOf<Concat<[], [1, 2]>>().toEqualTypeOf<readonly [1, 2]>()
  })

  it('concatTuples 运行时拼接面包屑,类型同步正确', () => {
    const trail = concatTuples(
      ['src', 'components'] as const,
      ['App.vue'] as const,
    )
    expect(trail).toEqual(['src', 'components', 'App.vue'])
    expectTypeOf(trail).toEqualTypeOf<
      readonly ['src', 'components', 'App.vue']
    >()
  })
})

// =============================================================
// Part 3 — 🔴 Awaited / unwrapAll
// =============================================================

describe('Day 24 — Part 3 Awaited', () => {
  it('单层 Promise 解包', () => {
    expectTypeOf<Awaited<Promise<number>>>().toEqualTypeOf<number>()
  })

  it('嵌套 Promise 递归解包到最终值', () => {
    expectTypeOf<
      Awaited<Promise<Promise<Promise<number>>>>
    >().toEqualTypeOf<number>()
  })

  it('联合类型自动分发', () => {
    expectTypeOf<Awaited<Promise<string> | number>>().toEqualTypeOf<
      string | number
    >()
  })

  it('非 Promise 原样透传', () => {
    expectTypeOf<Awaited<null>>().toEqualTypeOf<null>()
    expectTypeOf<Awaited<'plain'>>().toEqualTypeOf<'plain'>()
  })

  it('unwrapAll 运行时:嵌套 Promise 解到最终值', async () => {
    const value = await unwrapAll(Promise.resolve(Promise.resolve('chip')))
    expect(value).toBe('chip')
    expectTypeOf(value).toEqualTypeOf<string>()
  })

  it('unwrapAll 运行时:非 Promise 输入透传', async () => {
    const value = await unwrapAll(42)
    expect(value).toBe(42)
    expectTypeOf(value).toEqualTypeOf<number>()
  })

  it('PERMISSIONS 常量本身保持 readonly 字面量', () => {
    expect(PERMISSIONS).toHaveLength(3)
    expect(PERMISSIONS[0]).toBe('conversation:read')
    // @ts-expect-error —— readonly 元组不能 push
    PERMISSIONS.push('x')
  })
})
