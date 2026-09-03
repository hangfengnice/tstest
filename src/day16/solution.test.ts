import { describe, it, expect, expectTypeOf, beforeEach } from 'vitest'
import {
  getConfig,
  setConfig,
  hasConfig,
  deleteConfig,
  listKeys,
  CONFIG_VERSION,
} from './legacy-config.js'
import {
  isThemeMode,
  readThemeMode,
  readFeatureFlags,
} from './solution.js'
import type { ConfigValue } from './legacy-config.js'
import type { ChartPoint, renderBar } from 'legacy-charts'
import type {
  ThemeMode,
  FeatureFlags,
  LegacyGlobalInfo,
  RenderPieFn,
} from './solution.js'

// legacy-config.js 是真的 JS,模块级 Map 会跨用例串数据 —— 每个用例前清空
beforeEach(() => {
  for (const key of listKeys()) deleteConfig(key)
})

// =============================================================
// Part 1 — 🟢 d.ts 精确化:常量 / 基本函数
// =============================================================

describe('Day 16 — Part 1 legacy-config.d.ts 精确化', () => {
  it('CONFIG_VERSION 精确到字面量', () => {
    expectTypeOf(CONFIG_VERSION).toEqualTypeOf<'3.2.1'>()
    expect(CONFIG_VERSION).toBe('3.2.1')
  })

  it('ConfigValue 契约:string | number | boolean', () => {
    expectTypeOf<ConfigValue>().toEqualTypeOf<string | number | boolean>()
  })

  it('setConfig / hasConfig / deleteConfig / listKeys 签名', () => {
    expectTypeOf(setConfig('k', 1)).toEqualTypeOf<ConfigValue | undefined>()
    expectTypeOf(hasConfig('k')).toEqualTypeOf<boolean>()
    expectTypeOf(deleteConfig('k')).toEqualTypeOf<boolean>()
    expectTypeOf(listKeys()).toEqualTypeOf<string[]>()
  })

  it('运行时行为与 JS 实现一致(黑盒验证)', () => {
    expect(setConfig('theme', 'dark')).toBe(undefined)
    expect(setConfig('theme', 'light')).toBe('dark')
    expect(getConfig('theme', 'auto')).toBe('light')
    expect(getConfig('missing', 0)).toBe(0)
    expect(hasConfig('theme')).toBe(true)
    expect(hasConfig('missing')).toBe(false)
    expect(deleteConfig('theme')).toBe(true)
    expect(deleteConfig('theme')).toBe(false)
    setConfig('b', 1)
    setConfig('a', 2)
    expect(listKeys()).toEqual(['a', 'b'])
  })

  it('getConfig 重载:不传 fallback 是 unknown;传了是 T(保留字面量!)', () => {
    expectTypeOf(getConfig('x')).toEqualTypeOf<unknown>()
    // T extends ConfigValue 的约束会保留字面量(Day 6 的知识):'f' 不会拓宽成 string
    expectTypeOf(getConfig('x', 'f')).toEqualTypeOf<'f'>()
    expectTypeOf(getConfig('x', 42)).toEqualTypeOf<42>()
    // 想要拓宽的 string?显式传泛型参数
    expectTypeOf(getConfig<string>('x', 'f')).toEqualTypeOf<string>()
  })

  it('d.ts 契约比运行时更窄(反例)', () => {
    // @ts-expect-error —— 契约只收 ConfigValue,不收对象(运行时其实收,这就是"驯服")
    setConfig('k', { a: 1 })
    // @ts-expect-error —— fallback 同样受 ConfigValue 约束
    getConfig('k', { a: 1 })
    // @ts-expect-error —— key 不能省
    getConfig()
  })
})

// =============================================================
// Part 2 — 🟡 守卫 wrapper
// =============================================================

describe('Day 16 — Part 2 守卫 wrapper', () => {
  it('ThemeMode / FeatureFlags 形状', () => {
    expectTypeOf<ThemeMode>().toEqualTypeOf<'light' | 'dark' | 'auto'>()
    expectTypeOf<FeatureFlags>().toEqualTypeOf<{ compact: boolean; beta: boolean }>()
  })

  it('isThemeMode 是类型守卫(签名带 is 谓词)', () => {
    expectTypeOf(isThemeMode).toEqualTypeOf<
      (value: unknown) => value is 'light' | 'dark' | 'auto'
    >()
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('荧光绿')).toBe(false)
    expect(isThemeMode(42)).toBe(false)
  })

  it('readThemeMode:合法值 / 非法值 / 未配置', () => {
    setConfig('theme', 'dark')
    expect(readThemeMode()).toBe('dark')
    setConfig('theme', '荧光绿')
    expect(() => readThemeMode()).toThrow()
    deleteConfig('theme')
    expect(readThemeMode()).toBe('auto')
  })

  it('readFeatureFlags:两个布尔键', () => {
    setConfig('flags.compact', true)
    setConfig('flags.beta', false)
    expect(readFeatureFlags()).toEqual({ compact: true, beta: false })
  })

  it('readFeatureFlags:任何一个开关不是布尔就抛错', () => {
    setConfig('flags.compact', true)
    setConfig('flags.beta', 'yes')
    expect(() => readFeatureFlags()).toThrow()
  })
})

// =============================================================
// Part 3 — 🔴 声明扩充
// =============================================================

describe('Day 16 — Part 3 legacy-charts 模块扩充', () => {
  it('vendor 已有声明的 renderBar 不受影响', () => {
    const points: ChartPoint[] = [
      { x: 1, y: 2 },
      { x: 3, y: 4, label: '峰值' },
    ]
    expectTypeOf<typeof renderBar>().toEqualTypeOf<
      (el: string, points: ChartPoint[]) => string
    >()
    void points
  })

  it('你扩充的 renderPie:RenderPieFn 形状正确', () => {
    expectTypeOf<RenderPieFn>().toEqualTypeOf<
      (el: string, points: readonly ChartPoint[]) => number
    >()
  })
})

describe('Day 16 — Part 3 __LEGACY_CONFIG__ 全局声明', () => {
  it('LegacyGlobalInfo 形状', () => {
    expectTypeOf<LegacyGlobalInfo>().toEqualTypeOf<{ host: string; timeoutMs: number }>()
  })

  it('全局变量可读写且有类型', () => {
    globalThis.__LEGACY_CONFIG__ = { host: 'https://cfg.internal', timeoutMs: 3000 }
    expect(globalThis.__LEGACY_CONFIG__.host).toBe('https://cfg.internal')
    expect(globalThis.__LEGACY_CONFIG__.timeoutMs).toBe(3000)
    expectTypeOf(globalThis.__LEGACY_CONFIG__).toEqualTypeOf<LegacyGlobalInfo>()
  })

  it('缺字段必须编译报错', () => {
    // @ts-expect-error —— 少了 timeoutMs
    globalThis.__LEGACY_CONFIG__ = { host: 'https://cfg.internal' }
  })
})
