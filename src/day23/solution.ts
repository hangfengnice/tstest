/**
 * Day 23 — 递归类型:DeepPartial / DeepReadonly / 树结构与路径
 *
 * 学习目标:
 *   1. 自引用类型别名(FileTreeNode)
 *   2. 递归映射 + 条件类型(DeepPartial / DeepReadonly,数组分支必须单独处理)
 *   3. 运行时递归(findNode)与类型递归(Path)的对照
 *
 * 规则:
 *   - never 占位处写实现;throw new Error('TODO') 处填逻辑
 *   - 不允许 any
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// 脚手架(已给出):业务数据
// =============================================================

/**
 * 工作区设置 —— chipRunner 的用户设置。
 * 三层嵌套 + 一个数组字段(quickActions):
 * DeepPartial / DeepReadonly 都必须正确处理到每一层。
 *
 * @example
 *   const settings: WorkspaceSettings = {
 *     editor: { fontSize: 14, tabSize: 2, minimap: true },
 *     theme: { name: 'dark', accent: '#0ea5e9' },
 *     quickActions: [{ label: '保存', command: 'workbench.save' }],
 *   }
 */
export interface WorkspaceSettings {
  editor: { fontSize: number; tabSize: number; minimap: boolean }
  theme: { name: 'light' | 'dark'; accent: string }
  quickActions: { label: string; command: string }[]
}

// =============================================================
// Part 1 — 🟢 自引用类型 + DeepPartial
// =============================================================

/**
 * 文件树节点 —— 资源管理器(explorer)的树结构。
 * **自引用**:children 的元素类型就是 FileTreeNode 自己。
 * 形状从 solution.test.ts 反推(三个字段,children 可选)。
 *
 * @example
 *   const node: FileTreeNode = {
 *     id: 'src',
 *     name: 'src',
 *     children: [{ id: 'main', name: 'main.ts' }],
 *   }
 */
export type FileTreeNode = never // ← 替换

/**
 * 深度可选 —— 递归地把所有层的对象属性变成可选。
 * 数组字段:数组本身保留,元素类型继续递归 DeepPartial。
 * 用途:配置 PATCH、表单草稿 —— "只改到的字段才出现"。
 *
 * @example
 *   const patch: DeepPartial<WorkspaceSettings> = {
 *     editor: { fontSize: 15 }, // 只改一项,其余全部可省
 *   }
 */
export type DeepPartial<T> = never // ← 替换

// =============================================================
// Part 2 — 🟡 DeepReadonly + 深合并
// =============================================================

/**
 * 深度只读 —— 递归地把所有层属性变成 readonly。
 * 数组分支必须产出 readonly E[](readonly 数组),
 * 否则 push 依然可用,冻结就是假的。
 *
 * JSDoc 思考题:数组分支为什么不能直接套 { readonly [K in keyof T]: ... }?
 *
 * @example
 *   const frozen: DeepReadonly<WorkspaceSettings> = defaults
 *   // frozen.editor.fontSize = 99  // ← 编译报错
 */
export type DeepReadonly<T> = never // ← 替换

/**
 * 深合并 —— patch 覆盖 base,返回完整 T。
 * 规则:两边都是普通对象 → 递归合并;
 *       数组 / 原始值 → patch 有值就整体替换。
 *
 * @example
 *   const next = deepMerge(defaults, { theme: { accent: '#f43f5e' } })
 *   next.theme.name // 仍是 defaults 里的 name(未覆盖字段保留)
 */
export function deepMerge<T extends object>(
  base: T,
  patch: DeepPartial<T>,
): T {
  void base
  void patch
  throw new Error('TODO')
}

// =============================================================
// Part 3 — 🔴 运行时递归 + 类型递归
// =============================================================

/**
 * 在文件树里先序遍历(自己 → 从左到右子树)查找节点。
 * 找不到必须返回 undefined(返回类型不能丢 undefined)。
 *
 * @example
 *   findNode(fileTree, 'app')  // => { id: 'app', name: 'App.vue' }
 *   findNode(fileTree, 'nope') // => undefined
 */
export function findNode(root: FileTreeNode, id: string): FileTreeNode | undefined {
  void root
  void id
  throw new Error('TODO')
}

/**
 * 树的路径(简化版)—— 给定字面量树类型(children 必须是**元组**),
 * 推导出所有"从根到任意节点"的路径字符串联合,用 / 连接。
 *
 * @example
 *   type T = { name: 'src'; children: [{ name: 'main.ts' }] }
 *   type P = Path<T>  // => 'src' | 'src/main.ts'
 */
export type Path<T> = never // ← 替换
