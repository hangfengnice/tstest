/**
 * Day 16 — 给 JS 模块补 .d.ts:类型收窄 wrapper + 模块扩充 + 全局声明
 *
 * 学习目标:
 *   1. 手写 .d.ts 是"契约":可以比真实实现更窄(把狂野 JS 驯服成安全 API)
 *   2. unknown 出口 + 类型守卫收窄(Day 4 复习)
 *   3. declare module 模块扩充 / declare global 全局声明
 *
 * 本文件的分工:
 *   - legacy-config.d.ts  ← 主战场(把 never 换成精确类型)
 *   - 本文件              ← 读 unknown 出口的守卫 wrapper + 两处声明扩充
 */

// =============================================================
// Part 2 — 🟡 守卫 wrapper(Day 4 复习):unknown 出口收窄
// =============================================================

// TODO: 主题模式 —— 'light' | 'dark' | 'auto'
export type ThemeMode = never // ← 替换

// TODO: 功能开关 —— { compact: boolean; beta: boolean }
export type FeatureFlags = never // ← 替换

/**
 * 主题模式守卫 —— 老模块出口是 unknown,收窄全靠它(签名已给)
 *
 * @example
 *   const raw: unknown = getConfig('theme')
 *   if (isThemeMode(raw)) {
 *     raw  // 这里已经是 ThemeMode
 *   }
 */
export function isThemeMode(value: unknown): value is ThemeMode {
  // TODO: 用 typeof + includes 收窄
  void value
  throw new Error('TODO')
}

/**
 * 读主题配置;非法值或未配置时返回 'auto'(签名已给)
 *
 * @example
 *   setConfig('theme', 'dark')
 *   readThemeMode()  // => 'dark'
 */
export function readThemeMode(): ThemeMode {
  // TODO: getConfig('theme') 拿到 unknown,用 isThemeMode 收窄
  throw new Error('TODO')
}

/**
 * 读两个布尔开关键 'flags.compact' / 'flags.beta';任何一个不是布尔就抛错(签名已给)
 *
 * @example
 *   setConfig('flags.compact', true)
 *   setConfig('flags.beta', false)
 *   readFeatureFlags()  // => { compact: true, beta: false }
 */
export function readFeatureFlags(): FeatureFlags {
  // TODO: 两个 unknown 分别 typeof 收窄
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 🔴 声明扩充
// =============================================================

// TODO: LegacyGlobalInfo —— { host: string; timeoutMs: number }
export type LegacyGlobalInfo = never // ← 替换

// TODO: 把下面的 never 换成 LegacyGlobalInfo ——
// 老页面用 <script> 把配置挂在全局 __LEGACY_CONFIG__ 上,给它补类型
declare global {
  var __LEGACY_CONFIG__: never // ← 替换
}

// TODO: RenderPieFn —— 先在下方用 declare module 扩充 'legacy-charts'(补 renderPie),
// 再把 renderPie 的函数类型取出来(typeof)。扩充写在哪个位置都能对整个文件生效。
//
// declare module 'legacy-charts' {
//   export function renderPie(el: string, points: readonly ChartPoint[]): number
// }
export type RenderPieFn = never // ← 替换
