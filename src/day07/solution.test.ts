import { describe, it, expect, expectTypeOf } from 'vitest'
import { toEditForm, applyEdit } from './solution.js'
import type {
  ChipMeta,
  MyPartial,
  MyRequired,
  MyReadonly,
  MyPick,
  MyOmit,
  EditPatch,
} from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const sampleChip: ChipMeta = {
  id: 'chip_1',
  name: 'formatter',
  ownerEmail: 'dev@chip.cn',
  createdAt: '2026-09-01T08:00:00Z',
  description: '格式化输出',
}

const bareChip: ChipMeta = {
  id: 'chip_2',
  name: 'uploader',
  ownerEmail: 'ops@chip.cn',
  createdAt: '2026-09-02T09:00:00Z',
}

// =============================================================
// Part 1 — 形状 + MyPartial / MyRequired
// =============================================================

describe('Day 7 — Part 1 类型形状与可选/必填', () => {
  it('ChipMeta 形状正确(含 readonly 和可选字段)', () => {
    expectTypeOf<ChipMeta>().toEqualTypeOf<{
      id: string
      name: string
      ownerEmail: string
      readonly createdAt: string
      description?: string
    }>()
  })

  it('MyPartial 与内置 Partial 对等(含修饰符)', () => {
    expectTypeOf<MyPartial<ChipMeta>>().toEqualTypeOf<Partial<ChipMeta>>()
    expectTypeOf<MyPartial<{ a: string }>>().toEqualTypeOf<{ a?: string }>()
  })

  it('MyRequired 移除可选(并把 undefined 从联合里赶走)', () => {
    expectTypeOf<MyRequired<Partial<ChipMeta>>>().toEqualTypeOf<Required<Partial<ChipMeta>>>()
    expectTypeOf<MyRequired<{ title?: string }>>().toEqualTypeOf<{ title: string }>()
  })

  it('exactOptionalPropertyTypes:可选属性不接受显式 undefined', () => {
    // @ts-expect-error —— description?: string 不允许显式传 undefined
    const badPatch: MyPartial<ChipMeta> = { description: undefined }
    void badPatch
  })
})

// =============================================================
// Part 2 — MyReadonly / MyPick / MyOmit(修饰符保留)
// =============================================================

describe('Day 7 — Part 2 只读与投影', () => {
  it('MyReadonly 与内置 Readonly 对等', () => {
    expectTypeOf<MyReadonly<ChipMeta>>().toEqualTypeOf<Readonly<ChipMeta>>()
  })

  it('readonly 真的挡写入(类型层拦住,运行时拦不住 —— 也是一课)', () => {
    const frozen: MyReadonly<ChipMeta> = { ...sampleChip }
    // @ts-expect-error —— readonly 属性不能写
    frozen.name = '改名'
    expect(frozen.name).toBe('改名')
  })

  it('MyPick 与内置 Pick 对等,且保留 readonly 修饰符(同态映射)', () => {
    expectTypeOf<MyPick<ChipMeta, 'id' | 'createdAt'>>().toEqualTypeOf<
      Pick<ChipMeta, 'id' | 'createdAt'>
    >()
    expectTypeOf<MyPick<ChipMeta, 'id' | 'createdAt'>>().toEqualTypeOf<{
      id: string
      readonly createdAt: string
    }>()
  })

  it('MyPick 保留可选语义', () => {
    expectTypeOf<MyPick<ChipMeta, 'description'>>().toEqualTypeOf<{ description?: string }>()
  })

  it('MyOmit 与内置 Omit 对等(推荐组合:MyPick + Exclude)', () => {
    expectTypeOf<MyOmit<ChipMeta, 'ownerEmail'>>().toEqualTypeOf<Omit<ChipMeta, 'ownerEmail'>>()
  })

  it('组合版 MyOmit 保留可选语义(直接映射 { [P in Exclude<...>]: T[P] } 才会丢 ?)', () => {
    expectTypeOf<MyOmit<ChipMeta, 'id' | 'name' | 'ownerEmail' | 'createdAt'>>().toEqualTypeOf<{
      description?: string
    }>()
  })
})

// =============================================================
// Part 3 — EditPatch 组合 + 运行时
// =============================================================

describe('Day 7 — Part 3 EditPatch / toEditForm / applyEdit', () => {
  it('EditPatch = 部分可选 + 无系统字段', () => {
    expectTypeOf<EditPatch>().toEqualTypeOf<Partial<Omit<ChipMeta, 'id' | 'createdAt'>>>()
  })

  it('toEditForm:带 description 的 chip', () => {
    const form = toEditForm(sampleChip)
    expect(form).toEqual({ name: 'formatter', ownerEmail: 'dev@chip.cn', description: '格式化输出' })
    expectTypeOf(form).toEqualTypeOf<EditPatch>()
  })

  it('toEditForm:没有 description 时,键不存在而不是 undefined', () => {
    const form = toEditForm(bareChip)
    expect(form).toEqual({ name: 'uploader', ownerEmail: 'ops@chip.cn' })
    expect('description' in form).toBe(false)
  })

  it('applyEdit:patch 覆盖,其余保留', () => {
    const next = applyEdit(sampleChip, { name: '新名字' })
    expect(next).toEqual({ ...sampleChip, name: '新名字' })
    expectTypeOf(next).toEqualTypeOf<ChipMeta>()
  })

  it('applyEdit:空 patch 返回等值新对象,description 不丢', () => {
    const next = applyEdit(bareChip, {})
    expect(next).toEqual(bareChip)
    expect(next.description).toBeUndefined()
  })

  it('applyEdit 可以清空 description(显式传空串)但不接受 undefined', () => {
    const next = applyEdit(sampleChip, { description: '' })
    expect(next.description).toBe('')
    // @ts-expect-error —— exactOptionalPropertyTypes:不能显式传 undefined
    applyEdit(sampleChip, { description: undefined })
  })

  it('applyEdit 的 patch 不接受系统字段', () => {
    // @ts-expect-error —— id 不在 EditPatch 里
    applyEdit(sampleChip, { id: 'hack' })
    // @ts-expect-error —— createdAt 也不在(而且它本来就 readonly)
    applyEdit(sampleChip, { createdAt: '2020-01-01T00:00:00Z' })
  })
})
