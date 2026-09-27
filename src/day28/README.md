# Day 28 — 综合实战(二)· 功能实现:Mini Todo 运行时

## 重学导读

**前置知识**：Day 27 契约；Day 4 守卫和 Day 5 不可变更新。

**今天要学会**：让 Todo 契约真正运行起来，并验证存储边界。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 状态转换 | active 到 done 要增加时间，反向转换要去掉时间；返回新对象才能避免修改调用者持有的原值。 |
| 存储分层 | 底层只保存字符串；解析层接 unknown；守卫验证领域结构。分层后每一层承诺都可以单独验证。 |
| 可选数组 | tags 缺失、空数组、内容非法是不同情况；逐项检查数组，不把普通数组下标读取规则混同于 every 回调类型。 |

### 动手顺序

先做工厂与切换 → 做筛选 → 实现内存存储 → 验证完整数组守卫 → 再连接保存和加载。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么坏 JSON 应报错而空键可返回空列表？done 变 active 后 completedAt 是否真的从对象上消失？
- **迁移**：把数据改成收藏列表，列出一次保存、读取及坏数据恢复的验收条件。
- **验收**：在项目根目录运行 `pnpm check:day 28`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

昨天(Day 27)你把 Mini Todo 的类型契约谈清楚了。今天开始填实现:**增(createTodo)/ 切换(toggleTodo)/ 滤(filterTodos)/ 存取(saveToStorage / loadFromStorage)**,全部跑在真实运行时上,测试以运行时断言为主。

### 两个重要的设计课(先读再做)

**1. 诚实的 KVStorage。** 昨天的 `get<T>(key): T | null` 是类型层的一个"许诺"——真要实现它,`JSON.parse` 的结果怎么变成 `T`?没有额外守卫或 schema 就不能证明它是 T。今天把它改诚实:

- `get(key): string | null`、`set(key, value: string): void` —— 只管**原始字符串**,和浏览器 `localStorage` 完全同构
- 类型的恢复(JSON 解析 + 逐字段校验)放到 `loadFromStorage` 里,用 `unknown` + 类型守卫完成

**契约不是越泛越好,而是越真越好。** 泛型方法适合"调用方自己知道类型且自己负责"的场景;跨进程边界的持久化数据,必须走校验。

**2. Node 环境没有 localStorage —— 依赖注入。** 测试跑在 Node 里,`localStorage` 全局对象不存在(直接 `localStorage.setItem` 会当场炸,这也是 Day 29 坏代码的罪行之一)。所以存储做成**接口** `KVStorage` + 注入:你实现一个 `createMemoryStorage(): KVStorage`(内部一张 Map),函数都接收 `storage` 参数。这也正是"面向接口编程"的意义:**代码依赖契约,不依赖全局环境**。

## 类型(与 Day 27 相同,本天自包含重新定义)

| 类型 | 定义 |
|---|---|
| `TodoPriority` | `'low' \| 'medium' \| 'high'` |
| `ActiveTodo` | `{ status: 'active'; id; title; createdAt: string; priority: TodoPriority; tags?: string[] }` |
| `DoneTodo` | 同上 + `status: 'done'` + `completedAt: string` |
| `Todo` | `ActiveTodo \| DoneTodo` |
| `FilterStatus` | `'all' \| 'active' \| 'done' \| \`tag:${string}\`` |
| `CreateTodoInput` | `{ title: string; priority: TodoPriority; tags?: string[] }`(id/createdAt/status 都不该出现在输入里) |
| `KVStorage` | `{ get(key: string): string \| null; set(key: string, value: string): void; remove(key: string): void }`(诚实版,非泛型) |

## 任务

### 🟢 基础:类型 + 工厂

1. 自包含重定义上表所有类型(直接抄昨天写对的,但**手写一遍**加深肌肉记忆)。
2. **`createTodo(input: CreateTodoInput): ActiveTodo`**:
   - `id` 用 `crypto.randomUUID()`(Node 18+ 全局可用,Day 1 用过)
   - `createdAt` 用 `new Date().toISOString()`
   - `status` 固定 `'active'`(新待办必然是进行中)
   - **不传 `tags` 时,产出对象上没有 `tags` 键**——`exactOptionalPropertyTypes` 的正确姿势。提示：对象展开只复制已有的自有可枚举属性，不会凭空创建缺失的 tags。`{ ...input, tags: input.tags }` 则会主动创建该键；如果要清理外部传入的显式 undefined，可采用条件构造。

### 🟡 进阶:纯函数三连

3. **`toggleTodo(todo: Todo): Todo`** —— `switch (todo.status)` + `never` 穷尽检查(Day 1 的技能):
   - `active → done`:补上 `completedAt`(当前时间 ISO)
   - `done → active`:**必须丢弃 `completedAt`**(状态不自洽的待办是脏数据)
   - 不可变:**不修改入参**,返回新对象
4. **`matchesFilter(todo: Todo, filter: FilterStatus): boolean`**:
   - `'all'` 恒真;`'active'` / `'done'` 看 `status`
   - `` `tag:x` `` 看 `tags` 是否包含 `x`——注意 `tags` 可能不存在(`todo.tags` 是 `string[] | undefined`)
   - 提示:自定义过滤器的判别用 `filter.startsWith('tag:')`,标签名是 `filter.slice(4)`
5. **`filterTodos(todos: readonly Todo[], filter: FilterStatus): Todo[]`** —— 基于 `matchesFilter`;**永远返回新数组**(即使 'all' 也不返回原引用)。

### 🔴 边界:存储与 unknown 守卫

6. **`createMemoryStorage(): KVStorage`** —— 内部 `Map<string, string>`;`get` 取不到返回 `null`;`remove` 不存在的键不报错。
7. **`saveToStorage(storage: KVStorage, key: string, todos: readonly Todo[]): void`** —— `JSON.stringify` 后存入。
8. **`isTodoArray(value: unknown): value is Todo[]`** —— 类型守卫,逐字段校验,任何一处不合法返回 `false`:
   - `value` 是数组;每个元素是对象
   - `status` 是 `'active'` 或 `'done'`(用 `includes` 之类的运行时检查,别 `as`)
   - `id` / `title` / `createdAt` 是 `string`;`priority` 在三档内
   - `tags` 若存在,必须是 `string[]`
   - `status === 'done'` 时 `completedAt` 必须是 `string`
   - 提示:字段取值用 `in` 或 `typeof`,普通数组的下标读取需要考虑 undefined；every 回调不会仅因该配置自动增加 undefined。外部数据本身仍可能含非法元素，守卫必须验证
9. **`loadFromStorage(storage: KVStorage, key: string): Todo[]`**:
   - 键不存在 / 已删除 → 返回 `[]`
   - `JSON.parse` 的结果先放 `unknown`,过 `isTodoArray` 守卫 → 返回
   - 解析失败(非法 JSON)或守卫不过 → `throw new Error(...)`,报错信息里含"损坏"两个字(持久化数据被污染必须炸出来,不能静默吞)

## 验收清单

- [ ] `pnpm check:day 28` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 初始骨架的红全部来自 `throw new Error('TODO')` 或 never 占位
- [ ] 零 `any`、零 `as`(JSON.parse 的结果先接 `unknown`)
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] `createTodo` 不传 tags 时产出对象无 tags 键;`toggleTodo` 不修改入参
- [ ] `toggleTodo` 的 done → active 会丢掉 completedAt
- [ ] `loadFromStorage` 对坏数据 throw,对空键返回 `[]`
- [ ] 不出现 `localStorage` 全局引用(Node 环境没有)

## 写完后

贴 `solution.ts` 说"点评 + 解释为什么"。重点看:守卫的完备性(哪条校验漏了,测试里对应哪条红)和不可变性。

---

[上一题：Day 27](../day27/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 29](../day29/README.md)
