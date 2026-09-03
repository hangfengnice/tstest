# Day 3 — 类型守卫基础:typeof / in / instanceof + 可辨识联合收窄

## 业务场景

chipRunner 的对话页通过 **SSE(服务器推送事件)** 接收流式数据。传输层的约定很残酷:
每一帧到达时,在类型系统眼里只是 `unknown` —— JSON 反序列化不保证任何形状。

昨天(Day 2)你已经学会了"给已知联合建模 + switch 收窄"。今天更进一步:
**面对 `unknown` 和不规则联合,如何一层层"收窄"到能安全渲染的类型**。

收窄三件套,今天是它们的主场:

| 手段 | 适用场景 | 陷阱 |
|---|---|---|
| `typeof x === 'string'` | 原始值 | `typeof null === 'object'`! |
| `'key' in x` | 对象形状(无判别符的联合) | 不能直接用在 `unknown` 上 |
| `x instanceof Date` | 类实例 | **子类必须排在父类前面判断** |

---

## Part 1 — 🟢 基础:事件模型 + typeof 收窄

1. 定义 `StreamEvent` 可辨识联合(判别符 `kind`),四种分支:

   | kind | 专有字段 |
   |---|---|
   | `'text'` | `content: string` |
   | `'tool_call'` | `tool: string`、`argsJson: string` |
   | `'tool_result'` | `tool: string`、`ok: boolean` |
   | `'done'` | `reason: 'stop' \| 'length' \| 'error'` |

2. `describePrimitive(value: unknown): string` —— 对完全未知的数据做"兜底描述",
   这是渲染 unknown 数据的第一道防线。输出规格(测试按此断言,**顺序很重要**):

   | 输入 | 输出 |
   |---|---|
   | `null` | `'空'` |
   | `undefined` | `'未定义'` |
   | `string` | `` `文本(${v})` `` |
   | `number`(普通) | `` `数值(${v})` `` |
   | `NaN` | `'非数'`(注意:`typeof NaN === 'number'`,要单独分流) |
   | `boolean` | `` `开关(${v})` `` |
   | 其他对象/数组/函数 | `'对象'` |

   思考(写进 JSDoc):**为什么 `null` 必须在 `typeof === 'object'` 分支之前判断?**

## Part 2 — 🟡 进阶:判别符收窄 + `in` 收窄 + instanceof

3. `renderEvent(event: StreamEvent): string` —— `switch (event.kind)` + `never` 穷尽检查
   (Day 1 技能,这次分支里字段更多)。输出规格:

   | kind | 输出 |
   |---|---|
   | `text` | `` `文本:${content}` `` |
   | `tool_call` | `` `调用 ${tool}(${argsJson})` `` |
   | `tool_result` | ok 为真 `` `${tool} 成功` ``,否则 `` `${tool} 失败` `` |
   | `done` | stop → `'正常结束'`;length → `'因长度结束'`;error → `'异常结束'` |

4. 定义 `LegacyFrame` —— **没有判别符**的旧协议联合:

   ```ts
   // 两种旧帧,公共字段 ts,专有字段 data / payload 互斥
   { data: string; ts: number } | { payload: string; ts: number }
   ```

   写 `renderLegacyFrame(frame: LegacyFrame): string`:`'data' in frame` 分支 →
   `` `数据(${data})` ``,否则 `` `载荷(${payload})` ``。
   没有判别符时,`in` 就是判别符 —— 思考:为什么这里不能用 `frame.data` 直接判空?

5. `formatTimestamp(v: unknown): string` —— instanceof 收窄:
   - `v instanceof Date` → `v.toISOString()`
   - `typeof v === 'string'` → 原样返回
   - `typeof v === 'number'` → `new Date(v).toISOString()`
   - 其余 → `'未知时间'`

## Part 3 — 🔴 边界:从测试反推签名(占位签名是错的!)

6. `classifyError` —— **签名被隐藏了,从 `solution.test.ts` 反推**。
   功能:把 `unknown` 的异常分类为错误码字符串。

   提示(踩坑点):
   - `SyntaxError` / `TypeError` / `RangeError` **都是 `Error` 的子类**,
     `new TypeError('x') instanceof Error` 也是 `true` —— 判断顺序错一个,答案全错
   - 返回值不是宽 `string`,是一个**字面量联合**(测试里有 `expectTypeOf` 断言)

---

## 验收点

跑 `pnpm typecheck` 和 `pnpm test` 必须全部通过。

- [ ] 零 `any`(允许 `unknown`),零 `as`
- [ ] 所有 `export` 有 JSDoc + `@example`
- [ ] `describePrimitive` 的 JSDoc 里回答了 "null 为什么先判"
- [ ] `renderEvent` 用 switch + `never` 穷尽检查
- [ ] `renderLegacyFrame` 用 `in` 收窄,不是判空
- [ ] `classifyError` 的 instanceof 判断顺序是 **子类在前,父类在后**(JSDoc 里说明为什么)
- [ ] 测试里两条 `@ts-expect-error` 反例保持生效(不许删)

## 写完后

贴 `src/day03/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 二十分钟 → Part 2 三十五分钟 → Part 3 二十五分钟。
卡超过十分钟再来问,要提示不要答案。
