# Day 29 — 综合实战(三)· 重构练习:把一份坏代码救回来

## 业务场景

你接手了同事留下的 `todo-service.ts` —— 一个"能跑起来但到处漏电"的待办小服务。功能上没大问题,**类型上全是窟窿**:`any` 满天飞、判别符是宽 `string`、就地可变、漏分支、直连全局 `localStorage`(在 Node 测试环境里当场爆炸)。

今天的任务:**在 `solution.ts` 里重写这份代码**,行为保持一致(个别 bug 允许修,见下表),类型全面收紧。这是 30 天里最接近"真实工作"的一天 —— 读烂代码的能力和写好代码的能力一样重要。

### 坏代码(只在这里读,不要粘贴进 solution.ts)

```ts
// ========== 重构前的坏代码 ==========
export type Todo = {
  id: any              // ← 坏味道①:字段类型是 any
  title: any
  status: any          // ← 坏味道②:判别符是 any,判别联合完全失效
  createdAt: any
  priority: any
  tags: any
  completedAt: any     // ← 坏味道③:active 的待办也能带 completedAt,状态不自洽
}

// 坏味道④:全 any 参数 + 就地可变(push 改的是调用方的数组)
export function addTodo(todos: any, title: any, priority: any) {
  todos.push({
    id: Math.random().toString(36).slice(2),
    title,
    status: 'active',
    createdAt: new Date().toISOString(),
    priority: priority ?? 'medium',
    tags: [],
  })
  return todos
}

// 坏味道⑤:done → active 时 completedAt 没清掉,脏数据随切换累积
export function toggleTodo(todo: any) {
  if (todo.status === 'active') {
    return { ...todo, status: 'done', completedAt: new Date().toISOString() }
  }
  return { ...todo, status: 'active' }
}

// 坏味道⑥:if 链没有穷尽检查 —— 新增状态时 prefix 会静默变成 undefined
export function renderTodo(todo: any) {
  let prefix: any
  if (todo.status === 'active') prefix = '[ ]'
  else if (todo.status === 'done') prefix = '[x]'
  return `${prefix} ${todo.title}`
}

// 坏味道⑦:find 的返回类型丢失,调用方拿到的是 any
export function findTodo(todos: any, id: any) {
  return todos.find((t: any) => t.id === id)
}

// 坏味道⑧:直连全局 localStorage(Node 测试环境直接 ReferenceError)+ 全文没有一个 JSDoc
export function saveTodos(todos: any, key: any) {
  localStorage.setItem(key, JSON.stringify(todos))
}
```

### 重构目标签名(测试即规格)

| 导出 | 目标签名 | 对应坏味道 |
|---|---|---|
| `TodoPriority` | `'low' \| 'medium' \| 'high'` | ① |
| `ActiveTodo` / `DoneTodo` / `Todo` | `status` 字面量判别联合;`completedAt` 只在 done 分支 | ①②③ |
| `CreateTodoInput` | `{ title: string; priority?: TodoPriority }`(priority 可选,默认 `'medium'`) | ④ |
| `addTodo` | `(todos: readonly Todo[], input: CreateTodoInput) => Todo[]` 纯函数,返回新数组 | ④ |
| `toggleTodo` | `(todo: Todo) => Todo` 不可变 + `switch` + `never` 穷尽 | ⑤⑥ |
| `renderTodo` | `(todo: Todo) => string`,穷尽 + `never` 检查 | ⑥ |
| `findTodo` | `(todos: readonly Todo[], id: string) => Todo \| undefined` | ⑦ |
| `KVStorage` / `createMemoryStorage` / `saveTodos` | 存储改依赖注入,`saveTodos(storage, key, todos)` | ⑧ |

### 行为约定:哪些不变、哪些是允许的修复

| 行为 | 约定 |
|---|---|
| `renderTodo` 输出格式 | **不变**:`'[ ] 标题'` / `'[x] 标题'` |
| `toggleTodo` active → done | **不变**:补 `completedAt`(当前时间 ISO) |
| `toggleTodo` done → active | **修复**:丢弃 `completedAt`(坏味道⑤是 bug) |
| `addTodo` | **改为纯函数**:不改入参数组、返回新数组(坏味道④是缺陷设计);`id` 换用 `crypto.randomUUID()`;不传 priority 默认 `'medium'`、tags 默认 `[]` |
| `findTodo` | **不变**:命中返回元素,未命中返回 `undefined` |
| `saveTodos` | **序列化行为不变**(JSON 字符串),存储介质改为注入的 `KVStorage` |

## 任务(按梯度)

### 🟢 基础:先把类型的墙砌起来

1. 重写 `TodoPriority` / `ActiveTodo` / `DoneTodo` / `Todo` / `CreateTodoInput`(字段表同 Day 27/28:`id` / `title` / `priority` / `createdAt` / `tags?`,`completedAt` 仅 done)。
2. 每个导出补上中文 JSDoc + `@example` —— 坏味道⑧ 的一半是"没文档",测试会数着 `/**` 和 `export` 的数量判卷。

### 🟡 进阶:修行为

3. `addTodo`:纯函数化(不 `push`、不改入参);priority 缺省 `'medium'`;tags 缺省 `[]`;id 用 `crypto.randomUUID()`。
4. `toggleTodo` / `renderTodo`:`switch (todo.status)` + default 分支 `never` 穷尽检查 —— 坏味道⑥的正确解法不是补 else,是让编译器替你记着所有分支。
5. `findTodo`:返回类型标成 `Todo | undefined`(`noUncheckedIndexedAccess` 下 `Array.prototype.find` 本来就返回这个,别用非空断言 `!`)。

### 🔴 边界:修架构

6. `KVStorage` 接口(Day 28 诚实版:`get: string | null` / `set` / `remove`)+ `createMemoryStorage(): KVStorage`(内部 Map)。
7. `saveTodos(storage, key, todos)`:序列化后写入注入的存储。**全文禁止出现 `localStorage`**(测试会扫描源码)。
8. 自查:`solution.ts` 里不允许出现 `as any`、`: any`、`<any>`、`any[]` —— 测试用正则扫描源码判卷,不是靠眼睛。

## 验收清单

- [ ] `pnpm test` 中 day29 全绿;`pnpm typecheck` 中 day29 错误清零
- [ ] 行为约定表全部满足(render 格式不变、done→active 丢 completedAt、addTodo 纯函数)
- [ ] 源码扫描:`as any` / `: any` / `<any>` / `any[]` / `localStorage` 零命中
- [ ] 每个 `export` 都有 JSDoc(测试数数)
- [ ] `toggleTodo` / `renderTodo` 有 `never` 穷尽检查
- [ ] 初始骨架的红全部来自 `throw new Error('TODO')` 或 never 占位

## 写完后

贴 `solution.ts` 说"点评 + 解释为什么",并且**自己先数一遍**:8 个坏味道你各用什么手段修的?哪个修法是运行时手段(守卫/穷尽),哪个是纯类型手段(字面量/联合)?
