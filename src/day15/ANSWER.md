# Day 15 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 15` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

> 已通过本 day 全部验收测试(vitest 23/23,`pnpm typecheck` 本 day 零错)。
> 零 `any`、零 `as`(JSON.parse 返回的 any 只从标准库流入,未写任何断言)。

```ts
/**
 * Day 15 — composable 泛型签名设计(useLocalStorage / useToggle / useFetch)
 *
 * 核心考点:泛型参数什么时候出现、由谁推导;返回值类型显式标注。
 */

// =============================================================
// 脚手架(已实现,不是练习重点):createSignal / createMemoryStorage
// =============================================================

// =============================================================
// Part 1 — 基础:基础设施类型 + useToggle
// =============================================================

/**
 * 最小响应式单元的类型别名 —— 和 createSignal 的返回类型同构。
 * 用方法简写(get(): T)而不是箭头属性(get: () => T):
 * 测试用 toEqualTypeOf 严格判形状,严格相等下两者**不相等**(实测);
 * 方法简写也是 lib.dom 里接口成员的主流写法。
 *
 * @example
 *   const s: Signal<number> = createSignal(1)
 */
export type Signal<T> = {
  get(): T
  set(value: T): void
}

/**
 * 存储接口 —— 与 DOM 的 Storage 同构。
 * 抽成接口而不是直接用 DOM 类型:Node 环境没有 Storage 类型(lib 无 DOM),
 * 而测试要能注入内存实现 —— **依赖倒置**:composable 依赖接口,环境提供实现。
 *
 * @example
 *   const s: StorageLike = createMemoryStorage()
 */
export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * 序列化器 —— parse/stringify 围绕 T。
 *
 * 为什么要泛型:JSON 只是"字符串 ↔ 基础值"的约定,一遇到 Date 就露馅 ——
 * JSON.parse 给你的是 ISO 字符串(string),不是 Date 对象;Map、Set 更是
 * 直接变 '{}'/[]。要存这些类型,调用方必须自带双向转换,而转换的
 * "目标类型"正是 T —— parse 的返回、stringify 的入参,两头锁定同一个 T。
 * 泛型在这里就是把"转换的约定"编码进类型,配错就编译报错。
 *
 * @example
 *   const dateSerializer: Serializer<Date> = {
 *     parse: (raw) => new Date(raw),
 *     stringify: (d) => d.toISOString(),
 *   }
 */
export type Serializer<T> = {
  /** 从存储字符串恢复值 */
  parse(raw: string): T
  /** 把值编码成存储字符串 */
  stringify(value: T): string
}

/**
 * useToggle 的返回类型 —— 带标签二元组。
 * 标签(state/toggle)会出现在解构提示里,调用方不用看文档就知道
 * 每个位置是什么 —— VueUse 全家桶统一返回数组的体验来源。
 *
 * @example
 *   const [state, toggle] = useToggle(true)
 */
export type ToggleReturn = [state: Signal<boolean>, toggle: () => void]

/**
 * 折叠面板开关。
 *
 * 为什么不需要泛型参数:**类型完全由实现方决定,不由调用方决定** ——
 * 状态永远是 boolean、初始值只收 boolean,没有任何"调用方带进来"的类型。
 * 泛型的适用判据是"类型信息从调用点流向实现"(useLocalStorage 的
 * defaultValue 决定 T);useToggle 的类型是封闭集合,写泛型
 * `useToggle<T>()` 反而引入"T 没人提供"的假参数。
 *
 * @example
 *   const [state, toggle] = useToggle(true)
 *   state.get()  // => true
 *   toggle()
 *   state.get()  // => false
 */
export function useToggle(initial?: boolean): ToggleReturn {
  const state = createSignal(initial ?? false)
  return [state, () => state.set(!state.get())]
}

// =============================================================
// Part 2 — 进阶:RequestState 自包含重写 + useFetch
// =============================================================

/**
 * API 错误的最小形状(Day 2 复习,仓库每天自包含)。
 *
 * @example
 *   const e: ApiError = { code: 429, message: '请求太快' }
 */
export type ApiError = {
  code: number
  message: string
}

/**
 * 请求四态 —— 可辨识联合(status 是判别字段)。
 * 四态互斥且穷尽:不会出现 boolean 标志组合出的
 * "loading 同时 success"这种非法中间态。
 *
 * @example
 *   const s: RequestState<number> = { status: 'success', data: 1 }
 */
export type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }

/**
 * useFetch 的返回类型 —— 显式标注的 composable 契约。
 *
 * @example
 *   const { state, execute } = useFetch('/api/x', fetch)
 */
export type UseFetchReturn<T> = {
  state: Signal<RequestState<T>>
  execute(): Promise<void>
}

/**
 * unknown 收窄守卫:是不是 ApiError 形状。
 * 用 `in` 收窄(TS 4.9+):'code' in v 之后 v.code 才可访问且是 unknown,
 * 再用 typeof 逐字段验 —— 全程零 as、零 any。
 */
function isApiError(v: unknown): v is ApiError {
  return (
    typeof v === 'object' &&
    v !== null &&
    'code' in v &&
    typeof v.code === 'number' &&
    'message' in v &&
    typeof v.message === 'string'
  )
}

/**
 * 拉取数据的最小 composable。
 *
 * - 初始 idle;execute() → loading → success / error
 *   (每次 execute 先回 loading,状态机每一步显式转移);
 * - fetcher reject ApiError 形状 → 原样进 error;
 *   其他 reject → catch 到 unknown,守卫收窄失败后包装 { code: 0, message: '网络异常' }
 *
 * T 由 fetcher 的返回类型 Promise<T> 推导 —— 泛型的"调用点流入"。
 *
 * @example
 *   const { state, execute } = useFetch('/api/notifications', () =>
 *     Promise.resolve([{ id: 'n1' }]),
 *   )
 *   await execute()
 *   state.get()  // => { status: 'success', data: [{ id: 'n1' }] }
 */
export function useFetch<T>(
  url: string,
  fetcher: (url: string) => Promise<T>,
): UseFetchReturn<T> {
  // 显式泛型实参:参数 { status: 'idle' } 自己推不出 RequestState<T> 的全貌
  // (不写的话 T 被推成 { status: string },四态联合检查全部失效 —— 见坑 5)
  const state = createSignal<RequestState<T>>({ status: 'idle' })

  const execute = async (): Promise<void> => {
    state.set({ status: 'loading' })
    try {
      const data = await fetcher(url)
      state.set({ status: 'success', data })
    } catch (e) {
      // useUnknownInCatchVariables:e 是 unknown,守卫收窄后才能当 ApiError 用
      state.set({
        status: 'error',
        error: isApiError(e) ? e : { code: 0, message: '网络异常' },
      })
    }
  }

  return { state, execute }
}

// =============================================================
// Part 3 — 边界:useLocalStorage(签名从测试反推)
// =============================================================

/**
 * useLocalStorage 的选项。
 *
 * exactOptionalPropertyTypes 下 `storage?: StorageLike` 的准确语义:
 * "只能省略,不能显式传 undefined" —— { storage: undefined } 编译报错。
 * 注意和可选**参数**的区别:options? 本身传 undefined 是合法的
 * (参数的缺省规则),这个 flag 只管**属性**。
 *
 * @example
 *   useLocalStorage('theme', 'dark', { storage: createMemoryStorage() })
 */
export type UseLocalStorageOptions<T> = {
  storage?: StorageLike
  serializer?: Serializer<T>
}

/**
 * useLocalStorage 的返回类型 —— 一个"可持久化的 Signal"再加 reset。
 * 交叉类型而不是平铺:Signal<T> 是既有契约,原样复用。
 *
 * @example
 *   const ls = useLocalStorage('pageSize', 20)
 *   ls.set(50)   // 写 signal + 持久化
 *   ls.reset()   // 恢复默认值 + 持久化
 */
export type UseLocalStorageReturn<T> = Signal<T> & { reset(): void }

/** 默认存储:模块级内存实现(Node/测试环境没有 localStorage,浏览器下由调用方注入真的) */
const defaultStorage: StorageLike = createMemoryStorage()

/**
 * 记住一个跨刷新的值(模拟 @vueuse/core 的 useLocalStorage)。
 *
 * - T 由 defaultValue 推导:`useLocalStorage('theme', 'dark')` 推出 string
 *   (字面量 'dark' 在包装类型的实例化中被拓宽 —— 见 NOTES 思考题);
 * - 初始化:storage 有值就 parse(parse 失败/坏 JSON 回退 defaultValue);
 * - set:写 signal 并持久化;reset:恢复默认值并持久化。
 *
 * @example
 *   const ls = useLocalStorage('theme', 'dark', { storage: createMemoryStorage() })
 *   ls.get()   // => 'dark'
 *   ls.set('light')
 *   ls.reset() // => 'dark'
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseLocalStorageOptions<T>,
): UseLocalStorageReturn<T> {
  const storage = options?.storage ?? defaultStorage
  const serializer: Serializer<T> =
    options?.serializer ?? {
      // JSON.parse 的返回类型是 any(标准库的历史包袱)——
      // parse 出来的形状是否真是 T 无法运行时验证(泛型),
      // 兜底靠初始化处的 try/catch:parse 抛错就回退默认值
      parse: (raw) => JSON.parse(raw),
      stringify: (value) => JSON.stringify(value),
    }

  // 初始化:读 storage → 有值 parse(失败回退默认值),无值用默认值
  const readInitial = (): T => {
    const raw = storage.getItem(key)
    if (raw === null) return defaultValue
    try {
      return serializer.parse(raw)
    } catch {
      return defaultValue // 坏 JSON / 自定义 parse 抛错:回退默认值
    }
  }

  const signal = createSignal<T>(readInitial())

  return {
    get: () => signal.get(),
    set: (value: T) => {
      signal.set(value)
      storage.setItem(key, serializer.stringify(value))
    },
    reset: () => {
      signal.set(defaultValue)
      storage.setItem(key, serializer.stringify(defaultValue))
    },
  }
}
```

(脚手架 `createSignal` / `createMemoryStorage` 是骨架自带,不重复列出。)

## 二、常见错误写法(点评人视角)

### 1. options 的属性写成 `storage: StorageLike | undefined`(eOPT 语义差,测试 170-174 的靶子)

```ts
// ❌ 错误写法
export type UseLocalStorageOptions<T> = {
  storage: StorageLike | undefined   // "属性存在且值可以是 undefined"
}
useLocalStorage('theme', 'dark', { storage: undefined })  // 编译通过!
```

后果:测试里 `// @ts-expect-error` 下方无错误 → **TS2578: Unused '@ts-expect-error' directive**,类型测试翻红 —— 想拦的显式 undefined 被放行了。

```ts
// ✅ 正确姿势
storage?: StorageLike   // eOPT 下:"只能省略,不能显式 undefined"
```

实测对比(eOPT 开启):`{ storage: undefined }` 对 `storage?: StorageLike` 报 **TS2379**(...is not assignable... with 'exactOptionalPropertyTypes: true'),对 `storage: StorageLike | undefined` 静默通过。两写法只差一个问号,语义是"可以不存在"vs"存在但可为空"—— 对 props/options 这类"缺省即用默认"的场景,前者才是对的。另注意(README 强调、测试注释也写了):这个 flag 只管**属性**;可选**参数** `options?` 本身传 `undefined` 是合法的 —— 属性和参数的规则不同。

### 2. useToggle 加泛型参数(JSDoc 必答题的反面)

```ts
// ❌ 错误写法
export function useToggle<T = boolean>(initial?: T): [Signal<T>, () => void]
useToggle(true)   // T = boolean ✓
useToggle('yes')  // T = string —— 类型检查消失,运行时 state.set(!'yes') 得到 true(!)
```

现象:'yes' 不再编译报错(测试的 `@ts-expect-error` 变 Unused directive),运行时 `!state.get()` 的布尔翻转对字符串产生无意义结果。类型由**实现**决定的状态机(boolean 翻转),不该向调用方开放类型参数 —— 泛型的判据是"类型从调用点流入",useToggle 没有流入点。

```ts
// ✅ 正确姿势:类型封闭,签名写死 boolean
export function useToggle(initial?: boolean): ToggleReturn
```

### 3. Signal<T> 用箭头属性形态(严格相等过不了)

```ts
// ❌ 错误写法
export type Signal<T> = {
  get: () => T          // 属性形态
  set: (value: T) => void
}
```

现象:`expectTypeOf<Signal<number>>().toEqualTypeOf<{ get(): number; set(value: number): void }>()` 失败 —— 实测严格相等(经典 `<T>() => T extends A ? 1 : 2` 判等)下,**方法简写和箭头属性不相等**(方法在严格比较里有独立的 identity)。结构赋值上它们互通(所以代码能跑),但类型断言判形状时会区分。

```ts
// ✅ 正确姿势:与对齐目标同形态 —— 方法简写
export type Signal<T> = { get(): T; set(value: T): void }
```

教训:写"同构别名"时,照抄目标的成员形态(方法抄方法、属性抄属性),别顺手改写。

### 4. 返回类型靠推导、不标 UseXxxReturn

```ts
// ❌ 错误倾向
export function useLocalStorage<T>(...) {
  return { get, set, reset }   // 返回类型:展开的对象形状
}
```

现象:`expectTypeOf(ls).toEqualTypeOf<UseLocalStorageReturn<string>>()` 失败 —— 推导出的类型是字面量展开形状,与 `Signal<T> & { reset(): void }` 在严格相等下不同(尽管结构兼容)。更重要的是契约层面:composable 的返回类型是**公开 API** —— 显式别名意味着"这个形状被承诺",内部改动不小心改了形状,所有用例立刻报错;靠推导则形状随实现漂移,调用方无感地被破坏。

```ts
// ✅ 正确姿势:定义 UseXxxReturn 别名 + 返回类型显式标注
export type UseLocalStorageReturn<T> = Signal<T> & { reset(): void }
export function useLocalStorage<T>(...): UseLocalStorageReturn<T> { ... }
```

### 5. createSignal 不写显式泛型实参(字面量拓宽,状态机失守)

```ts
// ❌ 错误写法
const state = createSignal({ status: 'idle' })   // T 推成 { status: string }!
state.set({ status: 'loading' })                  // 不报错 —— string 什么都收
```

实测:返回处报 **TS2322: Type '{ status: string; }' is not assignable to type 'RequestState<T>'**,而更隐蔽的是中间那行 `set({ status: 'loading' })` —— 拓宽后四态联合的检查全部失效,想 set `{ status: 'whatever' }` 都行。字面量 `'idle'` 传进无约束泛型 T 时被拓宽成 string(和 Day 13 的 buttonDefaults 不加 as const 是同一个 widening)。

```ts
// ✅ 正确姿势:显式泛型实参,把"这个 signal 装的是四态联合"钉死
const state = createSignal<RequestState<T>>({ status: 'idle' })
```

### 6. 初始化时不 try/catch 坏 JSON(运行时坑)

```ts
// ❌ 错误写法
const initial = storage.getItem(key) !== null ? serializer.parse(raw) : defaultValue
// '{坏掉的 json' → JSON.parse 抛 SyntaxError → 整个 useLocalStorage 构造时炸掉
```

现象:测试"storage 里的坏 JSON → 回退默认值"失败 —— composable 在 setup 阶段直接抛异常,组件树都挂了。持久化数据是被用户/旧版本/恶意脚本写过的**不可信输入**,parse 永远要兜底。

```ts
// ✅ 正确姿势:parse 包 try/catch,失败回退默认值
try {
  return serializer.parse(raw)
} catch {
  return defaultValue
}
```

### 7. useFetch 的 catch 直接用 e(不守卫)

```ts
// ❌ 错误写法一:把 e 当 ApiError 用
catch (e) {
  state.set({ status: 'error', error: e })   // e: unknown → TS18046 / 类型不匹配
}

// ❌ 错误写法二:一刀切包装,不看形状
catch {
  state.set({ status: 'error', error: { code: 0, message: '网络异常' } })
}
```

写法一在 `useUnknownInCatchVariables` 下编译不过(这正是这个 flag 的意义:catch 到的东西来历不明);写法二编译过但测试失败 —— fetcher reject 的 `{ code: 429, message: '太快了' }` 被错误包装成 code 0,**上游精心携带的错误码丢了**(重试策略、监控上报全瞎)。

```ts
// ✅ 正确姿势:unknown + 类型守卫,两分支各得其所
catch (e) {
  state.set({
    status: 'error',
    error: isApiError(e) ? e : { code: 0, message: '网络异常' },
  })
}
```

守卫用 `'code' in v` + `typeof` 逐字段验(TS 4.9+ 的 in 收窄让 `v.code` 可访问),零 as。注意守卫验的是"形状像",不是"语义真" —— 这已经是运行时能做到的极限,也正是 unknown 的正确打开方式:**先验后用,不验不用**。

### 8. RequestState 写成 interface + 布尔标志

```ts
// ❌ 错误倾向
interface RequestState<T> {
  isLoading: boolean
  isError: boolean
  data?: T
  error?: ApiError
}
```

现象:`toEqualTypeOf` 四态联合断言失败;更本质的问题是**非法状态可表达**:`{ isLoading: true, isError: true }`、`{ data: x, error: y }` 都是合法实例,每处消费都要先想清楚标志组合。可辨识联合让"状态空间"恰好等于"合法状态" —— switch (s.status) 的穷尽检查(noFallthroughCasesInSwitch)还能替你兜住漏分支。

```ts
// ✅ 正确姿势
export type RequestState<T> =
  | { status: 'idle' } | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }
```

### 9. set/reset 只写 signal 不持久化(或反之)

```ts
// ❌ 错误写法
set: (value: T) => signal.set(value)   // 忘了 storage.setItem
```

现象:测试"set 持久化;新实例从 storage 读回"失败 —— ls2 读回的是旧值,持久化的意义(刷新不丢)不存在。`reset` 同理(测试明确断言 reset 后 storage 里是 '20' 而非残留 '50')。两处都是"内存态与持久态必须同步写"的一致性要求,漏一处就是半残的 composable。

## 三、思考题参考答案

**Q1:`useLocalStorage('theme', 'dark')` 推出 string 而不是 'dark';如果写 `<const T>`,`set('light')` 会怎样?这个 composable 该不该用 const?**

推导成 string 是**字面量拓宽**:无约束泛型 T 从 'dark' 推导时,字面量候选在包装类型的实例化(Signal<T>)中被拓宽成基础类型 string。(实测有个有趣细节:如果函数直接 `return T`,`f('dark')` 的 T 其实保字面量 'dark';包进 Signal<T> 再返回就拓宽了 —— fresh 字面量的 widen 发生在"装进别的类型"的边界。)

写 `<const T>` 后(实测):T = 'dark',`ls.set('light')` 直接编译报错('light' 不能赋给 'dark');如果默认值是对象,还会推成 `{ readonly theme: 'dark' }` —— 全部字面量 + readonly,任何"换一个同类型的新值"的 set 都报错。

该不该用 const:**不该**。localStorage 的语义是"可变的、同类型的持久值" —— set 要能写同类型的任意值。const T 适合的是"调用点给出的字面量就是全部取值域"的场景(配置快照、事件名表),用到"可变状态"上是把需求理解反了。VueUse 的 `useLocalStorage` 也没有 const —— 同款理由。

**Q2:为什么 VueUse 的 useLocalStorage 有 defaultReturnValue 参数,而不是让你 `ls.get() ?? fallback`?**

关键在**初始 parse 失败的时机**:存储里的值是不可信输入,parse 失败发生在**构造时**(composable 创建的那一刻),那时 signal 里还没有值 —— `get() ?? fallback` 是"取出之后的补偿",管不到构造期;defaultReturnValue 是**构造语义的一部分**:存储不可用/坏数据时,整个 composable 从一开始就退化为"内存里的默认值",get/set/reset 的行为始终一致。另外 `?? fallback` 还有个语义缺陷:它无法区分"存的值恰好是 null/0/''"和"没存"(?? 对所有 falsy-adjacent 场景一刀切),而构造期回退不存在这个歧义。一句话:**默认值属于"创建时的决策",不是"读取时的补丁"**。

**Q3(useToggle 的 JSDoc 必答):为什么 useToggle 不需要泛型?**

见"常见错误"第 2 条:类型由实现方封闭决定(boolean),没有"从调用点流入"的类型信息。泛型判据口诀:**只有当调用方手里握着实现方不知道的类型信息时,才需要泛型参数**。useLocalStorage 的 defaultValue、useFetch 的 fetcher 返回类型都是"调用方握着";useToggle 什么都没有。

## 四、验收自查清单

- [ ] `pnpm check:day 15` 通过（类型检查 + 运行时测试）
- [ ] 零 `any`、零未注释的 `as`(memoryStorage 脚手架除外;JSON.parse 的 any 只流入不书写)
- [ ] 三个 composable 的返回类型全部显式标注(ToggleReturn / UseFetchReturn<T> / UseLocalStorageReturn<T>)
- [ ] `useToggle` 的 JSDoc 回答了"为什么不用泛型"(类型封闭,无调用点流入)
- [ ] `Serializer<T>` 的 JSDoc 回答了"为什么要泛型"(JSON 对 Date/Map 失效,转换约定双向锁定 T)
- [ ] `{ storage: undefined }` 反例编译报错(eOPT:属性用 `?`,不写 `| undefined`)
- [ ] `createSignal<RequestState<T>>({ status: 'idle' })` 带显式泛型(防字面量拓宽)
- [ ] catch 的 e 经守卫(isApiError)收窄;ApiError 形状原样进 error,其他包装 code 0
- [ ] 初始化 parse 包 try/catch,坏 JSON 回退默认值
- [ ] set/reset 同步写 signal 和 storage(两处持久化都不漏)
- [ ] 想通:const T 为什么不适合这个 composable(可变状态 vs 字面量快照)
