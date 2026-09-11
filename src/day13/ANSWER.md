# Day 13 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

> 已通过本 day 全部验收测试(vitest 18/18,`pnpm typecheck` 本 day 零错)。
> 零 `any`、零 `as`(全文件一次断言都没有 —— 本 day 类型层完全可推)。

```ts
/**
 * Day 13 — Vue Props 类型设计(纯 TS 模拟,不 import vue)
 *
 * 三层视角:
 *   Partial<T>             —— 父组件可以只传一部分
 *   ResolveProps<T, D>     —— withDefaults 后组件内部"必有值"
 *   ExtractPublicPropTypes —— 运行时定义反推的父组件视角(required 才必选)
 */

// =============================================================
// Part 1 — 基础:Props 接口
// =============================================================

/**
 * 按钮组件的 Props —— 组件作者视角的"完整形状"。
 *
 * 注意 exactOptionalPropertyTypes 下可选字段的规则:
 * `size?: 'sm' | 'md' | 'lg'` 表示"只能**省略**,不能显式传 undefined"——
 * 省略和"传了但值是 undefined"在语义上是两回事:
 * 省略 = 没有这个属性;显式 undefined = 有属性但值缺位。
 *
 * @example
 *   const p: ButtonProps = { type: 'ghost', label: '取消' }
 */
export interface ButtonProps {
  type: 'primary' | 'ghost'
  label: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}

// =============================================================
// Part 2 — 进阶:默认值对象与 ResolveProps
// =============================================================

/**
 * 按钮默认值对象 —— withDefaults 的 defaults 参数。
 *
 * **必须 as const**:不加时 'md' 会被宽化(widening)成 string、
 * false 宽化成 boolean,就不再满足 Partial<ButtonProps> 了。
 * as const 让每个值保持字面量类型并加 readonly ——
 * 默认值本来就应该是不可变的常量,语义也吻合。
 *
 * @example
 *   const check: Partial<ButtonProps> = buttonDefaults  // 编译通过
 */
export const buttonDefaults = { size: 'md', disabled: false } as const

/**
 * 默认值对象的类型。
 *
 * 和 Partial<ButtonProps> 的关系:默认值对象**可以**赋给它
 * (每个已写字段的类型是子集,且允许只写部分字段),
 * 但 Partial 只约束"已写字段的类型对",不记录"哪些字段有默认值"——
 * 所以 ResolveProps 的第二个参数用 ButtonPropsDefaults
 * (精确的、带字面量的形状)而不是 Partial,信息量完全不同。
 *
 * @example
 *   type D = ButtonPropsDefaults  // { readonly size: 'md'; readonly disabled: false }
 */
export type ButtonPropsDefaults = typeof buttonDefaults

/**
 * 应用默认值后的 Props(组件内部视角):
 * 有默认值的字段从"可选"变成"必有值"(类型还是 T[K],不是默认值的字面量);
 * 没默认值的字段原样保留。
 *
 * 两个坑(都踩过才记得住):
 *   坑 a:`{ [K in keyof D]: T[K] }` 直接写 T[K] 会被拦 ——
 *      error TS2536: Type 'K' cannot be used to index type 'T'。
 *      因为 K 的迭代域是 keyof D,TS 不会替你把 `D extends Partial<T>`
 *      的约束传递进映射体(它只看当前作用域:K 属于 keyof D,未必属于 keyof T)。
 *      解法:条件类型守门 `K extends keyof T ? T[K] : never`。
 *   坑 b:守门之后,对**可选属性**的索引访问 T[K] 会混进 undefined
 *      (TS 用它表示"属性可能不存在")—— 但有默认值的字段必有值,
 *      undefined 是噪音,用 NonNullable 剥掉。
 *
 * @example
 *   type R = ResolveProps<ButtonProps, ButtonPropsDefaults>
 *   // r.size 的类型是 'sm' | 'md' | 'lg'(不是 'md' 字面量,也不是 undefined)
 */
export type ResolveProps<T, D extends Partial<T>> = Omit<T, keyof D> & {
  [K in keyof D]: NonNullable<K extends keyof T ? T[K] : never>
}

/**
 * 把外部传入的 props(有默认值的字段可省)合并默认值,
 * 返回组件内部视角的"全量必有值" props。
 *
 * spread 顺序:defaults 在前、props 在后 ——
 * 用户传了的字段必须覆盖默认值;而"省略"的字段在 props 对象里
 * 根本不存在键(eOPT 下也不可能显式传 undefined),不会反向污染默认值。
 *
 * @example
 *   resolveButtonProps({ type: 'primary', label: '保存' })
 *   // => { type: 'primary', label: '保存', size: 'md', disabled: false }
 */
export function resolveButtonProps(
  props: ButtonProps,
): ResolveProps<ButtonProps, ButtonPropsDefaults> {
  return { ...buttonDefaults, ...props }
}

// =============================================================
// Part 3 — 边界:手写简化版 ExtractPropTypes
// =============================================================

/**
 * 单个 prop 的运行时定义(模拟 Vue 的 props 选项)。
 *
 *   type: () => T —— 类型构造器(返回值类型即 prop 类型,显式标注避免宽化);
 *   required?: true —— **字面量 true**,不是 boolean:条件类型靠它分拣
 *     必选/可选,boolean 会同时放行 true 和 false(见 ANSWER 坑 4);
 *   default?: T —— 默认值,类型跟着 type 走(T 出现两处,互相锁定)。
 *
 * @example
 *   const def: PropDefinition<'sm' | 'md' | 'lg'> = {
 *     type: (): 'sm' | 'md' | 'lg' => 'md',
 *   }
 */
export interface PropDefinition<T = unknown> {
  /** 类型构造器:返回值类型就是 prop 的类型 */
  type: () => T
  /** 必选标记 —— 字面量 true(不是 boolean),条件类型判断的依据 */
  required?: true
  /** 默认值 —— 类型必须与 type 的返回值一致 */
  default?: T
}

/**
 * 从单个 prop 定义推断出类型 V。
 *
 * `D extends PropDefinition<infer V>`:infer 在条件类型的模式匹配里
 * "抓出"泛型实参 —— TS 拿 D 的 type: () => xxx 与 () => V 对齐,
 * V 就被解出来是 xxx。infer 是"从类型里反解类型"的唯一通道。
 *
 * @example
 *   type S = InferPropType<{ type: () => string; required: true }>  // => string
 */
export type InferPropType<D extends PropDefinition> =
  D extends PropDefinition<infer V> ? V : never

/**
 * 组件内部视角:所有 prop 都有值(和 Vue 的 ExtractPropTypes 同义)。
 *
 * 同构映射(homomorphic mapped type):`[K in keyof D]` 直接映射入参的键,
 * 逐字段做 InferPropType —— 键还是那几个键,值类型被逐个推断。
 *
 * @example
 *   type Inner = ExtractPropTypes<typeof buttonPropDefs>
 *   // { type: 'primary'|'ghost'; label: string; size: 'sm'|'md'|'lg'; disabled: boolean }
 */
export type ExtractPropTypes<D extends Record<string, PropDefinition>> = {
  [K in keyof D]: InferPropType<D[K]>
}

/**
 * 父组件传参视角(模拟 Vue 的 ExtractPublicPropTypes):
 * required: true 的必选,其余可选。
 *
 * key remapping(`as` 子句)把键按条件分拣到两个分支:
 *   - 条件成立的键保留原名 → 进必选分支(不加 ?)
 *   - 条件不成立的键映射成 never → 从该分支**消失**(never 键被丢弃)
 * 两个分支再交叉(&),就得到"有的必选、有的可选"的混合形状。
 *
 * @example
 *   type Public = ExtractPublicPropTypes<typeof buttonPropDefs>
 *   const ok: Public = { type: 'primary', label: '保存' }  // size/disabled 可省
 */
export type ExtractPublicPropTypes<D extends Record<string, PropDefinition>> = {
  [K in keyof D as D[K] extends { required: true } ? K : never]: InferPropType<D[K]>
} & {
  [K in keyof D as D[K] extends { required: true } ? never : K]?: InferPropType<D[K]>
}
```

## 二、常见错误写法(点评人视角)

### 1. ResolveProps 映射体里直接写 `T[K]`(坑 a,README 预告)

```ts
// ❌ 错误写法
export type ResolveProps<T, D extends Partial<T>> = Omit<T, keyof D> & {
  [K in keyof D]: T[K]
}
// error TS2536: Type 'K' cannot be used to index type 'T'.(实测)
```

为什么明明有 `D extends Partial<T>` 约束还报错:K 的迭代域(来源)是 `keyof D`,TS 检查映射体内的索引访问时**只看当前作用域**——K 属于 keyof D,keyof D 和 keyof T 的子集关系躺在泛型约束里,检查器不做这层传递(约束是"承诺",不是"推导依据")。

```ts
// ✅ 正确姿势:条件类型当场守门
{ [K in keyof D]: NonNullable<K extends keyof T ? T[K] : never> }
```

`K extends keyof T ? ... : never` 在映射体内**重新做一次**类型收窄,false 分支给 never(永不出现的占位)。这个模式在泛型工具类型里随处可见,值得形成肌肉记忆。

### 2. 守门之后忘了 undefined 混入(坑 b,README 预告)

```ts
// ❌ 错误写法:只守门,没剥 undefined
export type ResolveProps<T, D extends Partial<T>> = Omit<T, keyof D> & {
  [K in keyof D]: K extends keyof T ? T[K] : never
}
// Resolved['size'] 的类型是 'sm' | 'md' | 'lg' | undefined(实测 TS2322)
```

为什么:TS 对**可选属性**做索引访问 `T[K]` 时,结果自动 `| undefined` —— 这是"属性可能不存在"的编码。但 ResolveProps 的语义恰恰是"这些字段有默认值、必有值",undefined 是必须剥掉的噪音。

```ts
// ✅ 正确姿势:NonNullable
{ [K in keyof D]: NonNullable<K extends keyof T ? T[K] : never> }
```

注意测试断言的微妙之处:`Resolved['size']` 期望 `'sm' | 'md' | 'lg'`(干净),而 `Resolved['loading']`(没默认值的)期望 `boolean | undefined`—— Omit 保留的那一半**不做** NonNullable,各得其所。

### 3. buttonDefaults 忘了 as const(测试 67-72 行的反例)

```ts
// ❌ 错误写法
export const buttonDefaults = { size: 'md', disabled: false }
// buttonDefaults.size 的类型:string(宽化)
const bad: Partial<ButtonProps> = buttonDefaults
// error TS2322: string 不能赋给 'sm' | 'md' | 'lg' | undefined
```

为什么宽化:不带标注的 const 对象,其字面量属性被 TS "善意地"放宽到基础类型(方便后续 `obj.size = 'lg'` 这类改写)。`as const` 关闭宽化:全部收成字面量 + readonly。判断口诀:**值以后不会变的配置对象,一律 as const**(默认值表、路由表、枚举映射)。

### 4. `required?: boolean` 而不是字面量 `true`

```ts
// ❌ 错误写法
interface PropDefinition<T = unknown> {
  type: () => T
  required?: boolean
}
type Public<D extends Record<string, PropDefinition>> = {
  [K in keyof D as D[K] extends { required: boolean } ? K : never]: InferPropType<D[K]>
} & { /* 可选分支同条件 */ }
```

现象(实测):`{ required: false }` 的字段也满足 `extends { required: boolean }`,被错误分进**必选**分支 —— `required: false` 白写,本该可选的 prop 漏标成必选(TS2322: Property 'a' is missing)。

```ts
// ✅ 正确姿势
required?: true
// 条件相应写 D[K] extends { required: true }
```

只有字面量 `true` 才能当"开关":`required: false` 不满足 `{ required: true }`。测试数据里的 `required: true as const` 也是同一件事 —— 保住字面量不被宽化成 boolean。**字面量类型是类型层的布尔开关**,这是运行时定义能反推类型的根基。

### 5. resolveButtonProps 的 spread 顺序写反(运行时坑,类型层抓不到)

```ts
// ❌ 错误写法:类型全绿,运行时错
return { ...props, ...buttonDefaults }
```

现象(实测 node):用户传 `size: 'lg'`,返回值里 size 是 `'md'` —— 默认值**覆盖**了用户值。`expect(custom).toEqual({ ..., size: 'lg', ... })` 失败。

```ts
// ✅ 正确姿势:defaults 在前,props 在后
return { ...buttonDefaults, ...props }
```

为什么"省略的字段不会被反向污染":省略 = props 对象里**没有这个键**,spread 一个不存在的键不会产生覆盖;而 eOPT + 可选字段不给显式 undefined,堵死了 `size: undefined` 把默认值冲掉的旁路。这个坑在类型层**完全静默**(两次 spread 都是合法 ButtonProps),只有运行时测试能抓 —— 也是"断言即规格"的价值所在。

### 6. key remapping 把两个分支写成一个映射

```ts
// ❌ 错误倾向:想在一个映射里加条件 ?
type Public<D> = {
  [K in keyof D]: D[K] extends { required: true } ? InferPropType<D[K]> : InferPropType<D[K]> | undefined
}
```

现象:字段全部**必选**(只是类型带上 undefined)——`{ type: 'primary', label: '保存' }` 之外的调用全被要求写上 `size: undefined`。映射类型没有"按条件加 ?"的原生语法,optional 修饰子不能是条件表达式。

```ts
// ✅ 正确姿势:两个分支 + key remapping 分拣,never 键自动消失
{
  [K in keyof D as D[K] extends { required: true } ? K : never]: InferPropType<D[K]>
} & {
  [K in keyof D as D[K] extends { required: true } ? never : K]?: InferPropType<D[K]>
}
```

`as never` 的键会从映射结果里被丢弃 —— 这是"过滤键"的标准手法(等价于 Omit 的底层原理)。

### 7. InferPropType 的约束写得太窄或太宽

```ts
// ❌ 错误写法一:约束不写
export type InferPropType<D> = D extends PropDefinition<infer V> ? V : never
// 调用 InferPropType<{ type: () => string }> 能用,但失去了
// "D 必须是 PropDefinition 形状"的前置检查,传什么都默默走 never 分支

// ❌ 错误写法二:直接索引
export type InferPropType<D extends PropDefinition> = ReturnType<D['type']>
// 对本题够用,但 PropDefinition<T> 是泛型接口 —— D 没实例化时
// ReturnType<D['type']> 推到的是约束层的 unknown,泛型场景下会丢精度
```

```ts
// ✅ 正确姿势:约束 + infer 模式匹配,一步解出泛型实参
export type InferPropType<D extends PropDefinition> =
  D extends PropDefinition<infer V> ? V : never
```

`infer` 是 TS 唯一的"从既有类型里反解变量"的通道,和正则的捕获组一个地位:`PropDefinition<infer V>` 是模式,`V` 是捕获组。

### 8. ExtractPropTypes 映射时丢了"逐字段"而写成整体

```ts
// ❌ 错误写法:不映射,直接对整体做 Infer
export type ExtractPropTypes<D extends Record<string, PropDefinition>> =
  InferPropType<D[keyof D]>  // ← 这只推"某个值"的类型
```

现象:`D[keyof D]` 是**所有字段定义的联合**,Infer 出来是所有类型的联合(此例 `'primary'|'ghost' | string | ...`),`Inner['type']` 不再和字段一一对应,形状信息全丢。

```ts
// ✅ 正确姿势:同构映射,键保持不变、值逐字段 Infer
{ [K in keyof D]: InferPropType<D[K]> }
```

`[K in keyof D]` 的同构性(homomorphic)还有个红利:保留入参的 optional/readonly 修饰 —— 不过本题 PropDefinition 的字段全是必选,红利用不上,在别的场景会救命。

## 三、思考题参考答案

**Q1:`Partial<T>` 和默认值对象是什么关系?为什么默认值对象只能是"部分字段"?**

`Partial<ButtonProps>` 是"父组件传参的合法形状"(每个字段都可省);默认值对象是它的一个**实例**,额外性质是"值永远是字面量(as const)"。只能部分:全字段都有默认值意味着父组件可以 `{}` 空传,Props 就失去约束意义了;更重要的是 Partial **不记录**"哪些字段有默认值"这个信息 —— 所以 ResolveProps 的 D 参数必须用精确形状(ButtonPropsDefaults),`ResolveProps<T, Partial<T>>` 什么都推不出来(所有字段都可能"有默认值"也都可能没有)。**类型不只是"合法值集",还是"携带信息的精确描述"** —— 这就是为什么 as const 后的 typeof 比 Partial 有用得多。

**Q2(README Part 2 埋的问题):`ResolveProps` 里"必有值"的类型为什么是 `T[K]` 而不是默认值的字面量?**

`withDefaults(props, { size: 'md' })` 之后组件里 `props.size` 的类型是 `'sm' | 'md' | 'lg'` 全联合 —— 因为用户**可以**传 `'lg'` 覆盖默认值,组件内部必须处理所有取值。把类型收成 `'md'` 是过度窄化,会让 `if (props.size === 'lg')` 这种分支被判不可达。默认值的字面量类型属于默认值对象(ButtonPropsDefaults),不属于合并结果 —— 两个视角、两套类型,不能混。

**Q3(README Part 3):`type: () => T` 为什么要用函数而不是直接写类型?**

因为这里模拟的是**运行时对象**(Vue 的 props 选项是 JS 对象,值只能是值)。JS 里没有"类型的值",但函数是值、函数的返回类型是类型 —— `() => 'md'` 这个**值**携带了 `'md'` 的类型信息。`type: (): 'sm'|'md'|'lg' => 'md'` 的显式标注是为了防字面量宽化(函数返回 'md' 会被推宽成 string)。这就是"运行时定义反推类型"的桥梁:值层面的 `() => T` ↔ 类型层面的 `T`,靠 infer 互通。Vue 真源码里用的是构造器(String / Number),`() => T` 是无依赖环境的同构简化。

**Q4:`Partial<T>`、`ResolveProps`、`ExtractPublicPropTypes` 分别对应 Vue 的哪一层?**

- `Partial<ButtonProps>` ≈ `defineProps` 的**父组件传参面**(可省字段 + 类型检查)—— 对应 Vue 内部的公共 Props;
- `ResolveProps` ≈ `withDefaults` 之后的**组件内视图**(默认字段必有值)—— 对应 Vue 的 `resolveProps` / setup 里的 props;
- `ExtractPublicPropTypes` ≈ 运行时 props 定义(`props: { type: { type: String, required: true } }`)反推出的**类型层**,再倒过来约束模板里的使用 —— Vue 单文件组件没有 TS 类型时的补课通道。
一句话:同一个 prop 在"作者声明 / 使用者传入 / 内部消费"三个位置有三种形状,类型工程就是把这三张脸分别建型再用工具类型互推。

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错、`pnpm test` 全绿(本 day 18 个用例)
- [ ] 零 `any`、零 `as`(本 day 类型层完全可推,这是与 Day 11/12 的本质区别)
- [ ] `ButtonProps`:必选 type/label;可选 size/disabled/loading;显式 undefined 报错(eOPT)
- [ ] `buttonDefaults` 加了 as const;赋 `Partial<ButtonProps>` 通过;不加 as const 的赋不进去
- [ ] `ResolveProps`:有默认值字段变必选、类型 `NonNullable<T[K]>`;无默认字段照旧(含 `| undefined`)
- [ ] 坑 a 用 `K extends keyof T ? T[K] : never` 守门;坑 b 用 NonNullable 剥 undefined
- [ ] `resolveButtonProps` 的 spread 顺序是 `{ ...defaults, ...props }`(用户值覆盖默认值)
- [ ] `PropDefinition.required` 是字面量 `true`;`default` 类型与 `type` 联动
- [ ] `InferPropType` 用 `PropDefinition<infer V>` 反解
- [ ] `ExtractPropTypes` 同构映射全必有值;`ExtractPublicPropTypes` 用 key remapping 分拣 required
- [ ] 能说清三个类型对应 Vue 的哪一层(传参面 / withDefaults 后 / 运行时定义反推)
