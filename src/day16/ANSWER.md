# Day 16 — 参考答案 + 点评要点

> 使用规则：自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案"，是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下实现**已通过本 day 全部验收测试**（vitest 16/16 双通道全绿）+ `pnpm typecheck`
（day16 相关的 44 个骨架期错误全部消失，无新增错误）。

---

## 一、参考实现

### legacy-config.d.ts（主战场）

```ts
/**
 * legacy-config.js 的手写声明 —— Day 16 参考实现
 *
 * 核心思想:.d.ts 不是"照抄实现推导",而是**契约**:
 *   - 实现里 `store = new Map()` 什么都收,契约上我们只收 ConfigValue;
 *   - 无类型的 JS 出口一律 unknown(调用方必须自己收窄,或走 solution.ts 的守卫 wrapper)。
 */

/**
 * 版本常量。它是 const,值永远不会再变,所以直接精确到字面量 ——
 * 这样 `CONFIG_VERSION === '3.2.0'` 这类写错版本的比较会在编译期标红。
 *
 * @example
 * import { CONFIG_VERSION } from './legacy-config.js'
 * const v: '3.2.1' = CONFIG_VERSION // 字面量对字面量,精确匹配
 */
export const CONFIG_VERSION: '3.2.1'

/**
 * 配置值的合法契约。
 * 运行时其实什么都收(Map 不挑),但契约上"我们不接受对象 / null / undefined"——
 * 这就是"声明比实现更窄":把 2017 年的狂野 API 驯服成类型安全的输入面。
 *
 * @example
 * setConfig('retries', 3)        // ✅ number 在契约内
 * setConfig('k', { a: 1 })       // ❌ 编译期拒绝,虽然运行时收得下
 */
export type ConfigValue = string | number | boolean

/**
 * 读配置 —— 重载 1:不传 fallback。
 * 无类型 JS 的出口必须是 unknown(不是 any):
 * unknown 强迫调用方先收窄再用,any 会顺着赋值污染整条调用链。
 *
 * @example
 * const v: unknown = getConfig('theme') // 出口是 unknown,收窄交给调用方
 */
export function getConfig(key: string): unknown
/**
 * 读配置 —— 重载 2:传了 fallback `T` 就返回 `T`(key 不存在时的替代值)。
 * 约束 `T extends ConfigValue` 有个副作用(也是特性):字面量会被保留 ——
 * `getConfig('x', 'f')` 的返回类型是 `'f'` 而不是 `string`。
 * 想要拓宽的 string,显式传泛型参数:`getConfig<string>('x', 'f')`。
 *
 * @example
 * getConfig('x', 42)              // => 42
 * getConfig<string>('x', 'f')     // => string
 */
export function getConfig<T extends ConfigValue>(key: string, fallback: T): T

/**
 * 写配置;返回写入前的旧值(首次写入没有旧值,返回 undefined)。
 * 返回 `ConfigValue | undefined` 而不是 `unknown`:旧值要么是契约内合法值、要么没有,
 * 这是"出口类型跟着语义走",比一股脑 unknown 更好用。
 *
 * @example
 * setConfig('theme', 'dark')  // => undefined(首次)
 * setConfig('theme', 'light') // => 'dark'(上一次的旧值)
 */
export function setConfig(key: string, value: ConfigValue): ConfigValue | undefined

/**
 * 是否存在这个 key。
 *
 * @example
 * hasConfig('theme') // => boolean
 */
export function hasConfig(key: string): boolean

/**
 * 删除一个 key;返回是否真的删了(不存在就返回 false)。
 *
 * @example
 * deleteConfig('theme') // => true
 * deleteConfig('theme') // => false(已经没了)
 */
export function deleteConfig(key: string): boolean

/**
 * 所有 key,按字典序排序。
 *
 * @example
 * listKeys() // => ['a', 'b'](已排序)
 */
export function listKeys(): string[]
```

### solution.ts（守卫 wrapper + 两处声明扩充）

```ts
import { getConfig } from './legacy-config.js'
// 只能用 import type:'legacy-charts' 没有真实模块文件,值位置 import 会在运行时炸。
// 模块扩充对整个文件(乃至整个程序)生效,所以"先扩充再 typeof 取类型"没有顺序要求。
import type { renderPie } from 'legacy-charts'

// =============================================================
// Part 2 — 🟡 守卫 wrapper(Day 4 复习):unknown 出口收窄
// =============================================================

/**
 * 主题模式。把三个合法值收成字面量联合,而不是 string ——
 * string 是"什么颜色都行",字面量联合是"只这三个,多一个都编译报错"。
 *
 * @example
 * const m: ThemeMode = 'dark'  // ✅
 * const n: ThemeMode = 'blue'  // ❌ 编译错误
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * 功能开关的形状。两个键都必填 boolean ——
 * 开关没有"半开",undefined 的开关是坏配置,应该在读取时就抛错,不该在类型上留口子。
 *
 * @example
 * const f: FeatureFlags = { compact: true, beta: false }
 */
export type FeatureFlags = { compact: boolean; beta: boolean }

// 为什么用 Set<unknown> 而不是数组 includes:
// `readonly ThemeMode[]` 的 includes 只接受 ThemeMode,unknown 传进去直接 TS2345;
// Set<unknown>.has 天然接受任意值,一个 as 都用不着。
const THEME_MODES = new Set<unknown>(['light', 'dark', 'auto'])

/**
 * 主题模式守卫 —— 老模块出口是 unknown,收窄全靠它。
 * `value is ThemeMode` 谓词让"运行时检查"变成"编译期可信任的类型信息"。
 *
 * @example
 * const raw: unknown = getConfig('theme')
 * if (isThemeMode(raw)) {
 *   raw // 这里已经是 ThemeMode
 * }
 */
export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.has(value)
}

/**
 * 读主题配置。
 * 语义三分:合法值原样返回;未配置返回 'auto';非法值抛错 ——
 * 坏配置要大声失败,静默吞成 'auto' 会把数据问题藏到线上排障时才炸。
 *
 * @example
 * setConfig('theme', 'dark')
 * readThemeMode() // => 'dark'
 * deleteConfig('theme')
 * readThemeMode() // => 'auto'(未配置)
 */
export function readThemeMode(): ThemeMode {
  const raw: unknown = getConfig('theme')
  // 先判"没有"再判"非法":undefined 是合法的"未配置",不是坏值
  if (raw === undefined) return 'auto'
  if (isThemeMode(raw)) return raw
  throw new Error(`配置项 theme 是非法值:${JSON.stringify(raw)}`)
}

/**
 * 读两个布尔开关键 'flags.compact' / 'flags.beta';任何一个不是布尔就抛错。
 * 用 typeof 收窄比 isThemeMode 式的集合守卫更轻 ——
 * 目标类型就是原始类型 boolean 时,`typeof x === 'boolean'` 分支后 TS 自动收窄,不需要手写谓词。
 *
 * @example
 * setConfig('flags.compact', true)
 * setConfig('flags.beta', false)
 * readFeatureFlags() // => { compact: true, beta: false }
 */
export function readFeatureFlags(): FeatureFlags {
  const compact: unknown = getConfig('flags.compact')
  const beta: unknown = getConfig('flags.beta')
  // 抛错信息带上实际类型,排障时不用猜是哪个键坏了
  if (typeof compact !== 'boolean') {
    throw new Error(`配置项 flags.compact 应为 boolean,实际是 ${typeof compact}`)
  }
  if (typeof beta !== 'boolean') {
    throw new Error(`配置项 flags.beta 应为 boolean,实际是 ${typeof beta}`)
  }
  // 走到这里 compact / beta 都已被 typeof 收窄成 boolean,直接组装即可
  return { compact, beta }
}

// =============================================================
// Part 3 — 🔴 声明扩充
// =============================================================

/**
 * 老页面全局配置的形状。
 * timeoutMs 用 number 而不是 number 字面量:它是会被改的运行时状态,不是常量。
 *
 * @example
 * const info: LegacyGlobalInfo = { host: 'https://cfg.internal', timeoutMs: 3000 }
 */
export type LegacyGlobalInfo = { host: string; timeoutMs: number }

// 老页面用 <script> 把配置挂在全局 __LEGACY_CONFIG__ 上,给它补类型。
// var 声明会挂到 globalThis 上,从此 globalThis.__LEGACY_CONFIG__ 全项目有类型。
declare global {
  var __LEGACY_CONFIG__: LegacyGlobalInfo
}

// 模块扩充:vendor 的 charts.d.ts 只声明了 renderBar,这里把运行时存在的 renderPie 补进同一模块。
// 注意:块里的 ChartPoint 直接指向 'legacy-charts' 自己的导出,不需要(也不应该)再 import。
declare module 'legacy-charts' {
  /**
   * 渲染饼图,返回扇区数量。
   * 参数用 readonly ChartPoint[]:渲染函数只读不写数据,readonly 让调用方可以传
   * `as const` 的冻结数组/元组,类型上也不允许实现内部偷偷 push。
   */
  export function renderPie(el: string, points: readonly ChartPoint[]): number
}

/**
 * renderPie 的函数类型。
 * `typeof 函数名` 是从"值"反查类型的标准姿势 —— 声明搬家后类型自动跟着走。
 *
 * @example
 * const fn: RenderPieFn = renderPie
 */
export type RenderPieFn = typeof renderPie
```

---

## 二、常见错误写法（点评人视角）

### 1. 常量类型给宽了

❌ `export const CONFIG_VERSION: string`

现象：测试 `expectTypeOf(CONFIG_VERSION).toEqualTypeOf<'3.2.1'>()` 红（TS2344）。
为什么错：`.d.ts` 是契约，写 `string` 等于宣布"任何字符串都合法"，`CONFIG_VERSION === '3.2.0'`
这种手滑版本比较编译器就不再帮你抓了。const 常量的类型应该和"它不会再变"这个事实一样精确。

✅ `export const CONFIG_VERSION: '3.2.1'`

顺带一提（实测）：`export const CONFIG_VERSION = '3.2.1'`（省略注解、直接初始化）
在 `.d.ts` 里也是合法的，且会推导出字面量 `'3.2.1'`。但显式注解更符合"契约先行"的表达意图。

### 2. 想用一条签名写完 getConfig（写不出 unknown 出口）

❌ `export function getConfig<T extends ConfigValue>(key: string, fallback?: T): T`

现象：`getConfig('x')` 编译不报错（TS 推断不出 T 时会**兜底到约束** `ConfigValue`），
但测试 `expectTypeOf(getConfig('x')).toEqualTypeOf<unknown>()` 红。
为什么错："不传 fallback 返回 unknown、传了返回 T"是**两种不同形状的调用**，
一个可选参数糊不出两条返回类型 —— 这正是函数重载存在的意义。

✅ 两条重载签名依次声明：

```ts
export function getConfig(key: string): unknown
export function getConfig<T extends ConfigValue>(key: string, fallback: T): T
```

### 3. 重载外再写"全能兜底签名"会遮蔽字面量

❌ 在两条重载前面加一条宽签名：

```ts
export function getConfig(key: string, fallback?: ConfigValue): ConfigValue | undefined
export function getConfig<T extends ConfigValue>(key: string, fallback: T): T
```

现象：`getConfig('x', 'f')` 的返回类型变成 `ConfigValue | undefined`，
`expectTypeOf(getConfig('x', 'f')).toEqualTypeOf<'f'>()` 红。
为什么错：**重载解析取第一条匹配的签名**（overload resolution is first-match-wins）。
宽签名在前，所有调用都先被它吃掉，后面的窄签名永远轮不到。
顺序原则：签名从窄到宽排。

### 4. 泛型约束丢了 → 反例抓不住

❌ `export function getConfig<T>(key: string, fallback: T): T`（不写 `extends ConfigValue`）

现象（实测）：`getConfig('k', { a: 1 })` **编译通过** —— T 直接推成 `{ a: number }`。
于是测试里的 `// @ts-expect-error` 变成 **TS2578: Unused '@ts-expect-error' directive**，
vitest 类型通道直接红。
为什么错：无约束的 T 是"什么都接受"，契约收窄完全失效。
约束 `T extends ConfigValue` 在这里的真正作用**不是保留字面量，而是拒绝契约外的实参**。

✅ `export function getConfig<T extends ConfigValue>(key: string, fallback: T): T`

### 5. 守卫里数组 includes 吃 unknown（TS2345）

❌

```ts
const THEME_MODES = ['light', 'dark', 'auto'] as const
export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value) // TS2345
}
```

现象（实测）：`error TS2345: Argument of type 'unknown' is not assignable to
parameter of type '"light" | "dark" | "auto"'`。
为什么错：`readonly ('light'|'dark'|'auto')[]` 的 `includes` 参数类型是数组元素类型，
只认得成员，不认得 unknown。常见"急救"是 `THEME_MODES as readonly string[]` ——
用一个 as 换编译通过，属于本仓库要戒的写法。

✅ 两种零 as 姿势任选：

```ts
// 姿势 A:集合的元素类型就是 unknown,has 天然收 unknown
const THEME_MODES = new Set<unknown>(['light', 'dark', 'auto'])
export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.has(value)
}

// 姿势 B:值少时直接 === 链,零技巧零成本
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto'
}
```

### 6. 守卫直接返回 true / 只查 typeof（谓词说谎）

❌ `return typeof value === 'string'`

现象：类型上 `raw` 被断言成 ThemeMode，运行时 `'荧光绿'` 也混进来 ——
`isThemeMode('荧光绿')` 该返回 false 却返回 true，测试红。
为什么错：`value is ThemeMode` 是**你对编译器的承诺**，签名收得越窄，
实现就必须查得越严。谓词说谎 = 把错误从"编译期"拖到"线上"。

✅ 集合成员判断（见上一条），让运行时检查和谓词声明严格对齐。

### 7. readThemeMode 用 fallback 语法糖（静默吞掉坏配置）

❌ `return getConfig('theme', 'auto')`

现象：`setConfig('theme', '荧光绿')` 后 `readThemeMode()` 返回 `'荧光绿'`
（getConfig 只在值是 undefined 时才用 fallback），测试 `toThrow()` 红。
为什么错：这里犯了两个错 —— 一是语义错位：fallback 只兜"未配置"，不兜"非法值"；
二是类型说谎：返回值被标成 `'auto'` 字面量，实际是任意字符串，比 unknown 更糟。

✅ 自己拿 unknown、自己三分支：

```ts
const raw: unknown = getConfig('theme')
if (raw === undefined) return 'auto'
if (isThemeMode(raw)) return raw
throw new Error(`配置项 theme 是非法值:${JSON.stringify(raw)}`)
```

### 8. readFeatureFlags 同样的 fallback 陷阱 + 不抛错

❌ `return { compact: getConfig('flags.compact', false), beta: getConfig('flags.beta', false) }`

现象：存了 `'yes'` 时不抛错，原样返回字符串，测试 `toThrow()` 红；且返回值类型
是 `false` 字面量 —— 类型上又说谎了。
为什么错：同第 7 条。"坏配置大声失败"和"未配置给默认"是两条路径，混不得。

✅ 逐个 `typeof x === 'boolean'` 检查 + 抛错（参考实现见上）。这里不需要手写谓词，
typeof 分支后 TS 自动把 `unknown` 收窄成 `boolean`。

### 9. declare global 里用 let / const（globalThis 上看不到）

❌

```ts
declare global {
  let __LEGACY_CONFIG__: LegacyGlobalInfo
}
```

现象（实测）：`error TS2339: Property '__LEGACY_CONFIG__' does not exist on
type 'typeof globalThis'`。
为什么错：`declare global` 里只有 **`var`** 会成为 `globalThis` 的属性
（和真实 JS 语义对齐：全局 var 挂 window/globalThis，let/const 挂的是全局词法作用域，
不是全局对象的属性）。测试里 `globalThis.__LEGACY_CONFIG__` 全靠 var。

✅ `declare global { var __LEGACY_CONFIG__: LegacyGlobalInfo }`

### 10. declare global 写进了"脚本文件"

❌ 在一个**没有任何 import/export** 的 .ts 文件顶层写 `declare global { ... }`

现象（实测）：`error TS2669: Augmentations for the global scope can only be
directly nested in external modules or ambient module declarations.`
为什么错：全局扩充必须发生在**模块**里，而"是不是模块"由"有没有 import/export"决定。
本 day 的 solution.ts 因为 import 了 getConfig 天然是模块，踩不到；
但单独建一个 `global.d.ts` 忘了写 `export {}` 就会中招。

✅ 文件里至少有一个 `export {}`，或把声明放进有导入导出的模块文件。

### 11. 模块扩充的名字打错一个字

❌ `declare module 'legacy-chart' { ... }`（少了 s）

现象（实测）：`error TS2664: Invalid module name in augmentation,
module 'legacy-chart' cannot be found.`
为什么错：模块扩充是"往**已存在的模块**上合并声明"，名字必须和原 ambient 声明
一字不差。打错名字时 TS 不会帮你猜，直接判定为无效扩充。

✅ `declare module 'legacy-charts' { ... }`

### 12. 值位置 import 'legacy-charts'（运行时炸）

❌ `import { renderPie } from 'legacy-charts'`（不带 type）

现象（实测）：vitest 直接
`Error: Failed to load url legacy-charts ... Does the file exist?`，整个测试文件 FAIL。
为什么错：`'legacy-charts'` 只存在于类型世界（charts.d.ts 的 ambient 声明），
磁盘上没有对应模块文件。`import type` 在编译后被整体擦除所以安全；
值 import 会留给打包器/运行时去解析 —— 解析不到就炸。

✅ `import type { renderPie } from 'legacy-charts'`，并只用 `typeof renderPie` 取类型。

### 13. 反过来：把 import type 的东西当值用

❌

```ts
import type { renderPie } from 'legacy-charts'
renderPie('#chart', points) // TS1361
```

现象（实测）：`error TS1361: 'renderPie' cannot be used as a value because it
was imported using 'import type'.`
为什么错：类型导入的实体只存在于编译期。真要调用它，需要运行时真实存在模块
（本 day 没有）。这两个方向的坑合起来记：**类型-only 的东西，进出都得走 type 通道**。

### 14. renderPie 参数漏了 readonly

❌ `export function renderPie(el: string, points: ChartPoint[]): number`

现象：`expectTypeOf<RenderPieFn>().toEqualTypeOf<
(el: string, points: readonly ChartPoint[]) => number>()` 红（TS2344）。
为什么错：可变数组类型和只读数组类型**互不兼容**（`ChartPoint[]` 不能赋给
`readonly ChartPoint[]` 的位置反过来才行）。渲染函数语义上只读，
`readonly` 同时表达了"我不改你的数据"的 API 承诺。

✅ `points: readonly ChartPoint[]`

### 15. 扩充块里画蛇添足地 import ChartPoint

❌

```ts
import type { ChartPoint } from 'legacy-charts'
declare module 'legacy-charts' {
  export function renderPie(el: string, points: readonly ChartPoint[]): number
}
```

现象：能编译（不算错），但完全多余。
为什么不值得：`declare module 'X'` 块内的名字解析发生在**模块 X 自己的作用域**里，
ChartPoint 天然指向被扩充模块的导出。多这条 import 反而暗示"这俩是两个东西"，
误导读者。这也是 README 让你"体会两件事"的第一件。

✅ 块内直接用 `ChartPoint`，一个字都不用 import。

---

## 三、思考题参考答案

### 为什么不用 allowJs + checkJs？

（README 题面 + legacy-config.js 顶部注释的完整答案）

1. **checkJs 靠 JSDoc 猜，动态 JS 推出来多半是 any**：`store = new Map()` 没有
   类型参数，`store.get(key)` 的返回类型是 `any`，所有函数签名全是隐式 any ——
   要补齐只能往 JS 里塞大量 JSDoc，等于变相写 .d.ts 还受限于 JSDoc 表达力
   （函数重载、递归类型都难写）。
2. **编译范围失控**：本仓库 tsconfig 的 include 是 `src/**/*`，开 allowJs 会把
   所有 JS 拉进编译，历史文件的海量隐式 any 会瞬间淹没错误列表。
3. **本质区别：checkJs 是"从实现推导类型"，手写 .d.ts 是"给实现签契约"**。
   契约可以**比实现更窄**（运行时什么都收，契约只收 ConfigValue）——
   这是把狂野 API 驯服成安全 API 的关键，checkJs 做不到"实现收而类型不收"。

### Part 3 的两件"体会"

1. **扩充块里的 ChartPoint 不需要 import**：`declare module 'legacy-charts'` 块内的
   名字解析在 'legacy-charts' 自己的作用域内进行，ChartPoint 直接指它已有的导出。
   模块扩充 = 在原模块作用域里"续写"，不是新建作用域。
2. **只能 import type**：'legacy-charts' 没有 `/node_modules/legacy-charts` 也没有
   `src/legacy-charts.ts`，只存在于 charts.d.ts 的 ambient 声明里。值 import 留给
   运行时解析（炸，见坑 12），`import type` 编译期整体擦除（安全）。

### NOTES 思考：字面量保留 vs 拓宽，各自的触发条件（实测版）

先给结论，再给实测证据（本机 TS 5.6 + strict 验证过）：

| 场景 | `'f'` 的命运 |
|---|---|
| `const x = 'f'` 然后 `getConfig('k', x)` | **拓宽成 string**（变量声明的常规化） |
| `getConfig('k', 'f')`（有 `T extends ConfigValue`） | **保留 `'f'`** |
| `getConfig('k', 'f')`（无约束 `<T>`，实测） | **也保留 `'f'`** —— 注意！ |
| `getConfig<string>('k', 'f')` | 显式指定，就是 `string` |
| `let s = 'f'; getConfig('k', s)` | **拓宽成 string**（let 声明拓宽） |

准确表述：**泛型 T 从"字面量实参"直接推断时，字面量被保留**（根位置推断不拓宽，
有没有约束都一样）。真正会发生拓宽的是**变量中转**——`let s = 'f'` 的声明类型是
`string`（拓宽发生在变量声明，不是泛型推断），传进去自然推断出 `string`。
所以想要拓宽的 string 有两条路：先存进变量再传，或显式传泛型参数
`getConfig<string>('k', 'f')`。

那 `T extends ConfigValue` 这个约束到底扛了什么？**契约收窄**——它拒绝
`getConfig('k', { a: 1 })`（坑 4 的实证）。"保留字面量"的功劳在"字面量直接作为
推断源"这件事上，约束保证的是"推断源必须合法"。两个知识点别记混。

---

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错，`npx vitest run src/day16` 全过（16/16）
- [ ] legacy-config.js 和 charts.d.ts 一个字没改（`git diff` 可查）
- [ ] d.ts 里没有 any；无 fallback 的 getConfig 出口是 `unknown`
- [ ] 所有 export 有中文 JSDoc + `@example`（d.ts 里也写了）
- [ ] `setConfig('k', { a: 1 })` 编译报错（契约收窄生效）
- [ ] `RenderPieFn` 的第二个参数是 `readonly ChartPoint[]`
- [ ] NOTES.md 记了一条：字面量保留 vs 拓宽的触发条件（可用上文表格校对）
- [ ] 额外自查：你的 isThemeMode 实现里有几个 `as`？（参考答案：0 个）
