/**
 * Day 15 — composable 泛型签名设计(useLocalStorage / useToggle / useFetch)
 *
 * 学习目标:
 *   1. 泛型参数设计:T 什么时候出现、由谁推导(useToggle 对比 useLocalStorage)
 *   2. 返回值类型显式标注:UseXxxReturn 别名,不靠推导
 *   3. exactOptionalPropertyTypes 下可选属性 options 的坑
 *
 * 规则:
 *   - 零 any(允许 unknown + 守卫);所有 export 有 JSDoc + @example
 *   - 本天自包含:RequestState 重新定义,不 import day02
 */

// =============================================================
// 脚手架(已实现,不是练习重点)
// =============================================================

/**
 * 最小响应式单元 —— 模拟 vue 的 ref(已实现)
 *
 * 注意返回类型是**内联写出**的:你的 `Signal<T>` 别名必须和它形状一致(测试会判)。
 *
 * @example
 *   const s = createSignal(1)
 *   s.set(2)
 *   s.get()  // => 2
 */
export function createSignal<T>(initial: T): { get(): T; set(value: T): void } {
  let value = initial
  return {
    get: () => value,
    set: (next: T) => {
      value = next
    },
  }
}

/**
 * 内存版 storage,模拟 localStorage(已实现)—— Node 环境没有真 localStorage。
 * 每个实例互相隔离;测试里 new 一个全新的,避免用例间串数据。
 *
 * @example
 *   const storage = createMemoryStorage()
 *   storage.setItem('k', '1')
 *   storage.getItem('k')  // => '1'
 */
export function createMemoryStorage(): {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
} {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  }
}

// =============================================================
// Part 1 — 基础:基础设施类型 + useToggle
// =============================================================

// TODO: Signal<T> —— { get(): T; set(value: T): void },和 createSignal 的返回类型同构
export type Signal<T> = never // ← 替换

// TODO: StorageLike —— getItem / setItem / removeItem,与 DOM Storage 同构
export type StorageLike = never // ← 替换

// TODO: Serializer<T> —— { parse(raw: string): T; stringify(value: T): string }
// JSDoc 必须回答:为什么要泛型?(提示:存 Date 时 JSON.parse 给你的是什么)
export type Serializer<T> = never // ← 替换

// TODO: useToggle 的返回类型 —— 带标签二元组 [state: Signal<boolean>, toggle: () => void]
export type ToggleReturn = never // ← 替换

/**
 * 折叠面板开关(签名已给,补运行时;JSDoc 里回答:为什么它不需要泛型参数?)
 *
 * @example
 *   const [state, toggle] = useToggle(true)
 *   state.get()  // => true
 *   toggle()
 *   state.get()  // => false
 */
export function useToggle(initial?: boolean): ToggleReturn {
  // TODO: 基于 createSignal 实现
  void initial
  throw new Error('TODO')
}

// =============================================================
// Part 2 — 进阶:RequestState 自包含重写 + useFetch
// =============================================================

// TODO: ApiError —— { code: number; message: string }(Day 2 复习,重新写)
export type ApiError = never // ← 替换

// TODO: RequestState<T> —— 四态可辨识联合:idle / loading / success / error
export type RequestState<T> = never // ← 替换

// TODO: UseFetchReturn<T> —— { state: Signal<RequestState<T>>; execute(): Promise<void> }
export type UseFetchReturn<T> = never // ← 替换

/**
 * 拉取数据的最小 composable(签名已给,补运行时)
 *
 * - 初始 idle;execute() → loading → success / error
 * - fetcher reject ApiError 形状 → 原样进 error;其他 reject → 包装 { code: 0, message: '网络异常' }
 * - 注意 catch 到的是 unknown(useUnknownInCatchVariables),需要守卫收窄
 *
 * @example
 *   const { state, execute } = useFetch<Notification[]>('/api/notifications', (url) =>
 *     Promise.resolve([{ id: 'n1' }]).then((items) => (void url, items)),
 *   )
 *   await execute()
 *   state.get()  // => { status: 'success', data: [...] }
 */
export function useFetch<T>(
  url: string,
  fetcher: (url: string) => Promise<T>,
): UseFetchReturn<T> {
  // TODO: 状态机:idle → loading → success / error(不允许跳过 loading)
  void url
  void fetcher
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:useLocalStorage(占位签名是错的,从测试反推)
// =============================================================

// TODO: UseLocalStorageOptions<T> —— { storage?: StorageLike; serializer?: Serializer<T> }
export type UseLocalStorageOptions<T> = never // ← 替换

// TODO: UseLocalStorageReturn<T> —— Signal<T> & { reset(): void }
export type UseLocalStorageReturn<T> = never // ← 替换

// TODO: 占位签名是错的,从测试反推:
//   useLocalStorage<T>(key, defaultValue, options?) => UseLocalStorageReturn<T>
//   行为:初始化 storage 有值就 parse(失败回退默认值);set 持久化;reset 恢复默认值并持久化
export function useLocalStorage(key: string, defaultValue: never, options?: never): never {
  void key
  void defaultValue
  void options
  throw new Error('TODO')
}
