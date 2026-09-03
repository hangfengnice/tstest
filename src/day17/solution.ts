/**
 * Day 17 — API client 类型设计(泛型请求 / 路径参数模板 / Result 包装)
 *
 * 学习目标:
 *   1. 默认泛型参数 Result<T, E = ApiError>
 *   2. 幽灵类型携带响应类型(EndpointDef 的 _response,与 Day 14 InjectionKey 同思想)
 *   3. satisfies 校验注册表且不拓宽类型(Day 6)
 *   4. 模板字面量类型提取路径参数(条件类型 + infer 预习)
 *
 * 规则:
 *   - 零 any、零未注释 as;所有 export 有 JSDoc + @example
 */

// =============================================================
// Part 1 — 基础:错误与结果
// =============================================================

// TODO: HTTP 方法字面量联合
export type Method = never // ← 替换

// TODO: ApiError —— { code: number; message: string }
export type ApiError = never // ← 替换

// TODO: Result<T, E = ApiError> —— { ok: true; data: T } | { ok: false; error: E }
// JSDoc 必须回答:为什么 E 的默认值是 ApiError?
export type Result<T, E = ApiError> = never // ← 替换

// =============================================================
// Part 2 — 进阶:信封 + 端点描述 + 注册表
// =============================================================

// TODO: ApiEnvelope<T> —— 判别联合(code: 0 成功带 data;非 0 失败带 message)
export type ApiEnvelope<T> = never // ← 替换

// TODO: EndpointDef<P, Resp> —— { path: P; method: Method; _response?: Resp }
// _response 是幽灵属性:只在类型标注里出现,运行时永远是 undefined
export type EndpointDef<P extends string, Resp> = never // ← 替换

// TODO: ApiRegistry —— Record<string, EndpointDef<string, unknown>>
export type ApiRegistry = never // ← 替换

// ---- 业务数据(可直接用,不是考点) ----

/** 用户(Day 15 同款) */
export type User = { id: string; name: string }

/** 通知(Day 1 同款,精简版) */
export type Notification = { id: string; title: string; isRead: boolean }

// TODO: 定义两个端点(注意:用类型标注携带响应类型,禁止 as):
//   getUser           —— GET /users/:id          响应 User
//   listNotifications —— GET /notifications      响应 Notification[]
// 然后用 satisfies ApiRegistry 组装成 endpoints
export const endpoints = {} // ← 替换

// =============================================================
// Part 3 — 边界:路径参数模板 + request(签名已给)
// =============================================================

// TODO: PathParams<P> —— 模板字面量提取 :param,递归支持多参数
//   '/users/:id' => { id: string }
//   '/a/:x/b/:y' => { x: string; y: string }
//   '/health'    => Record<string, never)(注意:空对象类型要选对,见 README)
export type PathParams<P extends string> = never // ← 替换

/**
 * 类型化请求(签名已给,补运行时)
 *
 * @example
 *   const r = await request(endpoints.getUser, {
 *     params: { id: 'u1' },
 *     transport: async () => ({ code: 0, data: { id: 'u1', name: '吴' } }),
 *   })
 *   // r: Result<User> —— r.ok 为 true 时 r.data 是 User
 */
export function request<P extends string, Resp>(
  endpoint: EndpointDef<P, Resp>,
  options: {
    params: PathParams<P>
    query?: Record<string, string | number | boolean>
    transport: (path: string) => Promise<ApiEnvelope<Resp>>
  },
): Promise<Result<Resp>> {
  // TODO: 替换 :param → 拼 query → 收窄信封 → 包装 Result
  void endpoint
  void options
  throw new Error('TODO')
}
