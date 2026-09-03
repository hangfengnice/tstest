import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  createSignal,
  createMemoryStorage,
  useToggle,
  useFetch,
  useLocalStorage,
} from './solution.js'
import type {
  Signal,
  StorageLike,
  Serializer,
  ToggleReturn,
  ApiError,
  RequestState,
  UseFetchReturn,
  UseLocalStorageOptions,
  UseLocalStorageReturn,
} from './solution.js'

// =============================================================
// Part 1 — 基础类型形状
// =============================================================

describe('Day 15 — Part 1 基础类型', () => {
  it('Signal<T> 与 createSignal 返回类型同构', () => {
    expectTypeOf<Signal<number>>().toEqualTypeOf<{
      get(): number
      set(value: number): void
    }>()
    expectTypeOf(createSignal(42)).toEqualTypeOf<Signal<number>>()
  })

  it('StorageLike 与 DOM Storage 同构', () => {
    expectTypeOf<StorageLike>().toEqualTypeOf<{
      getItem(key: string): string | null
      setItem(key: string, value: string): void
      removeItem(key: string): void
    }>()
    expectTypeOf(createMemoryStorage()).toEqualTypeOf<StorageLike>()
  })

  it('Serializer<T>:parse/stringify 围绕 T', () => {
    expectTypeOf<Serializer<Date>>().toEqualTypeOf<{
      parse(raw: string): Date
      stringify(value: Date): string
    }>()
  })

  it('ToggleReturn 是带标签二元组', () => {
    expectTypeOf<ToggleReturn>().toEqualTypeOf<
      [state: Signal<boolean>, toggle: () => void]
    >()
  })
})

describe('Day 15 — useToggle', () => {
  it('默认 false,toggle 翻转', () => {
    const [state, toggle] = useToggle()
    expect(state.get()).toBe(false)
    toggle()
    expect(state.get()).toBe(true)
    toggle()
    expect(state.get()).toBe(false)
  })

  it('显式初始值 + state.set', () => {
    const [state] = useToggle(true)
    expect(state.get()).toBe(true)
    state.set(false)
    expect(state.get()).toBe(false)
  })

  it('初始值只接受 boolean', () => {
    // @ts-expect-error —— initial?: boolean,不能传字符串
    useToggle('yes')
  })
})

// =============================================================
// Part 2 — RequestState + useFetch
// =============================================================

describe('Day 15 — Part 2 RequestState 自包含重写', () => {
  it('ApiError 形状', () => {
    expectTypeOf<ApiError>().toEqualTypeOf<{ code: number; message: string }>()
  })

  it('RequestState<T> 是四态可辨识联合', () => {
    expectTypeOf<RequestState<number>>().toEqualTypeOf<
      | { status: 'idle' }
      | { status: 'loading' }
      | { status: 'success'; data: number }
      | { status: 'error'; error: ApiError }
    >()
  })

  it('UseFetchReturn<T> 形状', () => {
    expectTypeOf<UseFetchReturn<string[]>>().toEqualTypeOf<{
      state: Signal<RequestState<string[]>>
      execute(): Promise<void>
    }>()
  })
})

describe('Day 15 — useFetch 运行时', () => {
  it('初始 idle', () => {
    const { state } = useFetch('/api/x', () => Promise.resolve([1, 2]))
    expect(state.get()).toEqual({ status: 'idle' })
  })

  it('execute 期间是 loading,完成后是 success', async () => {
    let resolveFetch!: (v: string[]) => void
    const pending = new Promise<string[]>((res) => {
      resolveFetch = res
    })
    const { state, execute } = useFetch('/api/x', () => pending)
    const executing = execute()
    expect(state.get()).toEqual({ status: 'loading' })
    resolveFetch(['a'])
    await executing
    expect(state.get()).toEqual({ status: 'success', data: ['a'] })
    expectTypeOf(state).toEqualTypeOf<Signal<RequestState<string[]>>>()
  })

  it('fetcher reject ApiError 形状 → 原样进 error', async () => {
    const { state, execute } = useFetch('/api/x', () =>
      Promise.reject({ code: 429, message: '太快了' }),
    )
    await execute()
    expect(state.get()).toEqual({ status: 'error', error: { code: 429, message: '太快了' } })
  })

  it('reject 其他形状 → 守卫收窄后包装成 code 0', async () => {
    const { state, execute } = useFetch('/api/x', () => Promise.reject(new Error('boom')))
    await execute()
    expect(state.get()).toEqual({ status: 'error', error: { code: 0, message: '网络异常' } })
  })
})

// =============================================================
// Part 3 — useLocalStorage(从测试反推)
// =============================================================

describe('Day 15 — Part 3 useLocalStorage 类型', () => {
  it('UseLocalStorageOptions<T> / UseLocalStorageReturn<T> 形状', () => {
    expectTypeOf<UseLocalStorageOptions<Date>>().toEqualTypeOf<{
      storage?: StorageLike
      serializer?: Serializer<Date>
    }>()
    expectTypeOf<UseLocalStorageReturn<string>>().toEqualTypeOf<
      Signal<string> & { reset(): void }
    >()
  })

  it('T 由 defaultValue 推导为 string(字面量拓宽)', () => {
    const storage = createMemoryStorage()
    const ls = useLocalStorage('theme', 'dark', { storage })
    expectTypeOf(ls).toEqualTypeOf<UseLocalStorageReturn<string>>()
    // @ts-expect-error —— T 是 string,set 只接受 string
    ls.set(123)
  })

  it('显式泛型与默认值不匹配必须编译报错', () => {
    const storage = createMemoryStorage()
    // @ts-expect-error —— 显式指定 number 却传 'dark'
    useLocalStorage<number>('theme', 'dark', { storage })
  })

  it('exactOptionalPropertyTypes:显式传 undefined 编译报错', () => {
    // 注意:报错的是**属性** storage: undefined;可选参数本身(options)传 undefined 是合法的
    // @ts-expect-error —— storage?: StorageLike 不接受显式 undefined(exactOptionalPropertyTypes 只管属性)
    useLocalStorage('theme', 'dark', { storage: undefined })
  })
})

describe('Day 15 — useLocalStorage 运行时', () => {
  it('storage 为空 → 初始值是默认值', () => {
    const storage = createMemoryStorage()
    const ls = useLocalStorage('theme', 'dark', { storage })
    expect(ls.get()).toBe('dark')
  })

  it('set 持久化;新实例从 storage 读回', () => {
    const storage = createMemoryStorage()
    const ls = useLocalStorage('pageSize', 20, { storage })
    ls.set(50)
    expect(storage.getItem('pageSize')).toBe('50')
    const ls2 = useLocalStorage('pageSize', 20, { storage })
    expect(ls2.get()).toBe(50)
  })

  it('reset 恢复默认值并持久化', () => {
    const storage = createMemoryStorage()
    const ls = useLocalStorage('pageSize', 20, { storage })
    ls.set(50)
    ls.reset()
    expect(ls.get()).toBe(20)
    expect(storage.getItem('pageSize')).toBe('20')
  })

  it('storage 里的坏 JSON → 回退默认值', () => {
    const storage = createMemoryStorage()
    storage.setItem('theme', '{坏掉的 json')
    const ls = useLocalStorage('theme', 'dark', { storage })
    expect(ls.get()).toBe('dark')
  })

  it('自定义 serializer 存 Date', () => {
    const storage = createMemoryStorage()
    const serializer: Serializer<Date> = {
      parse: (raw) => new Date(raw),
      stringify: (d) => d.toISOString(),
    }
    const ls = useLocalStorage('lastLogin', new Date('2026-09-01T00:00:00Z'), {
      storage,
      serializer,
    })
    ls.set(new Date('2026-09-03T08:00:00Z'))
    expect(storage.getItem('lastLogin')).toBe('2026-09-03T08:00:00.000Z')
    expect(ls.get()).toEqual(new Date('2026-09-03T08:00:00Z'))
  })
})
