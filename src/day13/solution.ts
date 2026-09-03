/**
 * Day 13 — Vue Props 类型设计(纯 TS 模拟,不 import vue)
 *
 * 学习目标:
 *   1. Props 接口:必选/可选,exactOptionalPropertyTypes 下的 undefined 反例
 *   2. 默认值对象:as const、与 Partial<Props> 的关系、ResolveProps(可选传入 → 必有值)
 *   3. 🔴 手写简化版 ExtractPropTypes / ExtractPublicPropTypes(Vue 源码同款技巧)
 *
 * 规则:
 *   - 不允许 any;允许 unknown + 类型守卫
 *   - 所有 export 必须有 JSDoc + @example
 *   - 类型占位是 never(泛型占位用 & never 先"用掉"泛型参数),函数体 throw new Error('TODO')
 */

// =============================================================
// Part 1 — 基础:Props 接口
// =============================================================

/**
 * 按钮组件的 Props —— 组件作者视角的"完整形状"。
 *
 * 规格:必选 type(风格)/ label(文案);
 * 可选 size / disabled / loading(exactOptionalPropertyTypes 下
 * 不允许显式传 undefined,只能省略)。
 *
 * @example
 *   const p: ButtonProps = { type: 'ghost', label: '取消' }
 */
export interface ButtonProps {
  type: never // ← 替换
  label: never // ← 替换
  size: never // ← 替换(可选)
  disabled: never // ← 替换(可选)
  loading: never // ← 替换(可选)
}

// =============================================================
// Part 2 — 进阶:默认值对象与 ResolveProps
// =============================================================

/**
 * 按钮默认值对象 —— withDefaults 的 defaults 参数。
 *
 * 规格:size 默认 'md',disabled 默认 false。
 * **必须 as const**:不加时 'md' 会被宽化成 string,
 * 就不再满足 Partial<ButtonProps> 了(size 的类型对不上)。
 *
 * @example
 *   const check: Partial<ButtonProps> = buttonDefaults  // 编译通过
 */
export const buttonDefaults = {} as const // ← 替换:补上 size / disabled 两项

/**
 * 默认值对象的类型。
 *
 * @example
 *   type D = ButtonPropsDefaults  // { readonly size: 'md'; readonly disabled: false }
 */
export type ButtonPropsDefaults = typeof buttonDefaults

/**
 * 应用默认值后的 Props(组件内部视角):
 * 有默认值的字段从"可选"变成"必有值"(类型还是 T[K],不是字面量);
 * 没默认值的字段原样保留。
 *
 * 提示:
 *   - Omit<T, keyof D>:去掉有默认值的字段
 *   - 映射 { [K in keyof D]: ... }:让它们重新出现、变为必选
 *   - 两个坑:直接写 T[K] 会因为"索引访问可选属性"混进 undefined(想想 NonNullable);
 *     直接写 T[K] 还会被 TS 拦"K 不能索引 T"(想想条件类型守门)
 *
 * @example
 *   type R = ResolveProps<ButtonProps, ButtonPropsDefaults>
 *   const r: R = { type: 'primary', label: '保存', size: 'md', disabled: false, loading: true }
 *   // r.size 的类型是 'sm' | 'md' | 'lg'(不是 'md' 字面量,也不是 undefined)
 */
export type ResolveProps<T, D extends Partial<T>> = [T, D] & never // ← 替换(占位结果就是 never)

/**
 * 把外部传入的 props(有默认值的字段可省)合并默认值,
 * 返回组件内部视角的"全量必有值" props。
 *
 * @example
 *   resolveButtonProps({ type: 'primary', label: '保存' })
 *   // => { type: 'primary', label: '保存', size: 'md', disabled: false }
 */
export function resolveButtonProps(
  props: ButtonProps,
): ResolveProps<ButtonProps, ButtonPropsDefaults> {
  // TODO: spread 合并 props 与 buttonDefaults(可选字段缺省时取默认值)
  void props
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 边界:手写简化版 ExtractPropTypes
// =============================================================

/**
 * 单个 prop 的运行时定义(模拟 Vue 的 props 选项)。
 *
 * 规格:
 *   type: () => T —— 用"类型构造器"表达类型(测试里写 () => 'sm'|'md'|'lg' 这种,显式标注避免宽化);
 *   required?: true —— 注意是字面量 true,不是 boolean(供条件类型判断);
 *   default?: T —— 默认值,类型跟着 type 走。
 *
 * @example
 *   const def: PropDefinition<'sm' | 'md' | 'lg'> = {
 *     type: (): 'sm' | 'md' | 'lg' => 'md',
 *   }
 */
export interface PropDefinition<T = unknown> {
  type: T & never // ← 替换(占位)
  required?: boolean & never // ← 替换(占位;注意最终形态是字面量 true)
  default?: T & never // ← 替换(占位)
}

/**
 * 从单个 prop 定义推断出类型 V。
 *
 * 提示:PropDefinition<infer V> —— infer 在条件类型里"抓出"泛型实参。
 *
 * @example
 *   type S = InferPropType<{ type: () => string; required: true }>  // => string
 */
export type InferPropType<D extends PropDefinition> = D & never // ← 替换(占位结果就是 never)

/**
 * 组件内部视角:所有 prop 都有值(和 Vue 的 ExtractPropTypes 同义)。
 *
 * 提示:{ [K in keyof D]: InferPropType<D[K]> } —— 同构映射逐字段推断。
 *
 * @example
 *   type Inner = ExtractPropTypes<typeof buttonPropDefs>
 *   // { type: 'primary'|'ghost'; label: string; size: 'sm'|'md'|'lg'; disabled: boolean }
 */
export type ExtractPropTypes<D extends Record<string, PropDefinition>> =
  D & never // ← 替换(占位结果就是 never)

/**
 * 父组件传参视角(模拟 Vue 的 ExtractPublicPropTypes):
 * required: true 的必选,其余可选。
 *
 * 提示:key remapping —— `[K in keyof D as 条件 ? K : never]` 把键按条件过滤,
 * 配合两个分支(一个不加 ?、一个加 ?)实现"有的必选、有的可选"。
 *
 * @example
 *   type Public = ExtractPublicPropTypes<typeof buttonPropDefs>
 *   const ok: Public = { type: 'primary', label: '保存' }  // size/disabled 可省
 */
export type ExtractPublicPropTypes<D extends Record<string, PropDefinition>> =
  D & never // ← 替换(占位结果就是 never)
