# Day 6 — 泛型进阶:默认类型参数 / satisfies / const 类型参数

## 重学导读

**前置知识**：Day 5：keyof、T[K]、泛型约束。

**今天要学会**：从事件表派生判别联合，理解类型校验与推断结果的区别。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 映射再索引 | `[K in keyof M]` 为每个键生成一个属性；再用 `[keyof M]` 取所有属性值，得到联合。分两步观察，别把它当作一整串咒语。 |
| 默认类型参数 | `T = Default` 在调用方未提供且无法推断时提供默认类型；它不是运行时参数的默认值。 |
| satisfies 与 const | satisfies 检查表达式是否满足约束，上下文仍会参与推断；它不保证所有字段都保留字面量。const 类型参数影响直接实参的推断，也不会冻结运行时对象。 |

### 动手顺序

先做两键映射热身 → 完成事件表和格式化 → 比较注解与 satisfies → 最后观察普通泛型和 const 泛型的路由结果。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：事件名和载荷拆成两个宽联合会丢什么关系？retries 使用 satisfies 后一定是数字字面量吗？
- **迁移**：把事件改成表格 rowSelect / pageChange，画出每个事件对应的载荷。
- **验收**：在项目根目录运行 `pnpm check:day 06`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 的**配置对象 + 事件映射表**。这类代码有个共同痛点:
你既想要"写错立刻报错"(结构检查),又想要"字面量类型别被拓宽"(`'debug'` 别变 `string`)。

注解 `: T` 能做前者但牺牲后者;`as const` 保后者但牺牲前者。
今天的三个工具分别在不同位置解决这个矛盾:

| 工具 | 一句话 |
|---|---|
| 默认类型参数 `E = keyof EventMap` | 不传参数也有合理默认,`Handler` 裸用即"全事件处理器" |
| `satisfies` | 校验结构并保留表达式的推断结果；上下文会影响推断，不保证所有字段都保留字面量 |
| `const T` 类型参数(TS 5.0) | 把 `as const` 从调用端挪进函数签名,调用方少写一个后缀 |

---

## Part 1 — 🟢 基础:事件映射表

### 前置练习（10 分钟）

先确认会用 Day 5 的 `keyof T` 和 `T[K]`。在本目录新建 `warmup.ts`，
定义一个只有 `open`、`close` 两个键的对象类型，各自对应不同的数据。

1. 写出它的键联合，以及按单个键、按整个键联合取值的类型。
2. 尝试 `{ [K in keyof M]: { key: K } }`：先解释每个属性是什么，再取所有属性值。
3. 把中间结果起名字，观察“对象类型”在哪一步变成了“对象的联合”。

只需掌握“逐键生成属性 → 索引取值”两步；修饰符在 Day 7 练习，复杂映射在 Day 21 深入。
用 `export type` 导出实验类型并写一句观察，避免严格模式下出现未使用声明。
可用 `pnpm check:day 06` 查看实验文件的报错；主练习尚未完成时，整体命令仍会失败。

1. 定义 `EventMap` —— 事件名到载荷的映射(映射表是后面一切的地基):

   | 事件名 | 载荷 |
   |---|---|
   | `'chip:run'` | `{ chipId: string; arg: string }` |
   | `'chip:done'` | `{ chipId: string; durationMs: number }` |
   | `'chip:error'` | `{ chipId: string; message: string }` |

2. 把映射表"翻"成**判别联合** `EventEnvelope`:

   ```ts
   // 期望:三个对象的联合,分别带 name: 'chip:run' | 'chip:done' | 'chip:error' 判别符
   type EventEnvelope = /* 用映射类型 + 索引访问,一行搞定 */
   ```

   这是 Day 7(手写工具类型)的预告:`{ [K in keyof M]: ... }[keyof M]` 是把"表"变"联合"的标准姿势。

## Part 2 — 🟡 进阶:安全的分发 + 默认类型参数 + satisfies

3. `formatEvent(e: EventEnvelope): string` —— switch 收窄,输出规格:

   | name | 输出 |
   |---|---|
   | `chip:run` | `` `[chip:run] ${chipId}(${arg})` `` |
   | `chip:done` | `` `[chip:done] ${chipId} 耗时 ${durationMs}ms` `` |
   | `chip:error` | `` `[chip:error] ${chipId}:${message}` `` |

   **思考(写进 JSDoc)**:为什么不写 `formatEvent<E extends keyof EventMap>(name: E, payload: EventMap[E])`?
   提示:Day 2 你复验过"泛型上 Extract 不收窄"——函数体里对 `name` 做 switch,
   `EventMap[E]` 会跟着收窄吗?亲手试一次,把观察结论写下来,再回到判别联合参数。

4. `Handler<E extends keyof EventMap = keyof EventMap>` —— 事件处理器类型,**带默认类型参数**:
   `(name: E, payload: EventMap[E]) => void`。
   - `Handler<'chip:done'>` 是单事件处理器
   - `Handler`(裸用,走默认)是全事件处理器
   JSDoc 里回答:**默认参数在这里解决了什么便利性问题?**

5. 定义 `ChipRegistry = { retries: number; logLevel: 'debug' | 'info' | 'error' }`。
   测试文件里有三段用它的对比实验(先看测试):
   - `satisfies` 之后 `logLevel` 保持 `'debug'` 字面量
   - 注解 `: ChipRegistry` 之后 `logLevel` 被拓宽成三个成员的联合
   - `satisfies` 依然做结构检查(类型不对照样报错)
   在 JSDoc 里写清三种行为差异,这是今天的核心概念题。

## Part 3 — 🔴 边界:const 类型参数(占位签名是错的!)

6. `defineRoutes` —— 路由注册函数,**签名被隐藏,从测试反推**。
   要求:传进去的路由对象,出参**保留全部字面量类型**(`'/'` 就是 `'/'`,`true` 就是 `true`),
   同时 `path` 字段的类型约束仍然生效(传 `path: 123` 要报错)。

   提示:先写一个不带任何修饰的普通泛型版本,跑测试看断言怎么红;
   再想 TS 5.0 的 **const 类型参数**(`<const T extends ...>`)。
   思考:老办法是调用端写 `as const`,新办法把 const 挪到签名上 —— 各有什么代价?

---

## 验收点

运行 `pnpm check:day 06`，类型检查和运行时测试必须全部通过。

- [ ] 零 `any`、零 `as`(包括测试里的 satisfies 对比实验,不许用 as 模拟)
- [ ] 所有 `export` 有 JSDoc + `@example`
- [ ] `formatEvent` 的 JSDoc 里写下了"泛型签名版为什么不行"的实验结论
- [ ] `Handler` 的 JSDoc 回答了默认类型参数的便利性
- [ ] `ChipRegistry` 的 JSDoc 说清 satisfies / 注解 / as const 三者差异
- [ ] `defineRoutes` 签名从测试反推,字面量全部保留
- [ ] 测试里 @ts-expect-error 反例保持生效(不许删)

## 写完后

贴 `src/day06/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 十五分钟 → Part 2 四十五分钟 → Part 3 三十分钟。
卡超过十分钟再来问,要提示不要答案。

---

[上一题：Day 5](../day05/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 7](../day07/README.md)
