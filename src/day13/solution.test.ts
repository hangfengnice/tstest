import { describe, it, expect, expectTypeOf } from 'vitest'
import { resolveButtonProps, buttonDefaults } from './solution.js'
import type {
  ButtonProps,
  ButtonPropsDefaults,
  ResolveProps,
  PropDefinition,
  InferPropType,
  ExtractPropTypes,
  ExtractPublicPropTypes,
} from './solution.js'

// =============================================================
// Part 1 — Props 接口
// =============================================================

describe('Day 13 — Part 1 ButtonProps', () => {
  it('形状:必选 type/label,可选 size/disabled/loading', () => {
    expectTypeOf<ButtonProps['type']>().toEqualTypeOf<'primary' | 'ghost'>()
    expectTypeOf<ButtonProps['label']>().toEqualTypeOf<string>()
    expectTypeOf<ButtonProps['size']>().toEqualTypeOf<'sm' | 'md' | 'lg' | undefined>()
    expectTypeOf<ButtonProps['disabled']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<ButtonProps['loading']>().toEqualTypeOf<boolean | undefined>()
  })

  it('可选字段可以省略', () => {
    const p: ButtonProps = { type: 'primary', label: '保存' }
    expect(p.label).toBe('保存')
  })

  it('必选字段缺失必须编译报错', () => {
    // @ts-expect-error —— 缺 label
    const bad: ButtonProps = { type: 'primary' }
    void bad
  })

  it('字面量不在联合内必须编译报错', () => {
    // @ts-expect-error —— 'danger' 不是 ButtonProps['type']
    const bad: ButtonProps = { type: 'danger', label: 'x' }
    void bad
  })

  it('exactOptionalPropertyTypes:可选字段不能显式传 undefined', () => {
    // @ts-expect-error —— size?: 'sm'|'md'|'lg' 只允许省略,不允许显式 undefined
    const bad: ButtonProps = { type: 'primary', label: 'x', size: undefined }
    void bad
  })
})

// =============================================================
// Part 2 — 默认值对象 + ResolveProps
// =============================================================

describe('Day 13 — Part 2 默认值对象', () => {
  it('buttonDefaults 必须加 as const:值保持字面量', () => {
    expectTypeOf<ButtonPropsDefaults>().toEqualTypeOf<{
      readonly size: 'md'
      readonly disabled: false
    }>()
  })

  it('默认值对象满足 Partial<ButtonProps>', () => {
    const check: Partial<ButtonProps> = buttonDefaults
    expect(check.size).toBe('md')
  })

  it('不加 as const 的默认值对象不满足 Partial<ButtonProps>', () => {
    const loose = { size: 'md', disabled: false } // 没有 as const:size 是 string
    // @ts-expect-error —— string 不能赋给 'sm' | 'md' | 'lg'(宽化后类型对不上)
    const bad: Partial<ButtonProps> = loose
    void bad
  })
})

describe('Day 13 — Part 2 ResolveProps(可选传入 → 必有值)', () => {
  it('有默认值的字段变必选、类型保持 T[K];无默认的照旧', () => {
    type Resolved = ResolveProps<ButtonProps, ButtonPropsDefaults>
    expectTypeOf<Resolved['type']>().toEqualTypeOf<'primary' | 'ghost'>()
    expectTypeOf<Resolved['label']>().toEqualTypeOf<string>()
    expectTypeOf<Resolved['size']>().toEqualTypeOf<'sm' | 'md' | 'lg'>()
    expectTypeOf<Resolved['disabled']>().toEqualTypeOf<boolean>()
    expectTypeOf<Resolved['loading']>().toEqualTypeOf<boolean | undefined>()
  })

  it('resolveButtonProps 运行时合并默认值', () => {
    const resolved = resolveButtonProps({ type: 'primary', label: '保存' })
    expect(resolved).toEqual({ type: 'primary', label: '保存', size: 'md', disabled: false })
    expect(resolved.size).toBe('md')

    const custom = resolveButtonProps({ type: 'ghost', label: '取消', size: 'lg' })
    expect(custom).toEqual({ type: 'ghost', label: '取消', size: 'lg', disabled: false })
  })

  it('resolveButtonProps 返回类型是 ResolveProps(内部必有值)', () => {
    const resolved = resolveButtonProps({ type: 'primary', label: '保存' })
    expectTypeOf(resolved).toEqualTypeOf<
      ResolveProps<ButtonProps, ButtonPropsDefaults>
    >()
    expectTypeOf(resolved.size).toEqualTypeOf<'sm' | 'md' | 'lg'>()
  })
})

// =============================================================
// Part 3 — ExtractPropTypes / ExtractPublicPropTypes
// =============================================================

/** 模拟 Vue 的 props 运行时定义(测试数据,required 用 as const 保住字面量) */
const buttonPropDefs = {
  type: { type: (): 'primary' | 'ghost' => 'primary', required: true as const },
  label: { type: (): string => '', required: true as const },
  size: { type: (): 'sm' | 'md' | 'lg' => 'md' },
  disabled: { type: (): boolean => false },
}

describe('Day 13 — Part 3 PropDefinition / InferPropType', () => {
  it('InferPropType 从 () => T 推出 T', () => {
    expectTypeOf<
      InferPropType<{ type: () => string; required: true }>
    >().toEqualTypeOf<string>()
    expectTypeOf<
      InferPropType<{ type: () => 'sm' | 'md' | 'lg' }>
    >().toEqualTypeOf<'sm' | 'md' | 'lg'>()
  })

  it('PropDefinition 约束:default 的类型必须跟着 type 走', () => {
    // @ts-expect-error —— T 是 string,default 不能是 number
    const bad: PropDefinition<string> = { type: (): string => '', default: 42 }
    void bad
  })
})

describe('Day 13 — Part 3 ExtractPropTypes(内部视角:全部必有值)', () => {
  it('从运行时定义推导出完整 Props', () => {
    type Inner = ExtractPropTypes<typeof buttonPropDefs>
    expectTypeOf<Inner['type']>().toEqualTypeOf<'primary' | 'ghost'>()
    expectTypeOf<Inner['label']>().toEqualTypeOf<string>()
    expectTypeOf<Inner['size']>().toEqualTypeOf<'sm' | 'md' | 'lg'>()
    expectTypeOf<Inner['disabled']>().toEqualTypeOf<boolean>()
  })
})

describe('Day 13 — Part 3 ExtractPublicPropTypes(父组件视角)', () => {
  it('required 的必选,其余可选', () => {
    type Public = ExtractPublicPropTypes<typeof buttonPropDefs>
    expectTypeOf<Public['type']>().toEqualTypeOf<'primary' | 'ghost'>()
    expectTypeOf<Public['label']>().toEqualTypeOf<string>()
    expectTypeOf<Public['size']>().toEqualTypeOf<'sm' | 'md' | 'lg' | undefined>()
    expectTypeOf<Public['disabled']>().toEqualTypeOf<boolean | undefined>()
  })

  it('可选字段可以省略', () => {
    type Public = ExtractPublicPropTypes<typeof buttonPropDefs>
    const ok: Public = { type: 'primary', label: '保存' }
    expect(ok.label).toBe('保存')
  })

  it('必选字段缺失必须编译报错', () => {
    type Public = ExtractPublicPropTypes<typeof buttonPropDefs>
    // @ts-expect-error —— label 是 required,不能省
    const bad: Public = { type: 'primary' }
    void bad
  })

  it('可选字段也不能乱传', () => {
    type Public = ExtractPublicPropTypes<typeof buttonPropDefs>
    // @ts-expect-error —— 'xxl' 不在 'sm' | 'md' | 'lg' 里
    const bad: Public = { type: 'primary', label: 'x', size: 'xxl' }
    void bad
  })
})
