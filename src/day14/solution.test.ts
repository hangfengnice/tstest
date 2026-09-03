import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import {
  provide,
  inject,
  runWithContext,
  createEmitter,
  THEME_KEY,
  USER_KEY,
  SETTINGS_KEY,
} from './solution.js'
import type {
  InjectionKey,
  ThemeMode,
  ThemeContext,
  CurrentUser,
  NotificationSettings,
  NotificationEvents,
  Emitter,
} from './solution.js'

// =============================================================
// 测试数据
// =============================================================

const darkTheme: ThemeContext = { mode: 'dark', density: 'comfortable' }
const lightTheme: ThemeContext = { mode: 'light', density: 'compact' }

const admin: CurrentUser = { id: 1, name: '吴杭峰', roles: ['admin', 'editor'] }

const defaultSettings: NotificationSettings = { pageSize: 20, sound: true }

// =============================================================
// Part 1 — 类型形状 + InjectionKey 模式
// =============================================================

describe('Day 14 — Part 1 InjectionKey 模式', () => {
  it('ThemeMode 是三值字面量联合', () => {
    expectTypeOf<ThemeMode>().toEqualTypeOf<'light' | 'dark' | 'auto'>()
  })

  it('ThemeContext / CurrentUser / NotificationSettings 形状正确', () => {
    expectTypeOf<ThemeContext>().toEqualTypeOf<{
      mode: ThemeMode
      density: 'comfortable' | 'compact'
    }>()
    expectTypeOf<CurrentUser>().toEqualTypeOf<{
      id: number
      name: string
      roles: ReadonlyArray<'admin' | 'editor' | 'viewer'>
    }>()
    expectTypeOf<NotificationSettings>().toEqualTypeOf<{
      pageSize: number
      sound: boolean
    }>()
  })

  it('key 的类型标注携带值的类型', () => {
    expectTypeOf(THEME_KEY).toEqualTypeOf<InjectionKey<ThemeContext>>()
    expectTypeOf(USER_KEY).toEqualTypeOf<InjectionKey<CurrentUser>>()
    expectTypeOf(SETTINGS_KEY).toEqualTypeOf<InjectionKey<NotificationSettings>>()
  })

  it('provide 的值类型必须与 key 匹配(编译报错反例)', () => {
    runWithContext(() => {
      // 显式把 T 指成 CurrentUser,却传了主题 key + 数字:key 和 value 两条路都错
      // @ts-expect-error —— THEME_KEY 携带的是 ThemeContext,不是 CurrentUser
      provide<CurrentUser>(THEME_KEY, 42)
    })
  })
})

// =============================================================
// Part 2 — provide / inject 运行时
// =============================================================

describe('Day 14 — Part 2 provide / inject', () => {
  it('provide 后 inject 拿回同一个值', () => {
    runWithContext(() => {
      provide(THEME_KEY, darkTheme)
      expect(inject(THEME_KEY)).toEqual(darkTheme)
    })
  })

  it('runWithContext 之外 provide 必须抛错', () => {
    expect(() => provide(THEME_KEY, darkTheme)).toThrow()
  })

  it('子上下文覆盖父上下文,离开子上下文恢复', () => {
    const result = runWithContext(() => {
      provide(THEME_KEY, darkTheme)
      const outer = inject(THEME_KEY)
      const inner = runWithContext(() => {
        provide(THEME_KEY, lightTheme)
        return inject(THEME_KEY)
      })
      const after = inject(THEME_KEY)
      return { outer, inner, after }
    })
    expect(result.outer).toEqual(darkTheme)
    expect(result.inner).toEqual(lightTheme)
    expect(result.after).toEqual(darkTheme)
  })

  it('SETTINGS_KEY 也能注入/取出(照葫芦画瓢的那个)', () => {
    runWithContext(() => {
      provide(SETTINGS_KEY, defaultSettings)
      const s = inject(SETTINGS_KEY)
      expect(s).toEqual(defaultSettings)
      expectTypeOf(s).toEqualTypeOf<NotificationSettings | undefined>()
    })
  })
})

// =============================================================
// Part 3 — inject 重载(从测试反推签名)
// =============================================================

describe('Day 14 — Part 3 inject 重载', () => {
  it('只传 key:返回 T | undefined', () => {
    runWithContext(() => {
      provide(THEME_KEY, darkTheme)
      const t = inject(THEME_KEY)
      expectTypeOf(t).toEqualTypeOf<ThemeContext | undefined>()
      expect(t).toEqual(darkTheme)
    })
  })

  it('无祖先提供时返回 undefined', () => {
    runWithContext(() => {
      expect(inject(SETTINGS_KEY)).toBeUndefined()
    })
  })

  it('传默认值:返回 T,没有 undefined', () => {
    runWithContext(() => {
      const t = inject(THEME_KEY, lightTheme)
      expectTypeOf(t).toEqualTypeOf<ThemeContext>()
      expect(t).toEqual(lightTheme)
    })
  })

  it('默认值类型不符必须编译报错', () => {
    runWithContext(() => {
      // @ts-expect-error —— 默认值必须是 ThemeContext,不能是裸字符串
      inject(THEME_KEY, 'dark')
      // @ts-expect-error —— 默认值不能是 CurrentUser
      inject(THEME_KEY, admin)
    })
  })
})

// =============================================================
// Part 2b — 事件映射 + emitter
// =============================================================

describe('Day 14 — 事件映射形状', () => {
  it('NotificationEvents:事件名 → 参数元组', () => {
    expectTypeOf<NotificationEvents>().toEqualTypeOf<{
      'theme:change': [mode: ThemeMode]
      'user:rename': [userId: number, newName: string]
      'panel:close': []
    }>()
  })

  it('createEmitter 返回 Emitter<E>', () => {
    expectTypeOf(createEmitter<NotificationEvents>()).toEqualTypeOf<
      Emitter<NotificationEvents>
    >()
  })
})

describe('Day 14 — emitter 运行时', () => {
  it('emit 按事件名携带参数元组', () => {
    const emitter = createEmitter<NotificationEvents>()
    const onRename = vi.fn()
    emitter.on('user:rename', onRename)
    emitter.emit('user:rename', 7, '新名字')
    expect(onRename).toHaveBeenCalledWith(7, '新名字')
  })

  it('零参数事件:emit 不带参数', () => {
    const emitter = createEmitter<NotificationEvents>()
    const onClose = vi.fn()
    emitter.on('panel:close', onClose)
    emitter.emit('panel:close')
    expect(onClose).toHaveBeenCalledWith()
  })

  it('同一事件多个订阅者都被调用;其他事件不受影响', () => {
    const emitter = createEmitter<NotificationEvents>()
    const a = vi.fn()
    const b = vi.fn()
    const other = vi.fn()
    emitter.on('theme:change', a)
    emitter.on('theme:change', b)
    emitter.on('panel:close', other)
    emitter.emit('theme:change', 'auto')
    expect(a).toHaveBeenCalledWith('auto')
    expect(b).toHaveBeenCalledWith('auto')
    expect(other).not.toHaveBeenCalled()
  })

  it('取消订阅后不再收到事件', () => {
    const emitter = createEmitter<NotificationEvents>()
    const handler = vi.fn()
    const off = emitter.on('theme:change', handler)
    off()
    emitter.emit('theme:change', 'dark')
    expect(handler).not.toHaveBeenCalled()
  })

  it('emit 参数类型错误必须编译报错', () => {
    const emitter = createEmitter<NotificationEvents>()
    // @ts-expect-error —— theme:change 的参数是 ThemeMode,不能传数字
    emitter.emit('theme:change', 123)
    // @ts-expect-error —— user:rename 需要两个参数
    emitter.emit('user:rename', 7)
    // @ts-expect-error —— 不存在的事件名
    emitter.emit('nope', 'x')
  })

  it('on 的 handler 参数类型由事件决定', () => {
    const emitter = createEmitter<NotificationEvents>()
    // @ts-expect-error —— handler 得是 (mode: ThemeMode) => void
    emitter.on('theme:change', (n: number) => void n)
  })
})
