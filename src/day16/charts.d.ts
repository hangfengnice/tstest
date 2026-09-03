/**
 * ambient 模块声明:'legacy-charts' —— 模拟一个通过 <script> 标签加载的老图表库
 *
 * 这个文件模拟"vendor 只提供了不完整的类型":有 ChartPoint、有 renderBar,
 * **但没有 renderPie**( vendor 2019 年就停止维护了,而 renderPie 在运行时明明存在)。
 * 你在 solution.ts 里用 `declare module 'legacy-charts' { ... }` 做模块扩充,把 renderPie 补上。
 *
 * 注意:'legacy-charts' 没有真实模块文件,只能 `import type`,import 的值位置会被擦除。
 */

declare module 'legacy-charts' {
  /** 图表数据点 */
  export interface ChartPoint {
    x: number
    y: number
    /** 可选的数据点标签 */
    label?: string
  }

  /** 渲染柱状图,返回图表 DOM 的 id */
  export function renderBar(el: string, points: ChartPoint[]): string
}
