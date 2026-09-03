# Day 7 — 工具类型深度使用 + 手写 Partial / Required / Readonly / Pick / Omit

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
   在严格模式下的真实类型是 `string | undefined`,`-?` 之后呢?)

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
   坑:直接 `{ ...meta }` 会把 id / createdAt 也带进来(类型报错);
   直接写 `description: meta.description` 在 `exactOptionalPropertyTypes` 下也报错
   (可选属性不接受显式 undefined)。想想怎么构造。

9. `applyEdit(base: ChipMeta, patch: EditPatch): ChipMeta` —— 不可变合并:
   patch 里有的字段覆盖,没有的保留(含 description)。对象展开一行搞定,零 as。

---

## 验收点

跑 `pnpm typecheck` 和 `pnpm test` 必须全部通过。

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
