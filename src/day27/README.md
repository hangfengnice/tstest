# Day 27 — 综合实战(一)· 项目类型层设计:Todo + 过滤器 + 本地存储

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

`solution.ts` 全是类型、没有任何运行时代码,测试里的 `expectTypeOf` 断言在运行时是空操作——但本仓库的 vitest 已开启 **typecheck 模式**,类型断言不匹配会直接算作用例失败。所以 `pnpm test` 和 `pnpm typecheck` 都能判卷,红的原因全是"`never` 占位与期望类型不匹配"。

**今天验收 = `pnpm test` 中 day27 用例全绿(等价于 `pnpm typecheck` 中 day27 错误清零)。**

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

- [ ] 初始骨架全是 `never` 占位,`pnpm typecheck` 必然全红 —— **红是预期的**,做完后 day27 错误清零
- [ ] `pnpm test` 无 collect / import 错误(运行时全绿是正常的,判卷在 typecheck)
- [ ] 零 `any`、零 `as`
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] `KVStorage` 的 JSDoc 回答了"T 为什么在方法上"
- [ ] `status` 是字面量联合,不是 `string`;`ActiveTodo` 上没有 `completedAt`
- [ ] `TodoHandlers` 用了 `as` 重映射 + `Capitalize`,不是手写三个键

## 写完后

贴 `solution.ts` 过来说"点评 + 解释为什么"。今天的点评重点是**契约设计的取舍**(字段放哪个分支、泛型放哪一层),不纠结实现细节。
