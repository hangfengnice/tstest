# Day 8 — 手写 Extract / Exclude / ReturnType / Parameters + 第一阶段综合复盘

## 业务场景

第一阶段(Day 1-8)收官。前半场手写四个"条件类型"工具 —— 它们是 Day 7 映射类型背后的发动机:
`MyOmit` 里用到的 `Exclude`,今天亲手造。后半场是一道综合题:**类型安全的聊天事件总线**,
把这一阶段所有的技能串起来用一遍:

| 技能 | 在哪用 |
|---|---|
| Day 1 可辨识联合 | 事件载荷的建模 |
| Day 3 switch 收窄 | emitRaw 里逐事件验证载荷 |
| Day 4 is 谓词 | unknown 载荷 → 类型化载荷 |
| Day 5 `K extends keyof T` | on / emit 按事件名锁载荷类型 |
| Day 6 映射表 → 判别联合 | 存储结构 `{ [K in ChatEventName]: Set<...> }` |
| Day 7 映射类型 | 同上,全量初始化避免泛型写入难题 |

---

## Part 1 — 🟢 基础:条件类型入门

1. `MyExtract<T, U>` —— 从联合 T 里挑出能赋给 U 的成员:

   ```ts
   // 期望:MyExtract<'a' | 'b' | 'c', 'b' | 'c'> === 'b' | 'c'
   // 写法:T extends U ? T : never —— 对联合成员逐个判断再合并(分布式条件类型)
   ```

2. `MyExclude<T, U>` —— 反向:踢掉能赋给 U 的成员(`T extends U ? never : T`)。

   JSDoc 里回答:**条件类型什么时候会"分发"(distribute)?**
   提示:`type A = MyExtract<'a'|'b', 'b'>` 和 `type B = MyExtract<['a'|'b'], 'b'>` 骨架一样,
   把联合包进数组后还分发吗?亲手试,结论写下来。

   阶段闭环:用 Day 1 的 `Notification` 联合验证
   `MyExtract<Notification, { type: 'email' }> === EmailNotification` ——
   Day 1 你踩过"泛型上 Extract 不收窄",今天你看到了 Extract 的内部其实就是条件类型分发。

## Part 2 — 🟡 进阶:infer 推断

3. `MyReturnType<T>` —— 从函数类型里"抠出"返回值:

   ```ts
   // 骨架:T extends (...args: never[]) => infer R ? R : never
   // infer R = "在这个模式匹配的位置声明一个类型变量,让 TS 替你推"
   ```

4. `MyParameters<T>` —— 抠出参数元组:`T extends (...args: infer P) => unknown ? P : never`。
   注意约束怎么写(函数类型才能传进来),参数元组是**元组类型**,不是数组。

## Part 3 — 🔴 边界:类型安全的事件总线(第一阶段综合题)

5. 定义事件映射与事件名:

   | 事件 | 载荷 |
   |---|---|
   | `'message'` | `{ text: string; at: number }` |
   | `'typing'` | `{ userId: string }` |
   | `'done'` | `{ reason: 'stop' \| 'length' }` |
   | `'error'` | `{ message: string }` |

   `ChatEventName = keyof ChatEventMap & string`(想想 `& string` 在这里的作用)。

6. 定义 `ChatBus`(三个方法的签名规格):

   ```ts
   {
     on<K extends ChatEventName>(event: K, handler: (payload: ChatEventMap[K]) => void): () => void
     emit<K extends ChatEventName>(event: K, payload: ChatEventMap[K]): void
     emitRaw(event: string, payload: unknown): boolean
   }
   ```

   - `on` 注册处理器,返回取消订阅函数
   - `emit` 按事件名发类型化载荷
   - `emitRaw` 是外部世界的入口(事件名和载荷都是 unknown 级别):
     名字不在表里 → false;载荷形状不对 → false;验证通过 → 转发 emit 并返回 true

7. 写守卫(Day 4 技能,给全部载荷用谓词逐个验):`isChatEventName` + 每个事件一个载荷守卫。

8. `createChatBus(): ChatBus` —— 实现提示(存储是本题最难点):
   ```ts
   // 映射类型 + 全量初始化:每个事件一个 Set,泛型关联不丢,零 as
   const handlers: { [K in ChatEventName]: Set<(payload: ChatEventMap[K]) => void> } = {
     message: new Set(), typing: new Set(), done: new Set(), error: new Set(),
   }
   ```
   如果初始化成可选属性(`?`),往 `handlers[event]` 写入会遇到泛型交集难题 ——
   亲手踩一次,再把结论写进 JSDoc(这是本题埋的最后一个坑)。

---

## 验收点

跑 `pnpm typecheck` 和 `pnpm test` 必须全部通过。

- [ ] 四个 My* 全部手写,测试里与内置版本对等
- [ ] `MyExtract` / `MyExclude` 的 JSDoc 写下"分发条件"的实验结论
- [ ] 事件总线:零 `any`、零 `as`
- [ ] `createChatBus` 的 JSDoc 记下"可选存储 vs 全量初始化"的坑
- [ ] `emitRaw` 对坏数据返回 false 且**不触发任何处理器**(测试有断言)
- [ ] 测试里 @ts-expect-error 反例保持生效(不许删)
- [ ] (复盘)对照一周前的自己:Day 1 的 switch 穷尽、Day 4 的守卫,现在写起来还卡吗?
      把卡住的点记进 NOTES.md,周日复盘用

## 写完后

贴 `src/day08/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 二十分钟 → Part 2 二十分钟 → Part 3 六十分钟(存储卡住就看上面的提示,别硬磕)。
卡超过十五分钟再来问,要提示不要答案。
