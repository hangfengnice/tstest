# Day 4 — 自定义类型守卫(is 谓词)+ unknown 安全解析

## 重学导读

**前置知识**：Day 3：unknown、typeof、in；Day 2：泛型结果容器。

**今天要学会**：从不可信 JSON 中恢复可信的业务数据，并解释每一层验证。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 类型谓词 | `value is T` 告诉调用方：返回 true 时把 value 当作 T。编译器不会证明函数体检查完整，漏检查会造成错误承诺。 |
| 解析与校验 | JSON.parse 只证明文本可解析，不证明字段正确；结果先接到 unknown，再检查对象、字段和数组元素。 |
| 依赖注入 | 让 loadDraft 接收 StorageLike，测试便能传入假存储；读取逻辑不必依赖浏览器全局对象。 |

### 动手顺序

先写最小守卫 → 拼接消息与草稿守卫 → 区分缺失、解析失败、形状错误 → 再从测试反推 decodeJson 的泛型。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：能解析的 JSON 为什么仍可能不是草稿？只验证数组第一个元素会漏掉什么？
- **迁移**：为缓存的购物车草稿列出有效、旧版本缺字段、非法 JSON 三种输入。
- **验收**：在项目根目录运行 `pnpm check:day 04`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 支持"对话草稿":你打到一半的对话存在 localStorage 里,刷新页面后恢复。
但 localStorage 里的一切都是 `string | null`,`JSON.parse` 的结果要主动用 `unknown` 接住 ——
**磁盘上的数据不可信**:上个版本的草稿、用户手改过的 DevTools、别的页面写入的垃圾,都可能是你的 `getItem` 返回值。

昨天(Day 3)你用 typeof / in / instanceof 收窄。今天写**自定义类型守卫** —— `x is T` 谓词,
把"验证逻辑"和"类型收窄"绑在一起,让 unknown 数据像过安检一样层层通过。

> 为什么不直接 `as ChatDraft`?一句话:`as` 是"我发誓它是对的",守卫是"我检查过它是对的"。
> 数据来自外部时,誓言不值钱。

---

## Part 1 — 🟢 基础:两个最小的守卫积木

1. `isString(value: unknown): value is string` —— 最小的 is 谓词,一行搞定。
2. `isRecord(value: unknown): value is Record<string, unknown>` —— 本题判断“非 null、非数组的对象”（不保证原型是 Object.prototype）:
   `typeof === 'object'`、非 null、**非数组**。它是后续一切对象守卫的地基。

## Part 2 — 🟡 进阶:嵌套 unknown 的逐层验证

3. 定义业务类型(注意:字段全部必填,`role` 是字面量联合):

   ```ts
   DraftMessage = { role: 'user' | 'assistant'; content: string }
   ChatDraft    = { title: string; updatedAt: string; messages: DraftMessage[] }
   ```

4. `isDraftMessage(value: unknown): value is DraftMessage`
   —— 用 isRecord + isString 拼装,`role` 要精确到两个字面量。

5. `isChatDraft(value: unknown): value is ChatDraft`
   —— 嵌套数组的坑:先 `Array.isArray`,再 `messages.every(isDraftMessage)`。
   JSDoc 里回答:**为什么验证数组不能只验长度或第一个元素?**
   (提示:本仓库开着 `noUncheckedIndexedAccess`)

6. 定义 `Parsed<T>` —— 两态结果(昨天 Result 的变体,这次自己写):
   `{ ok: true; value: T } | { ok: false; reason: string }`

7. 定义 `StorageLike = { getItem(key: string): string | null }`,然后实现
   `loadDraft(storage: StorageLike, key: string): Parsed<ChatDraft>`:
   - `getItem` 返回 null → `{ ok: false, reason: '没有草稿' }`
   - `JSON.parse` 抛异常(catch 到的是 unknown,昨天 Day 3 学过怎么处理)→ `'JSON 解析失败'`
   - `isChatDraft` 不通过 → `'形状不对'`
   - 全过 → `{ ok: true, value }`

   > 为什么注入 StorageLike 而不是直接用全局 localStorage?
   > node 环境测试里没有 localStorage,而且依赖注入让测试可以喂假数据 —— 真实工程同理。

## Part 3 — 🔴 边界:泛型 + 谓词参数(占位签名是错的!)

8. `decodeJson` —— **签名被隐藏,从 `solution.test.ts` 反推**。
   功能:把"JSON 字符串 + 一个守卫"组合成"安全的解析器"。
   测试里会传 `isNumberArray`、`isChatDraft` 两种守卫进去 ——
   想想泛型参数放哪、守卫参数的类型怎么写 `(v: unknown) => v is T`,
   返回的 `Parsed<T>` 里的 T 怎么跟着守卫走。

   思考:**为什么普通布尔函数 `(v: unknown) => boolean` 不能当守卫传?**
   (测试里有一条 @ts-expect-error 反例)

---

## 验收点

运行 `pnpm check:day 04`，类型检查和运行时测试必须全部通过。

- [ ] 零 `any`、零 `as`(守卫本身就是 as 的替代品)
- [ ] 所有 `export` 有 JSDoc + `@example`
- [ ] `isChatDraft` 的 JSDoc 回答了"为什么数组不能只验长度/首元素"
- [ ] `loadDraft` 的三种失败 reason 与测试字符串完全一致
- [ ] `decodeJson` 的签名是从测试反推的,泛型 T 由守卫谓词驱动
- [ ] 测试里 @ts-expect-error 反例保持生效(不许删)

## 开工前(本周复盘的对策,流程固化)

1. **先通读 `solution.test.ts` 再动笔** —— 尤其 decodeJson 部分(签名反推的图纸
   全在里面);`loadDraft` / `decodeJson` 的 reason 字符串,**从测试里原文抄**,
   不要凭记忆手打(本周连续三次栽在字符级差异上,从这里开始归零)
2. `Record<string, unknown>` 今天先照题面抄用(谓词的返回形态是送你的),
   Day 7 手写工具类型时再拆解它的原理

## 写完后

贴 `src/day04/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 十五分钟 → Part 2 四十五分钟 → Part 3 三十分钟。
卡超过十分钟再来问,要提示不要答案。

---

[上一题：Day 3](../day03/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 5](../day05/README.md)
