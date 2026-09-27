# Day 27 — 综合实战(一)· 项目类型层设计:Todo + 过滤器 + 本地存储

## 重学导读

**前置知识**：Day 1 判别联合、Day 5 泛型、Day 11 事件；边界题用到 Day 20–22。

**今天要学会**：先设计模块之间的契约，再判断契约是否能被诚实实现。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 领域状态 | 完成时间只属于 done 分支；建模时先列合法状态，避免通用可选字段允许不完整记录。 |
| 泛型作用域 | 方法级 T 每次调用可不同；接口级 T 由实例固定。灵活并不意味着安全，要检查 T 与输入是否真正关联。 |
| 类型验收 | expectTypeOf 的关键判断由编译器完成；运行时执行测试文件并不能替代类型检查。 |

### 动手顺序

先画 Todo 两态 → 定过滤器 → 写存储接口并构造跨类型读反例 → 做事件表 → 最后派生 handler 类型。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么 get<string>(key) 不能证明存储中真是字符串？仅类型正确能否保证完成时间已写入？
- **迁移**：为审批单设计初始态与完成态，并写出一份待讨论的模块接口。
- **验收**：在项目根目录运行 `pnpm check:day 27`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 项目说明(第四阶段总项目启动)

从今天起进入第四阶段"综合实战":用 4 天做一个 **Mini Todo** —— 一个类型安全的待办应用,把 30 天学过的核心技能全部串起来。项目分四步,对应四天:

| 天 | 主题 | 产出 |
|---|---|---|
| Day 27(今天) | **类型层设计** | 只有类型,零实现 |
| Day 28 | 功能实现 | 基于同套类型(自包含重写)的运行时代码 |
| Day 29 | 重构练习 | 把一份坏代码重构成类型严谨版 |
| Day 30 | 总复盘 | 30 天考点快问快答自查 |

**为什么"先类型后实现"**:真实项目里,类型层是各方(组件 / Store / 存储 / 事件)之间的**契约**。契约先谈清楚,实现只是填空;契约含糊,实现期就会用 `as` 和 `any` 到处打补丁。今天你只做一件事:**把契约写严,一行实现都不写**。

### 领域模型

- 一条待办有两种状态:**进行中(active)** 和 **已完成(done)**;done 分支比 active 多一个 `completedAt`(完成时间)。
- 公共字段:`id` / `title` / `priority`(低中高)/ `createdAt` / `tags`(标签数组,可选)。
- 过滤器:三个预设(`all` / `active` / `done`)+ 按标签的自定义过滤器(字符串格式 `tag:xxx`)。
- 存储:类 localStorage 的 KV 接口,**泛型存取**。
- 事件:三个事件(`todoAdded` / `todoToggled` / `filterChanged`),载荷各不相同。

### 今天的测试怎么判分(重要)

`solution.ts` 全是类型、没有运行时实现。测试里的 `expectTypeOf` 在运行时不检查类型，
`pnpm check:day 27` 会先用 TypeScript 检查源码和所有类型断言，再运行测试。
类型断言不匹配或测试加载失败都会让命令失败；只看到运行时全绿不算过关。

**今天验收 = `pnpm check:day 27` 的类型检查与运行时测试均通过。**

## 任务

### 🟢 基础:待办与过滤器的地基

1. **`TodoPriority`**:低 / 中 / 高三档的字面量联合。JSDoc 里用一句话回答:为什么用字面量联合而不用 `enum`?

2. **`ActiveTodo` / `DoneTodo` / `Todo`**:用 `status` 字面量判别符的**可辨识联合**。字段表:

   | 字段 | 类型 | 说明 |
   |---|---|---|
   | `status` | `'active'` / `'done'` | 判别符,必须是字面量,不能是 `string` |
   | `id` / `title` / `createdAt` | `string` | 公共字段 |
   | `priority` | `TodoPriority` | 公共字段 |
   | `tags` | `string`(可选数组) | 写成 `tags?: string[]`;注意 `exactOptionalPropertyTypes` 下这意味着**不能显式传 `tags: undefined`** |
   | `completedAt` | `string` | **仅 done 分支有** |

   提示:公共字段可以像 Day 1 那样用交叉类型抽 `BaseTodo`,也可以直接平铺 —— 但想清楚:`ActiveTodo` 上**绝不能**出现 `completedAt`,否则状态不自洽。

3. **`FilterStatus`**:`'all' | 'active' | 'done'` 加上**模板字面量类型**的自定义标签过滤器:`tag:` 开头、后跟任意字符串。注意 `'tag:'`(空标签名)也必须合法。

### 🟡 进阶:存储接口与事件映射

4. **`KVStorage` 接口(泛型存取)**,恰好三个成员:

   ```ts
   get<T>(key: string): T | null   // 取不到返回 null
   set<T>(key: string, value: T): void
   remove(key: string): void
   ```

   这是用于讨论方法级泛型的初版契约，不保证读取的数据确实是 T。先构造反例：同一个键写入数字，再按字符串读取，编译器能否发现？Day 28 会把底层存储改为字符串接口，并在解析后做运行时校验。

   JSDoc 里回答:**T 为什么声明在方法上,而不是接口上(即为什么不是 `KVStorage<T>`)?**
   提示:同一个存储实例,调用方一会儿 `get<Todo>('todos')`,一会儿 `get<User>('user')` —— 如果 T 提到接口上,还能共用同一个实例吗?

5. **`TodoEvents` 映射**(对象类型,以事件名为键、载荷为值):

   | 事件名 | 载荷 |
   |---|---|
   | `todoAdded` | `{ todo: Todo }` |
   | `todoToggled` | `{ id: string; status: Todo['status'] }`(status = 切换**后**的状态) |
   | `filterChanged` | `{ from: FilterStatus; to: FilterStatus }` |

6. **`EventName` 与 `TodoListener<K>`**:`EventName` = 所有事件名的联合(用 `keyof`);`TodoListener<K extends EventName>` = 接收对应载荷的监听器函数类型(`(payload: TodoEvents[K]) => void`)。

7. **`TodoStore` 接口**:恰好两个成员 `on` / `emit`,签名要求**事件名与载荷类型相关联** —— 传 `'todoAdded'` 时,listener / payload 必须自动对上 `{ todo: Todo }`;传错载荷编译报错。(这是"判别联合"思维的泛型版:以 `K extends EventName` 为索引查 `TodoEvents` 这张表。)

### 🔴 边界:三个类型体操

8. **`PresetFilter`**:用 `Exclude` + 模板字面量,从 `FilterStatus` 里剔除所有 `tag:` 开头的值,只留三个预设。先想清楚:`'all' extends \`tag:${string}\` 是 true 还是 false?为什么 `Exclude` 能"识别"模板字面量?(联合类型遇到条件类型会**分发**,`Exclude<T, U>` 的实现就一行条件类型。)

9. **`TagName<S extends FilterStatus>`**:条件类型 + `infer`,从 `'tag:work'` 里抠出 `'work'`;对非 `tag:` 前缀的值给 `never`。要求:
   - `TagName<'tag:work'>` = `'work'`
   - `TagName<'tag:'>` = `''`(空串也是合法标签名)
   - `TagName<'all'>` = `never`

10. **`TodoHandlers`**:用**映射类型**把 `TodoEvents` 翻译成 Vue 组件 props 风格的 handler 表:
    - 键名:`todoAdded` → `onTodoAdded`(on 前缀 + 首字母大写 —— 映射类型的 `as` 重映射 + 内置工具 `Capitalize`)
    - 值:对应事件的监听器类型
    - 期望形状:`{ onTodoAdded: TodoListener<'todoAdded'>; onTodoToggled: ...; onFilterChanged: ... }`

## 验收清单

- [ ] `pnpm check:day 27` 通过；`never` 占位造成类型检查失败是预期现象
- [ ] 零 `any`、零类型断言 `as`（映射类型的 `as` 键重映射不属于类型断言）
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] `KVStorage` 的 JSDoc 回答了"T 为什么在方法上"
- [ ] `status` 是字面量联合,不是 `string`;`ActiveTodo` 上没有 `completedAt`
- [ ] `TodoHandlers` 用了 `as` 重映射 + `Capitalize`,不是手写三个键

## 写完后

贴 `solution.ts` 过来说"点评 + 解释为什么"。今天的点评重点是**契约设计的取舍**(字段放哪个分支、泛型放哪一层),不纠结实现细节。

---

[上一题：Day 26](../day26/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 28](../day28/README.md)
