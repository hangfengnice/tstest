# Day 7 — 工具类型深度使用 + 手写 Partial / Required / Readonly / Pick / Omit

## 重学导读

**前置知识**：Day 5–6：索引访问和基础映射。

**今天要学会**：根据读写场景派生类型，并分清可选、undefined 与运行时字段删除。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 工具类型 | Partial 改可选性，Pick/Omit 改可见字段，Readonly 限制写入；这些都只转换类型，不会转换对象值。 |
| 精确可选属性 | 当前配置下 `name?: string` 允许省略，出现时必须是 string；读取它仍可能得到 undefined。若要显式赋 undefined，值类型必须包含它。 |
| 修饰符保留 | 映射的写法会影响 readonly 和 ? 是否保留。先观察恒等映射，再改一个修饰符，最后做组合投影。 |

### 动手顺序

先用内置工具理解目标形状 → 再写五个 My 工具 → 构造表单值 → 做不可变合并。检查运行时是否真的去掉系统字段。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：把对象赋给 Omit 类型，会自动删除原对象的 id 吗？可选字段省略与显式 undefined 在当前配置下相同吗？
- **迁移**：把用户资料拆成列表卡片、编辑补丁和只读详情三种类型，解释每种暴露哪些字段。
- **验收**：在项目根目录运行 `pnpm check:day 07`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 的 **chip 元数据编辑表单**。同一个 `ChipMeta`,在不同页面要变形:

| 场景 | 形状 | 工具 |
|---|---|---|
| 编辑表单初始值 | 所有可编辑字段可选 | `Partial` |
| 表单提交校验后 | 所有字段必填 | `Required` |
| 运行时快照(防误改) | 全字段只读 | `Readonly` |
| 列表卡片投影 | 只要 id / name | `Pick` |
| 公开详情页 | 隐藏 ownerEmail | `Omit` |

今天**全部手写**(`MyPartial<T>` 等,测试会逐一与内置版本对等断言)。
不手写一次,你永远不知道它们是"映射类型 + 修饰符"两块积木拼的 ——
也不知道 `exactOptionalPropertyTypes` 下 `?` 修饰符还有额外语义。

---

## Part 1 — 🟢 基础:业务类型 + 可选/必填

### 前置练习（10 分钟）

接着 Day 6 的“逐键生成属性”实验，先建一个含必填字段、可选字段和只读字段的类型。
在本目录 `warmup.ts` 中导出小实验，并为每个实验写一句观察：

1. 用 `{ [K in keyof T]: T[K] }` 重建它，检查可选和只读修饰符是否保留。
2. 分别尝试 `?`、`-?`、`readonly`、`-readonly`，每次只改一个修饰符。
3. 比较省略可选属性与显式赋 `undefined`，解释当前严格配置为何区分二者。

今天要求独立掌握这些基本修饰符；`Omit` 使用内置 `Exclude` 时，先把它理解为
“从键联合里排除指定成员”，其内部条件类型留到 Day 8。键重映射留到 Day 21。
用 `pnpm check:day 07` 检查；主练习未完成时，先按文件定位实验本身的报错。

1. 定义 `ChipMeta`(注意两个特殊字段,后面全靠它们出题):

   ```ts
   ChipMeta = {
     id: string
     name: string
     ownerEmail: string
     readonly createdAt: string    // 系统写入,只读
     description?: string          // 可选描述(exactOptionalPropertyTypes 下不能显式传 undefined)
   }
   ```

2. `MyPartial<T>` —— 所有属性变可选:`{ [K in keyof T]?: T[K] }`。
3. `MyRequired<T>` —— 移除可选:`-?` 修饰符。
   JSDoc 里回答:**`-?` 在移除 `?` 的同时还会做什么?**(提示:`description?: string`
   读取时得到 `string | undefined`；当前精确可选配置下，移除可选标记后是什么?再对比显式声明 `description?: string | undefined` 的情况。)

## Part 2 — 🟡 进阶:只读与投影(同态映射的修饰符保留)

4. `MyReadonly<T>` —— `readonly` 修饰符版。
5. `MyPick<T, K extends keyof T>` —— 只保留指定键。
6. `MyOmit<T, K extends keyof T>` —— 反向投影。**推荐用你自己刚写的 MyPick 组合**:
   `MyOmit = MyPick<T, Exclude<keyof T, K>>`(内置 Exclude 可以直接用,明天手写它)。

   **本 Part 的考点(测试有断言,坑很深)**:修饰符的保留规则——
   - `MyPick` 同态,**保留** `readonly` 和 `?`(挑出的 `description` 依旧可选)
   - 组合版 `MyOmit`(MyPick + Exclude)同样保留 `?` 和 `readonly`
   - **民间直接映射写法 `{ [P in Exclude<keyof T, K>]: T[P] }` 会丢 `?`**:
     `description?: string` 变成必填的 `description: string | undefined` ——
     和内置 Omit 不对等,这是 TS 著名大坑,值得记进 NOTES

   动手实验:先写直接映射版,跑测试看哪条断言红;再换组合 Pick 的写法,
   对比两版 `description` 的类型差异。结论写进 JSDoc。

## Part 3 — 🔴 边界:组合拳 + exactOptionalPropertyTypes

7. `EditPatch = MyPartial<MyOmit<ChipMeta, 'id' | 'createdAt'>>` —— 编辑表单的补丁类型:
   系统字段(id / createdAt)既不能挑也不能改,其余字段全部可选。

8. `toEditForm(meta: ChipMeta): EditPatch` —— 表单初始值。
   坑:直接 `{ ...meta }` 会把 id / createdAt 也带进来，结构类型兼容可能仍让它通过编译，必须检查运行时字段;
   直接写 `description: meta.description` 在 `exactOptionalPropertyTypes` 下也报错
   (可选属性不接受显式 undefined)。想想怎么构造。

9. `applyEdit(base: ChipMeta, patch: EditPatch): ChipMeta` —— 不可变合并:
   patch 里有的字段覆盖,没有的保留(含 description)。对象展开一行搞定,零 as。

---

## 验收点

运行 `pnpm check:day 07`，类型检查和运行时测试必须全部通过。

- [ ] 五个 My* 全部手写,测试里与内置版本对等(不许在 solution 里用内置 Partial/Required/Readonly/Pick/Omit 完成这五个)
- [ ] 零 `any`、零 `as`
- [ ] 所有 `export` 有 JSDoc + `@example`
- [ ] `MyRequired` 的 JSDoc 回答了 `-?` 的副作用
- [ ] `MyOmit` 的 JSDoc 记下了"直接映射丢 `?`、组合 Pick 才与内置对等"的实验结论
- [ ] `toEditForm` 不包含 id / createdAt,description 为空时**键不存在**(不是 undefined)
- [ ] 测试里 @ts-expect-error 反例保持生效(不许删)

## 写完后

贴 `src/day07/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 二十分钟 → Part 2 三十五分钟 → Part 3 三十五分钟。
卡超过十分钟再来问,要提示不要答案。

---

[上一题：Day 6](../day06/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 8](../day08/README.md)
