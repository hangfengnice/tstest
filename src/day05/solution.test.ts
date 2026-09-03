import { describe, it, expect, expectTypeOf } from 'vitest'
import { firstOf, getValue, pick, updateAt, pluck } from './solution.js'
import type { ConversationSummary } from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const convA: ConversationSummary = {
  id: 'c1',
  title: '关于部署',
  messageCount: 3,
  pinned: true,
  tags: ['ci', 'deploy'],
}

const convB: ConversationSummary = {
  id: 'c2',
  title: '周报草稿',
  messageCount: 12,
  pinned: false,
  tags: [],
}

const convs: ConversationSummary[] = [convA, convB]

// =============================================================
// Part 1 — 类型形状 + firstOf + getValue
// =============================================================

describe('Day 5 — Part 1 类型形状', () => {
  it('ConversationSummary 形状正确', () => {
    expectTypeOf<ConversationSummary>().toEqualTypeOf<{
      id: string
      title: string
      messageCount: number
      pinned: boolean
      tags: string[]
    }>()
  })
})

describe('Day 5 — Part 1 firstOf', () => {
  it('取第一个元素', () => {
    expect(firstOf([1, 2, 3])).toBe(1)
    expect(firstOf(convs)).toBe(convA)
  })

  it('空数组返回 undefined,类型是 T | undefined', () => {
    const empty: number[] = []
    expect(firstOf(empty)).toBeUndefined()
    expectTypeOf(firstOf(empty)).toEqualTypeOf<number | undefined>()
    expectTypeOf(firstOf(convs)).toEqualTypeOf<ConversationSummary | undefined>()
  })
})

describe('Day 5 — Part 1 getValue', () => {
  it('返回值类型跟着键走(索引访问类型 T[K])', () => {
    expect(getValue(convA, 'title')).toBe('关于部署')
    expectTypeOf(getValue(convA, 'title')).toEqualTypeOf<string>()
    expectTypeOf(getValue(convA, 'messageCount')).toEqualTypeOf<number>()
    expectTypeOf(getValue(convA, 'pinned')).toEqualTypeOf<boolean>()
  })

  it('数组字段也拿得准', () => {
    expect(getValue(convA, 'tags')).toEqual(['ci', 'deploy'])
    expectTypeOf(getValue(convA, 'tags')).toEqualTypeOf<string[]>()
  })

  it('不存在的键编译报错', () => {
    // 用测试自己的对象测约束行为(不依赖 solution 里的类型占位)
    // @ts-expect-error —— { id: 1 } 上没有 author 字段
    getValue({ id: 1 }, 'author')
  })
})

// =============================================================
// Part 2 — pick / updateAt
// =============================================================

describe('Day 5 — Part 2 pick', () => {
  it('挑两个键,新对象只含这两个字段', () => {
    const card = pick(convA, ['id', 'title'])
    expect(card).toEqual({ id: 'c1', title: '关于部署' })
    expectTypeOf(card).toEqualTypeOf<Pick<ConversationSummary, 'id' | 'title'>>()
  })

  it('类型是精确的键值对,不是宽对象', () => {
    expectTypeOf(pick(convA, ['title', 'messageCount'])).toEqualTypeOf<{
      title: string
      messageCount: number
    }>()
  })

  it('挑不存在的键编译报错', () => {
    // @ts-expect-error —— 'author' 不在 { id, title } 上
    pick({ id: 1, title: 't' }, ['id', 'author'])
  })
})

describe('Day 5 — Part 2 updateAt', () => {
  it('返回新对象,字段已更新,类型不变', () => {
    const next = updateAt(convA, 'messageCount', 10)
    expect(next).toEqual({ ...convA, messageCount: 10 })
    expectTypeOf(next).toEqualTypeOf<ConversationSummary>()
  })

  it('原对象不被修改(不可变更新)', () => {
    updateAt(convA, 'title', '改掉的标题')
    expect(convA.title).toBe('关于部署')
    updateAt(convA, 'tags', ['new'])
    expect(convA.tags).toEqual(['ci', 'deploy'])
  })

  it('值的类型必须与键对齐', () => {
    // @ts-expect-error —— messageCount 是 number,不能传 string
    updateAt(convA, 'messageCount', '十')
    // @ts-expect-error —— pinned 是 boolean,不能传 1
    updateAt(convA, 'pinned', 1)
  })
})

// =============================================================
// Part 3 — pluck(签名反推)
// =============================================================

describe('Day 5 — Part 3 pluck(签名反推)', () => {
  it('批量取 title,得到 string[]', () => {
    expect(pluck(convs, 'title')).toEqual(['关于部署', '周报草稿'])
    expectTypeOf(pluck(convs, 'title')).toEqualTypeOf<string[]>()
  })

  it('换键换类型:pinned → boolean[],tags → string[][]', () => {
    expectTypeOf(pluck(convs, 'pinned')).toEqualTypeOf<boolean[]>()
    expectTypeOf(pluck(convs, 'tags')).toEqualTypeOf<string[][]>()
    expect(pluck(convs, 'pinned')).toEqual([true, false])
  })

  it('取不存在的键编译报错', () => {
    // @ts-expect-error —— 'author' 不在 ConversationSummary 上
    pluck(convs, 'author')
  })
})
