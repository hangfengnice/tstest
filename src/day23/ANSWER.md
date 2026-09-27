# Day 23 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 23` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试(14/14,vitest typecheck 模式双跑 28/28)+ `pnpm typecheck` 该目录零错误。

```ts
export interface WorkspaceSettings {
  editor: { fontSize: number; tabSize: number; minimap: boolean }
  theme: { name: 'light' | 'dark'; accent: string }
  quickActions: { label: string; command: string }[]
}

// Part 1:自引用 —— children 可选:有 children 的是目录,没有的是文件
export type FileTreeNode = {
  id: string
  name: string
  children?: FileTreeNode[]
}

// Part 1:深可选 —— 映射管第一层,值列对 T[K] 三分流:数组/函数/对象/原始值
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer E)[]
    ? DeepPartial<E>[]
    : T[K] extends (...args: never[]) => unknown
      ? T[K]
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K]
}

// Part 2:深只读 —— 数组分支显式产出 readonly E[](ReadonlyArray)
export type DeepReadonly<T> = T extends (infer E)[]
  ? readonly DeepReadonly<E>[]
  : T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

// Part 2:深合并 —— 对象递归合并、数组/原始值整体替换
export function deepMerge<T extends object>(
  base: T,
  patch: DeepPartial<T>,
): T {
  const out = { ...base }
  for (const key in patch) {
    const v = patch[key]
    if (v === undefined) continue
    const b = out[key]
    if (isPlainObject(b) && isPlainObject(v)) {
      // as #1:递归合并走宽类型内核,"结果仍是这一键的原类型"由守卫保证
      out[key] = mergeLoose(b, v) as T[typeof key]
    } else {
      // as #2:数组整体替换,"patch 数组元素运行时完整"是业务约定,类型证不出来
      out[key] = v as T[typeof key]
    }
  }
  return out
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mergeLoose(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(patch)) {
    const v = patch[key]
    if (v === undefined) continue
    const b = out[key]
    if (isPlainObject(b) && isPlainObject(v)) {
      out[key] = mergeLoose(b, v)
    } else {
      out[key] = v
    }
  }
  return out
}

// Part 3:先序遍历查找,undefined 不丢
export function findNode(
  root: FileTreeNode,
  id: string,
): FileTreeNode | undefined {
  if (root.id === id) return root
  for (const child of root.children ?? []) {
    const found = findNode(child, id)
    if (found !== undefined) return found
  }
  return undefined
}

// Part 3:路径联合 —— 分支节点 = 自己 ∪ (自己 + '/' + 每条子路径)
export type Path<T> = T extends { name: infer N extends string }
  ? T extends { children: readonly (infer C)[] }
    ? N | `${N}/${Path<C>}`
    : N
  : never
```

## 二、常见错误写法(点评人视角)

以下每条都先用 tsc 实测过现象再写,不是理论推测。

### 1. FileTreeNode 的 children 写成必填

```ts
❌ export type FileTreeNode = { id: string; name: string; children: FileTreeNode[] }
```

现象:测试第一条 `toEqualTypeOf<{...; children?: FileTreeNode[]}>` 直接挂
—— 必填 ≠ 可选。更要紧的是语义:树必须有**叶子**,"每个节点都有 children"
意味着每个文件都得挂个空数组,"文件 vs 目录"的区别被类型抹掉了。
自引用 + 可选 = 树的正确建模。

### 2. DeepPartial 只写一层(README 明示的坑)

```ts
❌ export type DeepPartial<T> = { [K in keyof T]?: T[K] }
```

现象:嵌套断言挂 —— `editor` 变可选了,但 `editor.fontSize` **没有**变可选
(`{ fontSize?: number }` vs `{ fontSize: number }`,toEqualTypeOf 不等)。
`?` 修饰符只作用于本次映射的键列,值列 `T[K]` 是原样引用;
要让内层也可选,值列必须递归。

### 3. 值列分支把数组当普通对象递归(分支顺序坑)

```ts
❌ export type DeepPartial<T> = {
     [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
   }
```

同态可选映射仍保留数组身份，但会使元素位置可选，元素类型可能包含 undefined，
与本题“数组元素仍须存在、只把元素字段变可选”的目标不同。
本题 DeepPartial 的数组元素处理与同态可选映射不同，应先识别数组。函数也要先识别(函数也是 object,
被映射后函数类型面目全非),所以参考实现是四段式:数组 → 函数 → 对象 → 原始值。

### 4. DeepReadonly 数组分支忘了 readonly 前缀(实测必踩)

```ts
❌ T extends (infer E)[] ? DeepReadonly<E>[] : ...
```

现象:产物是**可变**数组 —— `frozen.quickActions.push(x)` 编译通过!
测试"readonly 数组不能冒充可变数组"挂:`{readonly label: string}[]`
仍可赋给 `{label: string}[]`(属性 readonly 不影响赋值兼容),
所以 `not.toMatchTypeOf` 断言失败。本实现中只读数组使用
`readonly E[]`(ReadonlyArray):它的方法面里**根本没有** push/splice。

```ts
✅ T extends (infer E)[] ? readonly DeepReadonly<E>[] : ...
```

### 5. DeepPartial 的数组分支照抄 readonly(两个深工具的语义差异)

```ts
❌ // DeepPartial 里写: T[K] extends (infer E)[] ? readonly DeepPartial<E>[] : ...
```

现象:DeepPartial 是给 **PATCH** 用的 —— patch 里的数组要**整体替换**
原数组(新数组赋给字段),字段类型若被改成 readonly 数组,
调用方反而没法把可变数组放进 patch。测试断言 `quickActions?: {...}[]`
是可变数组,写 readonly 前缀直接挂。记忆法:**DeepReadonly 冻结、
DeepPartial 放行**,数组分支一个加 readonly 一个不加,不是抄漏,是语义。

### 6. 对键列做"手术"导致数组身份丢失(隐蔽的坑)

```ts
❌ type X<T> = T extends object ? { readonly [K in keyof T as K]: X<T[K]> } : T
```

现象:实测 `[K in keyof T as K]` 让映射**失去同构性**,数组不再被特殊对待,
产物变成"键为数字和一堆方法名的普通对象"—— 方法经过值列递归后
类型直接坏掉(实测 push 变成 `{}`,TS2349 不可调用;对象本身也构造不出来)。
同构映射(`[K in keyof T]` 原样写)才会触发"数组保持数组"的特殊规则;
as 重映射、`Exclude<keyof T, ...>`、`keyof T & string` 这类键列操作
都会悄悄丢掉这个待遇。这是 Day 21 学的 as 重映射在这里的暗礁。

### 7. deepMerge 没有跳过 undefined 的字段

```ts
❌ for (const key in patch) {
     out[key] = patch[key] ?? out[key]   // 或干脆 out[key] = patch[key]
   }
```

现象:patch 里**没写**的键,有的实现会用 `in` 遍历到 undefined 后把
base 的值覆盖坏;更常见的是忘了 `v === undefined continue`,
在 exactOptionalPropertyTypes 下读可选属性会拿到 `| undefined`,
直接写回会把好值污染。语义:PATCH 里**出现**的键才生效,
undefined 是"没有这个字段",不是"值是 undefined"。

### 8. deepMerge 对数组做逐项合并

```ts
❌ // 两边都是"数组"也当成可递归对象,或 concat 起来
   if (Array.isArray(v)) out[key] = [...b, ...v]
```

现象:测试"数组整体替换"挂 —— base 2 项 + patch 1 项,concat 出 3 项
(或逐项合并出混合体),`toHaveLength(1)` 不成立。配置合并的常规语义是
**数组是原子值**:给就是新的,不给就保留,永不逐项调和。

### 9. findNode 丢了 undefined

```ts
❌ export function findNode(root: FileTreeNode, id: string): FileTreeNode {
```

现象:测试 `expectTypeOf(findNode(...)).toEqualTypeOf<FileTreeNode | undefined>()`
挂 —— 没有 undefined 的返回类型是在撒谎(找不到时运行时必然 undefined),
调用方会被类型骗到不做空值处理。同理 `?? []` 别写成 `!`
(`root.children!` 在 strict 下也能过编译,是自欺)。

### 10. Path 忘了输出"自己",只输出子路径

```ts
❌ ? `${N}/${Path<C>}`   // 漏了 N |
```

现象:路径联合里没有 'src'、'src/components' 这些**中间节点**,
测试七条路径只剩四条叶子路径。分支节点 = 自己 ∪ 自己拼所有子路径,
`N |` 这个"自己"千万别丢。另一个方向的坑:叶子匹配用了
`children?: infer C` 这种**可选属性推断** —— 匹配缺 children 的对象时
C 推断成 unknown,分支行为很难推理;参考实现用**必填 children 模式**匹配,
匹配不上自然是叶子,语义直白。

## 三、思考题参考答案

### FileTreeNode:children 为什么必须可选?

见常见错误 1:树必须有叶子;必填 children 等于宣称"每个文件都有子节点",
类型被迫撒谎(到处挂空数组)。可选属性正是"这个概念存在两种情形"的建模手段。

### DeepPartial 的三种情况怎么分?

`T[K]` 是数组 → 元素递归、数组保留(`(infer E)[]` 提取元素类型);
是普通对象 → 套一层同样的映射(递归点);是原始值/函数 → 原样透传。
关键顺序:**数组判断在对象判断之前**(数组是对象),函数单独放过
(函数也是对象)。把 string 递归进去倒不会错(string 不 extends object),
但函数和数组一定会踩。

### DeepReadonly 如何处理数组与元组？

TypeScript 的同态 readonly 映射会将数组和元组转换为只读版本，因此可以直接递归映射：

```ts
type MappedReadonly<T> = T extends (...args: never[]) => unknown ? T
  : T extends object ? { readonly [K in keyof T]: MappedReadonly<T[K]> } : T
```

参考实现选择显式数组分支，是为了直接表达只读数组的结果，不是唯一合法写法。
两者都应阻止 push；同态映射还能保留元组的长度与各位置类型。
注意 `DeepReadonly<E>[]` 是“元素只读、数组可变”，与 `readonly DeepReadonly<E>[]` 不同。

### DeepReadonly 与 DeepPartial 的数组分支为什么语义相反?

readonly 数组:冻结 —— 任何修改(含 push)都该被拦。
Partial 数组:PATCH 语义 —— patch 里的数组是**替换值**,调用方拿着新数组
赋进来,字段必须保持可变数组类型才收得下。两个工具一个收紧一个放松,
方向相反才是对的。

### Path:为什么本题用元组保存 children?

`FileTreeNode[]` 没有保留具体的 name 字面量，无法枚举精确路径。
元组是一种保留具体子节点类型的方式；元素类型为具体节点联合的数组也可以，
因为这里通过 `C[number]` 取元素类型，不依赖长度与顺序。
关键是不要提前把字面量信息拓宽；Day 24 的 as const 元组是同一主题。

### (附)为什么 `{ ...base }` 拷贝而不是直接改 base?

deepMerge 是纯函数姿态:返回新对象、不动入参。测试里空 patch 的
`expect(next).toEqual(defaultSettings)` 隐含要求合并结果与 base 等值;
更重要的是调用方往往还要继续用 base(默认配置表),原地修改是隐藏副作用。
Vue 里"把 props/服务端数据拷进本地 state 再改"是同一个习惯。

## 四、验收自查清单

- [ ] `pnpm check:day 23` 通过（类型检查 + 运行时测试）
- [ ] 零 `any`;`FileTreeNode` / `DeepPartial` / `DeepReadonly` / `Path` 全部递归实现
- [ ] `FileTreeNode.children` 可选;测试第一条形状断言通过
- [ ] `DeepPartial`:每一层的字段都可选(theme.name 也是),数组元素字段可选但数组本身可变
- [ ] `DeepReadonly`:数组分支产出 `readonly E[]`,push 编译不过
- [ ] `deepMerge`:对象递归合并、数组整体替换、undefined 跳过,返回完整 `T`
- [ ] `findNode` 返回类型带 `undefined`;`findNode(fileTree, 123)` 的 @ts-expect-error 命中
- [ ] `Path` 七条路径全对(含中间节点);`'src/typings'` 的 @ts-expect-error 命中
- [ ] 所有 export 有 JSDoc + `@example`,JSDoc 回答了数组分支问题
- [ ] 若用了 `as`:只出现在 deepMerge 的写回处,每处有注释解释
