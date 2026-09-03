/**
 * Day 7 — 手写工具类型:MyPartial / MyRequired / MyReadonly / MyPick / MyOmit
 *
 * 学习目标:
 *   1. 映射类型 + 修饰符(? / readonly / -?)—— 工具类型的全部秘密就这两块积木
 *   2. 同态映射保留修饰符;民间直接映射写 Omit 会丢 ?(实验见 README Part 2)
 *   3. exactOptionalPropertyTypes 下可选属性不接受显式 undefined
 *
 * 规则:
 *   - 五个 My* 必须手写,不许用内置的同名工具凑数
 *   - 零 any、零 as
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// Part 1 — 业务类型 + 可选 / 必填
// =============================================================

// TODO: ChipMeta —— 注意 readonly createdAt 和可选 description(见 README)
export type ChipMeta = never // ← 替换

// TODO: MyPartial<T> —— 所有属性变可选(同态映射)
export type MyPartial<T> = never // ← 替换

// TODO: MyRequired<T> —— 移除可选(-? 修饰符)
// JSDoc 里回答:-? 除了去掉 ?,对属性类型里的 | undefined 还做了什么?
export type MyRequired<T> = never // ← 替换

// =============================================================
// Part 2 — 只读与投影
// =============================================================

// TODO: MyReadonly<T> —— 加 readonly 修饰符
export type MyReadonly<T> = never // ← 替换

// TODO: MyPick<T, K extends keyof T> —— 只保留指定键(同态:保留 readonly 和 ?)
export type MyPick<T, K extends keyof T> = never // ← 替换

// TODO: MyOmit<T, K extends keyof T> —— 排除指定键(推荐:用你刚写的 MyPick 组合)
// JSDoc 里记下实验结论:
//   1. 直接映射 {[P in Exclude<keyof T, K>]: T[P]} 与内置 Omit 的差异在哪?(提示:description 的 ? 和 undefined)
//   2. 为什么组合 MyPick 的写法才和内置完全对等?
export type MyOmit<T, K extends keyof T> = never // ← 替换

// =============================================================
// Part 3 — 组合拳 + exactOptionalPropertyTypes
// =============================================================

// TODO: EditPatch —— MyPartial<MyOmit<ChipMeta, 'id' | 'createdAt'>>
export type EditPatch = never // ← 替换

/**
 * 表单初始值:剔除系统字段,其余可编辑字段原样带出
 *
 * 坑:exactOptionalPropertyTypes 下,description 为空时不能写 description: undefined,
 * 只能不写这个键
 *
 * @example
 *   toEditForm({ id: 'chip_1', name: 'f', ownerEmail: 'a@b.c', createdAt: 't' })
 *   // => { name: 'f', ownerEmail: 'a@b.c' } —— 没有 description 键
 */
export function toEditForm(meta: ChipMeta): EditPatch {
  // TODO: 手动构造;直接 {...meta} 和 description: meta.description 都会报错,想想为什么
  void meta
  throw new Error('TODO')
}

/**
 * 不可变合并:patch 覆盖,其余保留(description 不在 patch 里就保留原值)
 *
 * @example
 *   applyEdit(meta, { name: '新名字' })  // => { ...meta, name: '新名字' }
 */
export function applyEdit(base: ChipMeta, patch: EditPatch): ChipMeta {
  // TODO: 对象展开,一行,零 as
  void base
  void patch
  throw new Error('TODO')
}
