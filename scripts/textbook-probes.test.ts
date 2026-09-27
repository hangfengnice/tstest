import { describe, it, expect, expectTypeOf } from 'vitest'
import { z } from 'zod'
import type { Path } from '../day23/solution'

type GetterDefs<S, G> = { [K in keyof G]: (state: S) => G[K] }
interface StoreOptions<S, G> { state: () => S; getters: GetterDefs<S, G> }
declare function inferGetters<S, G>(options: StoreOptions<S, G>): G

describe('教材勘误的最小反例', () => {
  it('精确可选属性区分省略与显式 undefined，Required 保留显式 undefined', () => {
    const omitted: Partial<{ name: string }> = {}
    // @ts-expect-error —— 可选不代表能显式写 undefined
    const rejected: Partial<{ name: string }> = { name: undefined }
    const explicit: Required<{ name?: string | undefined }> = { name: undefined }
    void [omitted, rejected, explicit]
  })
  it('冲突的字面量属性使对象交叉退化为 never', () => {
    type Impossible = { a: 1; b: 2 } & { b: 3; c: 4 }
    expectTypeOf<Impossible>().toEqualTypeOf<never>()
    expectTypeOf<keyof Impossible>().toEqualTypeOf<string | number | symbol>()
  })

  it('路径推导也接受保留具体节点联合的数组', () => {
    type Tree = { name: 'root'; children: ({ name: 'a' } | { name: 'b' })[] }
    expectTypeOf<Path<Tree>>().toEqualTypeOf<'root' | 'root/a' | 'root/b'>()
  })
  it('别名与 options 接口保留镜像反向推导', () => {
    // 仅检查函数体类型，不执行 declare 声明对应的调用。
    function probe() {
      return inferGetters({ state: () => ({ n: 1 }), getters: { doubled: (state) => state.n * 2 } })
    }
    expectTypeOf(probe).returns.toEqualTypeOf<{ doubled: number }>()
  })
  it('同态 readonly 映射会转换数组和元组', () => {
    type Deep<T> = T extends object ? { readonly [K in keyof T]: Deep<T[K]> } : T
    expectTypeOf<Deep<{ n: number }[]>>().toEqualTypeOf<readonly { readonly n: number }[]>()
    expectTypeOf<Deep<[number, string]>>().toEqualTypeOf<readonly [number, string]>()
  })

  it('显式索引签名让 interface 满足 Record 约束', () => {
    interface Events { [key: string]: unknown; ping: number }
    expectTypeOf<Events>().toMatchTypeOf<Record<string, unknown>>()
    type Keys = keyof Events
    expectTypeOf<Keys>().toEqualTypeOf<string | number>()
  })

  it('模板字面量可使用字符串 enum，匹配结果可以是字面量布尔', () => {
    enum State { Open = 'open', Closed = 'closed' }
    type Names = `${State}`
    type HasColon<T extends string> = T extends `${string}:${string}` ? true : false
    expectTypeOf<Names>().toEqualTypeOf<'open' | 'closed'>()
    expectTypeOf<HasColon<'a:b'>>().toEqualTypeOf<true>()
    expectTypeOf<HasColon<'ab'>>().toEqualTypeOf<false>()
  })

  it('结构类型允许变量携带额外字段，JSON 缓存键也可能碰撞', () => {
    const extra = { id: 'x', phone: '123' }
    const base: { id: string } = extra
    expect('phone' in base).toBe(true)
    expect(JSON.stringify([undefined])).toBe(JSON.stringify([null]))
  })

  it('对象展开区分属性缺失与属性值为 undefined', () => {
    const absent = { title: 'demo' }
    const present = { title: 'demo', tags: undefined }
    expect(Object.hasOwn({ ...absent }, 'tags')).toBe(false)
    expect(Object.hasOwn({ ...present }, 'tags')).toBe(true)
  })

  it('元组已知下标与有限键映射不自动添加 undefined', () => {
    const tuple: [string, number] = ['x', 1]
    const array: string[] = ['x']
    const table: Record<'draft' | 'sent', string[]> = { draft: [], sent: [] }
    expectTypeOf(tuple[0]).toEqualTypeOf<string>()
    expectTypeOf(array[0]).toEqualTypeOf<string | undefined>()
    expectTypeOf(table['draft']).toEqualTypeOf<string[]>()
    expectTypeOf<Parameters<(q: string) => void>[0]>().toEqualTypeOf<string>()
    type First<T extends (...args: never[]) => unknown> = Parameters<T>[0]
    expectTypeOf<First<() => void>>().toEqualTypeOf<undefined>()
    expectTypeOf<string[][number]>().toEqualTypeOf<string>()
  })

  it('无约束泛型直接返回 T 时可以保留字面量', () => {
    function identity<T>(value: T): T { return value }
    const literal = identity('auto')
    let input = 'auto'
    const wide = identity(input)
    // 用 typeof 读取已推断的变量类型，避免测试工具的泛型调用再次拓宽候选。
    expectTypeOf<typeof literal>().toEqualTypeOf<'auto'>()
    expectTypeOf(wide).toEqualTypeOf<string>()
  })

  it('satisfies 不保证所有属性都保留字面量', () => {
    const config = { name: 'demo', retries: 3, level: 'debug' } satisfies {
      name: string; retries: number; level: 'debug' | 'info'
    }
    expectTypeOf(config.name).toEqualTypeOf<string>()
    expectTypeOf(config.retries).toEqualTypeOf<number>()
    expectTypeOf(config.level).toEqualTypeOf<'debug'>()
  })

  it('z.infer 可以用于保留 schema 类型的 let 和函数参数', () => {
    let schema = z.string()
    expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<string>()
    function check(value: z.ZodString) {
      expectTypeOf<z.infer<typeof value>>().toEqualTypeOf<string>()
    }
    check(schema)
  })

  it('safeParse 本身不会捕获用户 transform 抛出的异常', () => {
    const schema = z.string().transform(() => { throw new Error('custom failure') })
    expect(() => schema.safeParse('x')).toThrow('custom failure')
  })

  it('await 递归采用 Promise 的兑现值', async () => {
    expect(await new Promise((resolve) => resolve(Promise.resolve(42)))).toBe(42)
    type OneLayer<T> = T extends Promise<infer V> ? V : T
    expectTypeOf<OneLayer<Promise<Promise<Promise<number>>>>>().toEqualTypeOf<Promise<Promise<number>>>()
  })

  it('可选幽灵属性的兼容性取决于载荷的结构', () => {
    interface Key<T> extends Symbol { readonly payload?: T }
    expectTypeOf<Key<{ id: string }>>().toEqualTypeOf<Key<{ id: string }>>()
    expectTypeOf<Key<{ id: string }>>().not.toMatchTypeOf<Key<{ count: number }>>()
  })
})
