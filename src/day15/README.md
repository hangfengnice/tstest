# Day 15 — composable 泛型签名设计(useLocalStorage / useToggle / useFetch)

## 重学导读

**前置知识**：Day 2 请求状态、Day 4 守卫、Day 5 泛型。

**今天要学会**：根据调用者需要变化的部分设计泛型，封装可测试的状态与存储行为。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 泛型是否必要 | toggle 始终处理 boolean；存储值和请求结果由调用方决定，才需要 T。先找变化点，再决定泛型参数。 |
| 返回类型 | 把 state、操作函数和 reset 等能力组合成清晰契约；元组适合位置固定的少量返回值，对象适合命名能力。 |
| 外部输入 | Serializer<T> 的 parse 返回 T 是协议承诺，JSON.parse 本身不保证它。真实数据需加守卫或后续 Day 25 的 schema。 |

### 动手顺序

先读 Signal 和内存存储 → 完成 useToggle → 用假 fetcher 验证四态 → 最后处理存储初始化、失败回退、set/reset。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么把可变主题推断成唯一的 dark 字面量可能不合适？parse 失败与存储缺失的回退行为如何验证？
- **迁移**：为列表分页大小设计持久化状态，列出初始化和重置时的值变化。
- **验收**：在项目根目录运行 `pnpm check:day 15`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

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
   - 一次 execute 内按 loading → success/error 更新；下一次 execute 可以重新进入 loading。本题不实现完整并发请求协调。

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

- [ ] `pnpm check:day 15` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 三个 composable 的返回类型全部**显式标注**(定义 `UseXxxReturn` 别名,不靠推导)
- [ ] `useToggle` 的 JSDoc 回答了"为什么不用泛型"
- [ ] `Serializer<T>` 的 JSDoc 回答了"为什么要泛型"
- [ ] `{ storage: undefined }` 反例编译报错(exactOptionalPropertyTypes)
- [ ] 零 any、零未注释的 as(memoryStorage 内部除外)

## 写完后

贴 `solution.ts`,说:"点评 + 解释为什么"。
建议节奏:Part 1 25 分钟 → Part 2 35 分钟 → Part 3 40 分钟。卡超过 10 分钟来要提示。

---

[上一题：Day 14](../day14/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 16](../day16/README.md)
