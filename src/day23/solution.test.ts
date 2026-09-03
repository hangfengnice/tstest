import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  deepMerge,
  findNode,
  type WorkspaceSettings,
  type FileTreeNode,
  type DeepPartial,
  type DeepReadonly,
  type Path,
} from './solution.js'

// =============================================================
// 测试数据(顶层只放纯数据,函数调用全部在 it 内)
// =============================================================

const defaultSettings: WorkspaceSettings = {
  editor: { fontSize: 14, tabSize: 2, minimap: true },
  theme: { name: 'dark', accent: '#0ea5e9' },
  quickActions: [
    { label: '保存', command: 'workbench.save' },
    { label: '搜索', command: 'workbench.search' },
  ],
}

const fileTree: FileTreeNode = {
  id: 'root',
  name: 'src',
  children: [
    {
      id: 'comp',
      name: 'components',
      children: [
        { id: 'app', name: 'App.vue' },
        { id: 'icon', name: 'Icon.vue' },
      ],
    },
    {
      id: 'hooks',
      name: 'hooks',
      children: [{ id: 'theme', name: 'useTheme.ts' }],
    },
    { id: 'main', name: 'main.ts' },
  ],
}

// 字面量树(children 是元组!)—— Path<T> 的输入
type LiteralTree = {
  name: 'src'
  children: [
    {
      name: 'components'
      children: [{ name: 'App.vue' }, { name: 'Icon.vue' }]
    },
    { name: 'hooks'; children: [{ name: 'useTheme.ts' }] },
    { name: 'main.ts' },
  ]
}

// =============================================================
// Part 1 — 自引用类型 + DeepPartial
// =============================================================

describe('Day 23 — Part 1 FileTreeNode / DeepPartial', () => {
  it('FileTreeNode 形状正确(自引用,children 可选)', () => {
    expectTypeOf<FileTreeNode>().toEqualTypeOf<{
      id: string
      name: string
      children?: FileTreeNode[]
    }>()
  })

  it('DeepPartial:所有层的属性都可选,数组元素也递归', () => {
    expectTypeOf<DeepPartial<WorkspaceSettings>>().toEqualTypeOf<{
      editor?: { fontSize?: number; tabSize?: number; minimap?: boolean }
      theme?: { name?: 'light' | 'dark'; accent?: string }
      quickActions?: { label?: string; command?: string }[]
    }>()
  })

  it('DeepPartial 不等于完整 Settings:部分对象不能冒充完整配置', () => {
    // 可选字段落在哪里都能省 —— 部分更新合法
    const patch: DeepPartial<WorkspaceSettings> = { editor: { fontSize: 15 } }
    expectTypeOf(patch.editor?.fontSize).toEqualTypeOf<number | undefined>()
    // 但 DeepPartial 不是 WorkspaceSettings 的子集方向:完整类型要求必填
    expectTypeOf<DeepPartial<WorkspaceSettings>>().not.toMatchTypeOf<WorkspaceSettings>()
  })
})

// =============================================================
// Part 2 — DeepReadonly + deepMerge
// =============================================================

describe('Day 23 — Part 2 DeepReadonly', () => {
  it('DeepReadonly:所有层 readonly,数组变成 readonly 数组', () => {
    expectTypeOf<DeepReadonly<WorkspaceSettings>>().toEqualTypeOf<{
      readonly editor: {
        readonly fontSize: number
        readonly tabSize: number
        readonly minimap: boolean
      }
      readonly theme: { readonly name: 'light' | 'dark'; readonly accent: string }
      readonly quickActions: readonly {
        readonly label: string
        readonly command: string
      }[]
    }>()
  })

  it('readonly 数组不能冒充可变数组(没有 push 等修改方法)', () => {
    // readonly T[] 不能赋给 T[](缺 push/splice 等修改方法),结构上不兼容。
    // 所以 DeepReadonly 若忘了处理数组分支,这条断言就会失败。
    type FrozenQuickActions = DeepReadonly<WorkspaceSettings>['quickActions']
    expectTypeOf<FrozenQuickActions>().not.toMatchTypeOf<
      { label: string; command: string }[]
    >()
  })
})

describe('Day 23 — Part 2 deepMerge(运行时深合并)', () => {
  it('嵌套对象递归合并,未覆盖字段保留', () => {
    const next = deepMerge(defaultSettings, {
      editor: { fontSize: 18 },
      theme: { accent: '#f43f5e' },
    })
    expect(next.editor.fontSize).toBe(18)
    expect(next.editor.tabSize).toBe(defaultSettings.editor.tabSize)
    expect(next.editor.minimap).toBe(true)
    expect(next.theme.accent).toBe('#f43f5e')
    expect(next.theme.name).toBe(defaultSettings.theme.name)
  })

  it('数组整体替换,不逐项合并', () => {
    const next = deepMerge(defaultSettings, {
      quickActions: [{ label: '运行', command: 'chip.run' }],
    })
    expect(next.quickActions).toHaveLength(1)
    expect(next.quickActions[0]?.command).toBe('chip.run')
  })

  it('空 patch 返回等值配置,类型仍是完整的 WorkspaceSettings', () => {
    const next = deepMerge(defaultSettings, {})
    expectTypeOf(next).toEqualTypeOf<WorkspaceSettings>()
    expect(next).toEqual(defaultSettings)
  })
})

// =============================================================
// Part 3 — findNode(运行时递归)+ Path(类型递归)
// =============================================================

describe('Day 23 — Part 3 findNode', () => {
  it('命中根节点自身', () => {
    expect(findNode(fileTree, 'root')?.name).toBe('src')
  })

  it('递归找到深层节点', () => {
    expect(findNode(fileTree, 'app')?.name).toBe('App.vue')
    expect(findNode(fileTree, 'theme')?.name).toBe('useTheme.ts')
  })

  it('找不到返回 undefined,返回类型也带 undefined', () => {
    expect(findNode(fileTree, 'not-exist')).toBeUndefined()
    expectTypeOf(findNode(fileTree, 'root')).toEqualTypeOf<
      FileTreeNode | undefined
    >()
  })

  it('id 必须是 string', () => {
    // @ts-expect-error —— id 参数是 string,不能传 number
    findNode(fileTree, 123)
  })
})

describe('Day 23 — Part 3 Path<T>(类型递归)', () => {
  it('推导出所有从根到任意节点的路径(含中间节点)', () => {
    expectTypeOf<Path<LiteralTree>>().toEqualTypeOf<
      | 'src'
      | 'src/components'
      | 'src/components/App.vue'
      | 'src/components/Icon.vue'
      | 'src/hooks'
      | 'src/hooks/useTheme.ts'
      | 'src/main.ts'
    >()
  })

  it('合法路径可赋值,非法路径编译报错', () => {
    const p: Path<LiteralTree> = 'src/components'
    void p
    // @ts-expect-error —— 'src/typings' 不在合法路径联合里
    const bad: Path<LiteralTree> = 'src/typings'
    void bad
  })
})
