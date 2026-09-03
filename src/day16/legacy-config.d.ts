/**
 * legacy-config.js 的手写声明(骨架)—— Day 16 的主战场
 *
 * 现在所有类型都是 never 占位。你要做的:
 *   1. 把每个 never 换成精确类型(行为看 legacy-config.js 的注释和 solution.test.ts)
 *   2. CONFIG_VERSION 精确到字面量(它是常量,读 js 源码就知道值)
 *   3. getConfig 需要**函数重载**:不传 fallback 返回 unknown(无类型的 JS!);
 *      传了 fallback(T)返回 T
 *   4. 定义 ConfigValue = string | number | boolean 作为 setConfig 的值契约 ——
 *      运行时其实什么都收,但契约上"我们不接受对象"(这正是手写 d.ts 的意义)
 */

// TODO: 版本常量,精确到字面量
export const CONFIG_VERSION: never // ← 替换

// TODO: 配置值的合法契约(string | number | boolean)
export type ConfigValue = never // ← 替换

// TODO: getConfig 的重载(无 fallback => unknown;有 fallback T => T)
export function getConfig(key: never, fallback?: never): never // ← 替换:占位签名是错的

// TODO: setConfig —— key: string;value 只收 ConfigValue;返回旧值
export function setConfig(key: never, value: never): never // ← 替换

// TODO: hasConfig / deleteConfig / listKeys
export function hasConfig(key: never): never // ← 替换
export function deleteConfig(key: never): never // ← 替换
export function listKeys(): never // ← 替换
