# Day 5 — 泛型函数 + extends 约束(K extends keyof T)

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

跑 `pnpm typecheck` 和 `pnpm test` 必须全部通过。

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
