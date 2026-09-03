import { describe, it, expect, expectTypeOf } from 'vitest'
import { request, endpoints } from './solution.js'
import type {
  Method,
  ApiError,
  Result,
  ApiEnvelope,
  EndpointDef,
  PathParams,
  User,
  Notification,
} from './solution.js'

// =============================================================
// Part 1 — 基础类型
// =============================================================

describe('Day 17 — Part 1 错误与结果', () => {
  it('Method 是四个 HTTP 动词的字面量联合', () => {
    expectTypeOf<Method>().toEqualTypeOf<'GET' | 'POST' | 'PUT' | 'DELETE'>()
  })

  it('ApiError 形状', () => {
    expectTypeOf<ApiError>().toEqualTypeOf<{ code: number; message: string }>()
  })

  it('Result<T> 默认 E = ApiError', () => {
    expectTypeOf<Result<string>>().toEqualTypeOf<
      { ok: true; data: string } | { ok: false; error: ApiError }
    >()
  })

  it('Result<T, E> 的 E 可以换', () => {
    expectTypeOf<Result<string, { tag: 'E' }>>().toEqualTypeOf<
      { ok: true; data: string } | { ok: false; error: { tag: 'E' } }
    >()
  })
})

// =============================================================
// Part 2 — 信封 / 端点 / 注册表
// =============================================================

describe('Day 17 — Part 2 信封与端点', () => {
  it('ApiEnvelope<T> 是以 code 为判别符的联合', () => {
    expectTypeOf<ApiEnvelope<User>>().toEqualTypeOf<
      { code: 0; data: User; message?: string } | { code: number; message?: string }
    >()
  })

  it('EndpointDef 携带路径与响应类型(幽灵属性)', () => {
    expectTypeOf<EndpointDef<'/users/:id', User>>().toEqualTypeOf<{
      path: '/users/:id'
      method: Method
      _response?: User
    }>()
  })

  it('endpoints 用 satisfies 组装且类型不被拓宽', () => {
    expectTypeOf(endpoints.getUser).toEqualTypeOf<
      EndpointDef<'/users/:id', User>
    >()
    expectTypeOf(endpoints.listNotifications).toEqualTypeOf<
      EndpointDef<'/notifications', Notification[]>
    >()
  })
})

// =============================================================
// Part 3 — PathParams
// =============================================================

describe('Day 17 — Part 3 PathParams 模板提取', () => {
  it('单参数路径', () => {
    expectTypeOf<PathParams<'/users/:id'>>().toEqualTypeOf<{ id: string }>()
  })

  it('多参数路径(递归)', () => {
    const params: PathParams<'/posts/:postId/comments/:commentId'> = {
      postId: 'p1',
      commentId: 'c1',
    }
    void params
    expectTypeOf<PathParams<'/posts/:postId/comments/:commentId'>>().toExtend<{
      postId: string
      commentId: string
    }>()
    expectTypeOf<{ postId: string; commentId: string }>().toExtend<
      PathParams<'/posts/:postId/comments/:commentId'>
    >()
  })

  it('无参路径:空对象合法,多传键编译报错', () => {
    const healthy: PathParams<'/health'> = {}
    void healthy
    // @ts-expect-error —— 无参路径不接受任何键(所以空分支必须是 Record<string, never>)
    const bad: PathParams<'/health'> = { id: 'x' }
    void bad
  })
})

// =============================================================
// request 运行时
// =============================================================

describe('Day 17 — request 运行时', () => {
  it('成功:替换路径参数,解信封,返回 Result 成功分支', async () => {
    const calls: string[] = []
    const r = await request(endpoints.getUser, {
      params: { id: 'u1' },
      transport: (path) => {
        calls.push(path)
        return Promise.resolve({ code: 0, data: { id: 'u1', name: '吴杭峰' } })
      },
    })
    expect(calls).toEqual(['/users/u1'])
    expect(r).toEqual({ ok: true, data: { id: 'u1', name: '吴杭峰' } })
    expectTypeOf(r).toEqualTypeOf<Result<User>>()
    if (!r.ok) throw new Error('应当是成功分支')
    expect(r.data.name).toBe('吴杭峰')
  })

  it('query 按 Object.keys 顺序拼接,值用 String()', async () => {
    const calls: string[] = []
    await request(endpoints.listNotifications, {
      params: {},
      query: { page: 2, pageSize: 20, archived: false },
      transport: (path) => {
        calls.push(path)
        return Promise.resolve({ code: 0, data: [] })
      },
    })
    expect(calls).toEqual(['/notifications?page=2&pageSize=20&archived=false'])
  })

  it('无 query 时路径不带问号', async () => {
    const calls: string[] = []
    await request(endpoints.listNotifications, {
      params: {},
      transport: (path) => {
        calls.push(path)
        return Promise.resolve({ code: 0, data: [] })
      },
    })
    expect(calls).toEqual(['/notifications'])
  })

  it('失败信封:code 非 0 → Result 失败分支', async () => {
    const r = await request(endpoints.getUser, {
      params: { id: 'u1' },
      transport: () => Promise.resolve({ code: 429, message: '太快了' }),
    })
    expect(r).toEqual({ ok: false, error: { code: 429, message: '太快了' } })
  })

  it('失败信封没有 message → 用默认文案', async () => {
    const r = await request(endpoints.getUser, {
      params: { id: 'u1' },
      transport: () => Promise.resolve({ code: 500 }),
    })
    expect(r).toEqual({ ok: false, error: { code: 500, message: '未知错误' } })
  })

  it('transport reject → 包装成网络错误(catch 的是 unknown)', async () => {
    const r = await request(endpoints.getUser, {
      params: { id: 'u1' },
      transport: () => Promise.reject(new Error('断网了')),
    })
    expect(r).toEqual({ ok: false, error: { code: -1, message: '网络错误' } })
  })

  it('反例:缺参数 / 显式 undefined / 未知键都必须编译报错', async () => {
    // 注:@ts-expect-error 只压类型,调用仍会运行 —— 缺参的防御性抛错用 catch 兜住
    // @ts-expect-error —— :id 路径缺 id 参数
    await request(endpoints.getUser, { params: {} }).catch(() => undefined)
    // @ts-expect-error —— query 不接受显式 undefined(exactOptionalPropertyTypes 只管属性)
    await request(endpoints.listNotifications, { params: {}, query: undefined }).catch(() => undefined)
    // @ts-expect-error —— params 不接受未知的键
    await request(endpoints.getUser, { params: { id: 'u1', extra: 'x' } }).catch(() => undefined)
  })
})
