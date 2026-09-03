// =============================================================
// 2017 年的遗产代码 —— 通知中心的配置模块(纯 JS,没有类型)
//
// 规则:这个文件**一个字都不许改**。它在运行时是好的,改了线上就炸。
// 你的工作是在 legacy-config.d.ts 里给它补类型(Day 16 的题面)。
//
// 为什么不直接开 allowJs + checkJs?
//   1. checkJs 只能靠 JSDoc 猜类型,动态 JS 推出来的多半是 any;
//   2. 仓库 tsconfig 的 include 是 src/**/*,开 allowJs 会把所有 JS 拉进编译;
//   3. 手写 .d.ts 是"契约":允许你声明一个**比真实实现更窄**的合法输入集,
//      把 2017 年的狂野 API 驯服成 2026 年的类型安全 API。
// =============================================================

const store = new Map()

export const CONFIG_VERSION = '3.2.1'

/** 读配置;没有这个 key 就返回 fallback(不传 fallback 就是 undefined) */
export function getConfig(key, fallback) {
  const value = store.get(key)
  return value === undefined ? fallback : value
}

/** 写配置;返回写入前的旧值(没有旧值就是 undefined) */
export function setConfig(key, value) {
  const prev = store.get(key)
  store.set(key, value)
  return prev
}

/** 是否存在这个 key */
export function hasConfig(key) {
  return store.has(key)
}

/** 删除;返回是否真的删了 */
export function deleteConfig(key) {
  return store.delete(key)
}

/** 所有 key,按字典序排序 */
export function listKeys() {
  return Array.from(store.keys()).sort()
}
