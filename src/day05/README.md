# Day 5 — 泛型函数 + extends 约束(K extends keyof T)

## 重学导读

**前置知识**：Day 2 泛型；Day 4 的 Record 可先按“键到值的映射”理解。

**今天要学会**：把对象、键和值的关系写进函数签名，让返回类型随键变化。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| keyof T | 得到 T 的可用属性名联合。例如表格行有 id 和 title，keyof 便描述允许选择的列名。 |
| K extends keyof T | K 必须是 T 的合法键；T[K] 再取这个键对应的值类型。约束与索引访问负责不同工作。 |
| 数组与不可变更新 | 普通数组可能为空，items[0] 要考虑 undefined；readonly 入参限制函数通过该引用修改数据，不会自动冻结对象。 |

### 动手顺序

先做 firstOf/getValue → 再做 pick/updateAt → 最后读 pluck 测试推签名。动态构造 pick 时记录断言依据，别把整题限制当成全课程规则。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：同一个 getValue 调用，为什么换键后返回值类型也变？修改后的对象与原对象应是什么引用关系？
- **迁移**：给订单表格设计读取 amount 和 paid 的调用，预测两次结果类型。
- **验收**：在项目根目录运行 `pnpm check:day 05`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 的会话列表页。你在 Vue 里天天写 `obj[key]`、`list.map(o => o[key])`、
"改一个字段返回新对象" —— 在动态对象上,这些写法的类型全是"摊开的"。
今天把它们封装成**类型安全的泛型工具**:键名写错,编译期就爆;值类型错,编译期就爆;
返回值类型自动跟着键走。

Day 2 你已经写过 `mapResult<T, U, E>`(泛型参数是"整个类型")。今天的关键词是
**约束(constraint)**:`K extends keyof T` —— 泛型参数不再是任意类型,而是"另一个类型的键的子集"。

---

## Part 1 — 🟢 基础:第一个泛型函数 + keyof 索引

1. 定义业务类型(测试里有形状断言):

   ```ts
   ConversationSummary = {
     id: string
     title: string
     messageCount: number
     pinned: boolean
     tags: string[]          // 严格模式下:string[] 不是 (string | undefined)[]
   }
   ```

2. `firstOf<T>(items: readonly T[]): T | undefined` —— 取数组第一个元素。
   JSDoc 里回答:**为什么返回类型必须是 `T | undefined`?**
   (提示:本仓库开着 `noUncheckedIndexedAccess`,想想 `items[0]` 的类型是什么)

3. `getValue<T, K extends keyof T>(source: T, key: K): T[K]` —— 类型安全取值。
   理解两点并写进 JSDoc:
   - `K extends keyof T` 拦住了不存在的键
   - 返回类型 `T[K]` 是**索引访问类型**:键不同,返回类型跟着变

## Part 2 — 🟡 进阶:泛型构造新对象

4. `pick<T, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K>`
   —— 挑几个字段组成新对象。
   实现提示:循环塞值时你会发现 `const result: Pick<T, K> = {}` 直接报错
   (空对象不满足 Pick<T, K>)。**允许本次练习内出现唯一一次 `as Pick<T, K>`**,
   但必须在旁边注释说明为什么躲不开 —— 这是 TS 已知的泛型构造限制,认得它比硬绕它更重要。

5. `updateAt<T, K extends keyof T>(source: T, key: K, value: T[K]): T`
   —— 不可变更新(Vue 里 `reactive` 之外的纯数据更新就靠它)。
   要求:不修改原对象,返回带新值的新对象;**零 as**(对象展开 + 计算键能过,
   亲手试试就知道 TS 对 `{ ...source, [key]: value }` 的处理)。

## Part 3 — 🔴 边界:从测试反推签名(占位签名是错的!)

6. `pluck` —— 批量取字段,列表页的表格列就是它。**签名被隐藏,从测试反推**:
   - 传 `('title')` 返回什么类型?传 `('pinned')` 呢?传 `('tags')` 呢?
   - 泛型参数有几个、约束是什么,测试的 @ts-expect-error 会告诉你

---

## 验收点

运行 `pnpm check:day 05`，类型检查和运行时测试必须全部通过。

- [ ] 零 `any`;唯一的 `as` 只允许出现在 `pick` 内部,且带注释说明原因
- [ ] 所有 `export` 有 JSDoc + `@example`
- [ ] `firstOf` 的 JSDoc 回答了"为什么是 T | undefined"
- [ ] `getValue` 的 JSDoc 解释了 `T[K]` 索引访问类型
- [ ] `updateAt` 不修改原对象(测试有断言)
- [ ] `pluck` 签名从测试反推,传错键必须编译报错
- [ ] 测试里 @ts-expect-error 反例保持生效(不许删)

## 写完后

贴 `src/day05/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 二十分钟 → Part 2 三十五分钟 → Part 3 二十五分钟。
卡超过十分钟再来问,要提示不要答案。

---

[上一题：Day 4](../day04/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 6](../day06/README.md)
