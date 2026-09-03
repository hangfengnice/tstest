# Day 6 — 泛型进阶:默认类型参数 / satisfies / const 类型参数

## 业务场景

chipRunner 的**配置对象 + 事件映射表**。这类代码有个共同痛点:
你既想要"写错立刻报错"(结构检查),又想要"字面量类型别被拓宽"(`'debug'` 别变 `string`)。

注解 `: T` 能做前者但牺牲后者;`as const` 保后者但牺牲前者。
今天的三个工具分别在不同位置解决这个矛盾:

| 工具 | 一句话 |
|---|---|
| 默认类型参数 `E = keyof EventMap` | 不传参数也有合理默认,`Handler` 裸用即"全事件处理器" |
| `satisfies` | **检查归检查,推断归推断** —— 结构错了报错,字面量照常保留 |
| `const T` 类型参数(TS 5.0) | 把 `as const` 从调用端挪进函数签名,调用方少写一个后缀 |

---

## Part 1 — 🟢 基础:事件映射表

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

跑 `pnpm typecheck` 和 `pnpm test` 必须全部通过。

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
