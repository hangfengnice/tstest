# Day 23 — 递归类型:DeepPartial / DeepReadonly / 树结构与路径

## 重学导读

**前置知识**：Day 21 映射、Day 22 模板匹配与简单递归。

**今天要学会**：为嵌套数据定义递归规则，并明确运行时合并与只读边界。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 递归的停止条件 | 先决定原始值如何返回，再处理数组与对象。每次递归应进入更小的结构，不能只写无限自调用。 |
| 不同数据形态 | 数组、普通对象、函数不能随意用同一套映射；本练习以配置数据为主，迁移到其他对象需明确规则。 |
| 深只读与深合并 | 类型层 DeepReadonly 不执行 freeze；DeepPartial 也不自动实现 PATCH。数组整体替换时还需考虑不完整元素能否保持完整 T。 |

### 动手顺序

先写树节点与 findNode → 比较浅层/深层 Partial → 做 Readonly → 按对象/数组规则实现 merge → 最后推字面量树路径。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么把树宽化成 FileTreeNode 后会丢精确路径？DeepPartial 数组元素若缺必填字段，整体替换还能保证完整返回类型吗？
- **迁移**：为后台菜单树设计查找函数，并说明叶子、空子列表、未命中三种结果。
- **验收**：在项目根目录运行 `pnpm check:day 23`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

两个真实需求,都来自 chipRunner:

1. **设置中心**。`WorkspaceSettings` 是三层嵌套对象,还带一个数组字段。产品要求:
   - 远端配置中心只能下发**部分更新**("只改了 fontSize,别的字段不下发")→ 你需要一个"深层全部可选"的类型,这就是 `DeepPartial<T>`;
   - 默认配置对象要冻结成**只读快照**防止被业务代码误改 → 需要 `DeepReadonly<T>`。类型层的只读限制不会冻结运行时对象；Vue 的 reactive 创建响应式可变代理，readonly 创建只读代理，二者不能混同。
2. **资源管理器文件树**。树形数据的类型必须**自引用**;命令面板还要"按路径跳转"(`src/components/App.vue`),合法路径不是手写字符串数组,而是**从树类型递归推导出来的字符串联合**。

递归类型是这一阶段的分水岭:前面的映射/条件类型只处理"一层",今天要让类型自己调用自己。

---

## Part 1 — 🟢 基础:自引用类型 + DeepPartial

1. `FileTreeNode`:文件树节点。形状从 `solution.test.ts` 反推(提示:三个字段,其中 `children` 是**可选**的,元素类型就是它自己)。
   思考:`children` 为什么必须可选?写成必填会发生什么(每个文件都必须有 children 吗)?
2. `DeepPartial<T>`:递归地把**所有层**的对象属性变成可选,数组字段同样要正确处理(`quickActions` 元素的字段也是可选的,但数组本身仍可赋值)。
   - 先写一层版本 `{ [K in keyof T]?: T[K] }`,看测试里嵌套断言为什么挂,再补递归
   - 关键问题:`T[K]` 是对象时怎么办?是数组时怎么办?是 `string` / `number` 这类原始值时怎么办?—— 三种情况分支处理,别把 `string` 也递归进去

## Part 2 — 🟡 进阶:DeepReadonly + 深合并

3. `DeepReadonly<T>`:递归地把所有属性变 `readonly`。
   - 数组结果必须只读。可以显式返回 `readonly E[]`；也可以保留同态映射 `{ readonly [K in keyof T]: ... }`，TypeScript 会将数组／元组转换为只读版本。不要把只读元素组成的可变数组误当成只读数组。
   - 对比一下:你写的 `DeepReadonly` 和 `DeepPartial` 的数组分支,一个产出 `readonly` 数组、一个产出可变数组,为什么语义上就该不同?
4. `deepMerge<T>(base, patch)`:DeepPartial 的运行时搭档(配置 PATCH 合并)。规则:
   - 两边都是普通对象 → **递归合并**
   - 数组 / 原始值 → patch 有值就**整体替换**(数组不做逐项合并,这是配置合并的常规语义)
   - 返回类型是完整的 `T`

## Part 3 — 🔴 边界:运行时递归 + 类型递归(Path)

5. `findNode(root, id)`:在文件树里递归(先序遍历:自己 → 从左到右子树)找节点,找不到返回 `undefined`。返回类型里 `undefined` 不能丢。
6. `Path<T>`:给定一棵**字面量树类型**(children 是元组!),推导出所有"从根到任意节点"的路径字符串联合,用 `/` 连接:

   ```txt
   Path<{ name: 'src'; children: [{ name: 'main.ts' }, { name: 'components'; children: [{ name: 'App.vue' }] }] }>
   // => 'src' | 'src/main.ts' | 'src/components' | 'src/components/App.vue'
   ```

   提示(只给思路,不给代码):
   - 为什么本题使用**元组**而不是宽泛的 `FileTreeNode[]`?后者丢失了具体 name 字面量。关键是保留子节点的具体类型；元素类型为具体节点联合的数组也能推导路径，并非只能使用元组。Day 24 会继续讨论元组保留信息的方式。
   - 两种节点:**叶子**(没有 `children`)路径就是自己的 `name`;**分支**节点除了自己,还要拼上 `` `${name}/${子路径}` ``
   - 模板字面量 + 递归调用自己;取"元组里的元素类型"用索引访问 + `number`
   - `children` 是可选的,先想清楚"没有 children"和"children 是空元组"分别怎么匹配

---

## 提示区(卡住 10 分钟以上再看)

- 函数也满足 object：如需保留调用签名，必须在对象映射前显式识别函数。数组可显式分支，也可利用同态映射；两种实现的可选数组元素语义需要按题目要求核对。
- 自引用类型的循环是合法的:`type Node = { children?: Node[] }` —— TS 允许类型别名引用自己,只要不是"无限展开"(必须经过对象/数组包装)
- `Path` 里匹配"可选 children"时,注意 `undefined` 分支;模板字面量拼接时子路径已经是联合,`${联合}` 会自动做笛卡尔积展开 —— 这正好是你要的行为

## 验收清单

- [ ] `pnpm check:day 23` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 零 `any`;`DeepPartial` / `DeepReadonly` / `FileTreeNode` / `Path` 全部递归实现
- [ ] 数组分支正确:`DeepReadonly` 产出 `readonly E[]`,`DeepPartial` 的数组元素字段可选
- [ ] `deepMerge`:对象递归合并、数组整体替换,返回类型是完整 `T`
- [ ] `findNode` 返回类型带 `undefined`;`Path` 对叶子/分支节点都正确
- [ ] 所有 export 有 JSDoc + `@example`;JSDoc 里回答:"DeepReadonly 的显式数组分支与同态 readonly 映射各有什么特点?"

## 写完后

贴 `src/day23/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 30 分钟 → Part 2 40 分钟 → Part 3 45 分钟。卡超过 10 分钟来要提示,不要答案。

---

[上一题：Day 22](../day22/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 24](../day24/README.md)
