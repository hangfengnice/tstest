# Day 15 — composable 泛型签名设计(useLocalStorage / useToggle / useFetch)

## 业务场景

chipRunner 的**设置页**有三个经典 composable 需求:

| 需求 | 对应真实库 |
|---|---|---|
| 记住用户选的主题/分页大小(刷新不丢) | `@vueuse/core` 的 `useLocalStorage` |
| 折叠面板开/关 | `useToggle` |
| 拉取通知偏好数据(idle → loading → 成功/失败) | `useFetch` / `useAsyncData` |

今天不装 vue,用纯 TS 写这三个 composable 的**类型签名 + 运行时**。
核心考点只有一个:**泛型参数怎么设计、返回值类型怎么显式标注** —— 这是读 VueUse 源码的基本功。

脚手架(已给,不用实现):`createSignal`(模拟 ref 的最小响应式单元)、`memoryStorage`(模拟 localStorage,Node 下没有真 localStorage)。

---

## Part 1 — 🟢 基础:基础设施类型 + useToggle

1. `Signal<T>`:最小响应式单元,形状 `{ get(): T; set(value: T): void }`(测试会拿它和 `createSignal` 的返回值对形状)。
2. `StorageLike` / `Serializer<T>` / `UseLocalStorageOptions<T>`(先定义形状,Part 3 才用):
   - `StorageLike`:`getItem / setItem / removeItem`(和 DOM 的 Storage 同构)
   - `Serializer<T>`:`parse(raw: string): T` + `stringify(value: T): string`(为什么泛型?存 Date、存 Map 时 JSON 不够用)
3. `useToggle(initial?: boolean): ToggleReturn`,返回**带标签的二元组** `[state: Signal<boolean>, toggle: () => void]`。
   - JSDoc 必须回答:**为什么 useToggle 不需要泛型参数?**(对照 useLocalStorage 想想"类型由谁决定")

## Part 2 — 🟡 进阶:RequestState 自包含重写 + useFetch

4. 把 Day 2 的 `ApiError` + `RequestState<T>`(四态:idle / loading / success / error)**重新定义一遍** —— 本仓库每天自包含,不许 import day02。这次你应该写得比上次快。
5. `useFetch<T>(url, fetcher): UseFetchReturn<T>`,其中 `UseFetchReturn<T> = { state: Signal<RequestState<T>>; execute(): Promise<void> }`:
   - 初始 idle;`execute()` 先置 loading,成功置 success,失败置 error
   - fetcher 以 **ApiError 形状的对象** reject → 原样进入 error 分支
   - reject 的是别的东西(比如普通 Error)→ 收窄(catch 到的是 `unknown`,别忘了 `useUnknownInCatchVariables`)后包装成 `{ code: 0, message: '网络异常' }`
   - 状态转移是状态机:**success 之后不能再变 loading**(下一次 execute 之前)

## Part 3 — 🔴 边界:useLocalStorage 完整签名(从测试反推)

6. `useLocalStorage` 的占位签名是**错的**,从测试反推:
   - `useLocalStorage<T>(key, defaultValue, options?)` → `UseLocalStorageReturn<T>` = `Signal<T> & { reset(): void }`
   - T 由 defaultValue 推导:`useLocalStorage('theme', 'dark')` → `Signal<string>`(注意字面量会**拓宽**,README 思考题)
   - 行为:初始化时 storage 有值就 parse,没有(或 parse 失败)用 defaultValue;`set` 写 signal 并持久化;`reset` 恢复默认值并持久化
7. options 的坑(**exactOptionalPropertyTypes**):`options?: { storage?: StorageLike; serializer?: Serializer<T> }` 下,
   `useLocalStorage('k', 'v', { storage: undefined })` 必须编译报错 —— 测试有反例。
   想想 `storage?: StorageLike` 和 `storage: StorageLike | undefined` 的区别在哪。
   还有一个容易搞混的点(测试注释里也写了):这个 flag 只管**属性**,
   可选**参数** `options?` 本身传 `undefined` 是合法的 —— 属性和参数的规则不一样。

### 思考题(写进 NOTES.md)

- `useLocalStorage('theme', 'dark')` 推出的是 `string` 而不是 `'dark'`(字面量拓宽)。如果写成 `<const T>`(Day 6 的 const 类型参数),`set('light')` 会发生什么?这个 composable 该不该用 const?
- 为什么 VueUse 的 `useLocalStorage` 有 `defaultReturnValue` 参数而不是让你 `ls.get() ?? fallback`?(提示:初始 parse 失败的时机)

---

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm vitest run src/day15` 全过
- [ ] 三个 composable 的返回类型全部**显式标注**(定义 `UseXxxReturn` 别名,不靠推导)
- [ ] `useToggle` 的 JSDoc 回答了"为什么不用泛型"
- [ ] `Serializer<T>` 的 JSDoc 回答了"为什么要泛型"
- [ ] `{ storage: undefined }` 反例编译报错(exactOptionalPropertyTypes)
- [ ] 零 any、零未注释的 as(memoryStorage 内部除外)

## 写完后

贴 `solution.ts`,说:"点评 + 解释为什么"。
建议节奏:Part 1 25 分钟 → Part 2 35 分钟 → Part 3 40 分钟。卡超过 10 分钟来要提示。
