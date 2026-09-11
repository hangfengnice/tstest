# Day 29 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试:运行时 22/22,vitest typecheck 模式 22/22,`pnpm typecheck` 中 day29 错误清零,源码扫描(`as any` / `: any` / `<any` / `any[]` / 全局存储调用)零命中。

```ts
/**
 * Day 29 — 综合实战(三):重构练习(坏代码见 README,不要粘进来)
 *
 * 修复手段对照表(自查用):
 *   纯类型手段 —— ①②③⑦:字面量联合 + 判别联合 + 精确签名
 *   运行时手段 —— ④⑤:纯函数(新数组)、不可变切换
 *   编译器兜底 —— ⑥:switch + never 穷尽检查
 *   架构手段  —— ⑧:接口 + 依赖注入
 */

// =============================================================
// 🟢 类型(修坏味道①②③)
// =============================================================

/** 待办优先级 —— 三档字面量联合,修掉坏味道①(any 字段)。 */
export type TodoPriority = 'low' | 'medium' | 'high'

/**
 * 进行中的待办 —— status 字面量判别;不允许有 completedAt(修坏味道③)。
 *
 * @example
 *   const t: ActiveTodo = {
 *     status: 'active', id: 't1', title: '写周报',
 *     priority: 'medium', createdAt: '2026-09-03T09:00:00Z',
 *   }
 */
export type ActiveTodo = {
  status: 'active'
  id: string
  title: string
  createdAt: string
  priority: TodoPriority
  /** 标签,可选;exactOptionalPropertyTypes 下不能显式传 undefined */
  tags?: string[]
}

/**
 * 已完成的待办 —— status 字面量判别;completedAt 只在这里。
 *
 * @example
 *   const t: DoneTodo = { status: 'done', id: 't2', title: '配置严格模式',
 *     priority: 'high', createdAt: '2026-09-02T09:00:00Z', completedAt: '2026-09-02T10:00:00Z' }
 */
export type DoneTodo = {
  status: 'done'
  id: string
  title: string
  createdAt: string
  priority: TodoPriority
  tags?: string[]
  /** 完成时间(ISO);只在这个分支上存在 */
  completedAt: string
}

/** 待办可辨识联合 —— 修掉坏味道②的宽 string/any 判别符。 */
export type Todo = ActiveTodo | DoneTodo

/**
 * 新建输入 —— priority 可选(缺省 'medium'),其余字段由工厂生成。
 * 注意本文件没有 tags 输入:重构目标签名如此,新待办 tags 固定空数组。
 *
 * @example
 *   const input: CreateTodoInput = { title: '写周报' } // priority 缺省 medium
 */
export type CreateTodoInput = {
  title: string
  priority?: TodoPriority
}

// =============================================================
// 🟡 行为(修坏味道④⑤⑥⑦)
// =============================================================

/**
 * 新增待办(纯函数)—— 追加到【新数组】返回,不改入参;
 * id 用 crypto.randomUUID(),priority 缺省 'medium',tags 缺省 []。
 *
 * 对比坏代码④:原来 `todos.push(...)` 再返回 todos —— 调用方的数组
 * 被就地改了,"返回值"只是个顺手捎带的引用。纯函数化后输入输出
 * 一一对应,谁改了什么一目了然。
 *
 * @example
 *   const next = addTodo(todos, { title: '写周报' })
 *   // => [...todos, 新的 active 待办,priority: 'medium', tags: []]
 */
export function addTodo(todos: readonly Todo[], input: CreateTodoInput): Todo[] {
  const newTodo: ActiveTodo = {
    status: 'active',
    id: crypto.randomUUID(),
    title: input.title,
    // 缺省值放工厂:调用方少写、口径统一(坏代码的 priority ?? 'medium' 散在函数里)
    priority: input.priority ?? 'medium',
    createdAt: new Date().toISOString(),
    tags: [],
  }
  return [...todos, newTodo]
}

/**
 * 切换状态(不可变)—— active 补 completedAt;done 丢弃 completedAt。
 * switch + never 穷尽检查(修坏味道⑤⑥的分支漏网)。
 *
 * 坏代码⑤的 bug:done → active 时 completedAt 没清掉,
 * "上一世的完成时间"会随切换累积 —— 这里用解构丢弃物理删除这个键。
 *
 * @example
 *   toggleTodo(active).status // => 'done'
 *   'completedAt' in toggleTodo(done) // => false(bug 已修)
 */
export function toggleTodo(todo: Todo): Todo {
  switch (todo.status) {
    case 'active':
      return { ...todo, status: 'done', completedAt: new Date().toISOString() }
    case 'done': {
      // 解构丢弃:rest 里物理上没有 completedAt 这个键
      const { completedAt: _dropped, ...rest } = todo
      return { ...rest, status: 'active' }
    }
    default: {
      // 穷尽检查:将来加第三种状态,这行立刻编译报错,
      // 前缀不会像坏代码⑥那样静默变成 undefined
      const _exhaustive: never = todo
      return _exhaustive
    }
  }
}

/**
 * 渲染待办为展示行 —— 穷尽两个分支:
 * active => '[ ] 标题';done => '[x] 标题'(与坏代码输出格式一致)。
 *
 * 坏代码⑥:if/else-if 链少一个分支就静默产出 "undefined 标题"。
 * switch + never 把"漏分支"从运行时事故变成编译期事故。
 *
 * @example
 *   renderTodo(activeTodo) // => '[ ] 写周报'
 *   renderTodo(doneTodo)   // => '[x] 写周报'
 */
export function renderTodo(todo: Todo): string {
  switch (todo.status) {
    case 'active':
      return `[ ] ${todo.title}`
    case 'done':
      return `[x] ${todo.title}`
    default: {
      const _exhaustive: never = todo
      return _exhaustive
    }
  }
}

/**
 * 按 id 查找待办 —— 命中返回元素,未命中返回 undefined。
 * 修坏味道⑦:坏代码的 find 结果被宽化丢弃,调用方拿到的是无声的
 * "什么都可以"。类型跟运行时对齐:find 本来就可能找不到,
 * 返回类型就该带 undefined,不要用非空断言硬拗。
 *
 * @example
 *   findTodo(todos, 't1')      // => Todo | undefined
 *   findTodo(todos, 'missing') // => undefined
 */
export function findTodo(todos: readonly Todo[], id: string): Todo | undefined {
  return todos.find((todo) => todo.id === id)
}

// =============================================================
// 🔴 架构(修坏味道⑧)
// =============================================================

/**
 * KV 存取端口 —— 只管原始字符串,与浏览器本地存储同构;
 * Node 测试环境没有那个全局对象,所以存储必须可注入。
 *
 * @example
 *   declare const storage: KVStorage
 *   storage.set('todos', '[]')
 *   storage.get('todos') // => '[]' | null
 */
export interface KVStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/**
 * 内存 KV 存储 —— 内部一张 Map;get 取不到返回 null,
 * remove 不存在的键不报错。
 *
 * @example
 *   const s = createMemoryStorage()
 *   s.set('k', 'v')
 *   s.get('k') // => 'v'
 *   s.get('nope') // => null
 */
export function createMemoryStorage(): KVStorage {
  const map = new Map<string, string>()
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value)
    },
    remove: (key) => {
      map.delete(key)
    },
  }
}

/**
 * 保存待办列表 —— JSON.stringify 后写入注入的存储(修坏味道⑧:
 * 不再直连全局存储对象,序列化行为与坏代码一致)。
 *
 * @example
 *   saveTodos(createMemoryStorage(), 'todos', todos)
 */
export function saveTodos(
  storage: KVStorage,
  key: string,
  todos: readonly Todo[],
): void {
  storage.set(key, JSON.stringify(todos))
}
```

## 二、常见错误写法(点评人视角)

### 1. CreateTodoInput 从 Day 28 抄过来(tags 进来了 / priority 忘改可选)

```ts
// ❌ 直接搬 Day 28 的版本
export type CreateTodoInput = {
  title: string
  priority: TodoPriority   // 本天要求可选,缺省 'medium'
  tags?: string[]          // 本天根本没有 tags 输入
}
```

现象:`keyof CreateTodoInput` 断言红(期望恰好 `'title' | 'priority'`);`CreateTodoInput['priority']` 期望 `TodoPriority | undefined` 而你给的是必选。
为什么错:**同名类型在不同上下文是不同的契约** —— Day 28 的调用方可以自带标签,Day 29 的重构目标签名把"新待办 = 无标签空数组"钉死了。重构第一课:先读目标签名表,再动手;肌肉记忆的抄写是重构里最贵的捷径。

### 2. addTodo 保留 push 就地修改

```ts
// ❌
export function addTodo(todos: readonly Todo[], input: CreateTodoInput): Todo[] {
  ;(todos as Todo[]).push({ ... })   // 或者干脆换个参数名绕开 readonly
  return todos
}
```

现象:readonly 入参下 push 编译不过(于是有人 `as` 一下硬拗);"不改入参数组"测试红。
为什么错:坏代码④的病根不是 push 这个 API,是**"改调用方的数据 + 返回同一个引用"这个契约**。测试断言 `after !== before` 且 `before` 长度不变 —— 纯函数是唯一同时满足两者的写法:

```ts
// ✅
return [...todos, newTodo]
```

### 3. toggleTodo 的 done → active 用 spread 带 out completedAt

```ts
// ❌
return { ...todo, status: 'active' }
```

现象:**编译零报错**,但 `'completedAt' in r` 测试红 —— 坏味道⑤原样复活。
为什么错:spread 不参与多余属性检查,类型系统在这行是沉默的;这正是坏代码能带着这个 bug 活到今天的原因。修法(Day 28 同款):解构丢弃 —— `const { completedAt: _dropped, ...rest } = todo`。

另一个变体也别用:

```ts
// ❌ delete 版
const copy = { ...todo }
delete copy.completedAt
// error TS2790: The operand of a 'delete' operator must be optional.
```

delete 只能删可选属性 —— 类型在告诉你"这个键在我的模型里必须存在",而运行时你想删它,这本身就是模型冲突的信号。解构-丢弃让"新对象从一开始就没有这个键",类型和运行时都干净。

### 4. renderTodo 保持 if/else-if 链(不加穷尽检查)

```ts
// ❌
let prefix: string
if (todo.status === 'active') prefix = '[ ]'
else if (todo.status === 'done') prefix = '[x]'
return `${prefix} ${todo.title}`
```

现象:**测试全绿** —— 行为没错。但验收清单明确要求 never 穷尽检查。
为什么错:这段代码和坏代码⑥唯一的区别是把 any 换成了 string —— "新增状态时静默产出 undefined 前缀"的漏洞原样保留。switch + default 分支 `const _exhaustive: never = todo` 之后,未来加 `'archived'` 状态,这行立刻编译报错。**测试验证"现在对不对",穷尽检查保证"将来坏不了"** —— 两种保障不可互换。

### 5. findTodo 用非空断言硬拗

```ts
// ❌
export function findTodo(todos: readonly Todo[], id: string): Todo {
  return todos.find((todo) => todo.id === id)!
}
```

现象:返回类型断言红(期望 `Todo | undefined`);`findTodo(list, 42)` 的 @ts-expect-error 也可能因此错位。
为什么错:`!` 是把"可能不存在"的责任推给调用方,而且**不在类型里留痕** —— 调用方拿到 Todo,坚信它存在,`found.title` 直接炸。诚实签名 `Todo | undefined` 强迫调用方处理找不到的分支。修坏味道⑦的核心不是"把 any 换成类型",是**让类型说出运行时的全部真相**。

### 6. saveTodos 直连全局存储

```ts
// ❌
export function saveTodos(todos: readonly Todo[], key: string): void {
  localStorage.setItem(key, JSON.stringify(todos))
}
```

现象:源码扫描测试红(正则命中);就算没有扫描,测试一跑就是 ReferenceError。
为什么错:Node 没有 localStorage,直连全局 = 把代码钉死在浏览器环境。签名改成 `saveTodos(storage, key, todos)` 后,存储是**参数**而不是**环境** —— 测试注入内存版,浏览器里注入真适配器,业务代码一行不改。

### 7. 类型层把 tags 写成必选

```ts
// ❌
tags: string[]   // 忘了可选
```

现象:测试文件里 `sampleActive`(没有 tags)赋给 ActiveTodo 直接红 —— 测试数据自己就过不了编译。
说明:坏代码里 `tags: any` 看不出必选可选,重构时要从**行为**推断:addTodo 永远写 `tags: []`,而 Day 27/28 的领域模型里 tags 是可选的 —— 契约跟着领域走,不是跟着旧代码的字面走。

### 8. 漏 JSDoc(被"数数测试"抓住)

测试用 `/**` 出现次数 ≥ `export` 行数判卷。12 个 export(5 类型 + 6 函数 + 1 接口)一个都不能少。这不是形式主义:坏味道⑧的另一半就是"全文没有一个 JSDoc" —— 重构交付物 = 行为 + 类型 + 文档,三件套缺一不可。

## 三、思考题参考答案

**Q(README"写完后"):8 个坏味道你各用什么手段修的?哪个是运行时手段,哪个是纯类型手段?**

| 坏味道 | 修复手段 | 手段类别 |
|---|---|---|
| ① 字段 any | `TodoPriority` 字面量联合 + 各字段精确类型 | 纯类型 |
| ② 判别符 any/宽 string | `status: 'active' / 'done'` 字面量判别联合 | 纯类型 |
| ③ active 也能带 completedAt | completedAt 只放进 DoneTodo 分支 | 纯类型 |
| ④ any 参数 + push 就地可变 | 精确参数类型 + `[...todos, newTodo]` 纯函数 | 类型 + **运行时** |
| ⑤ done→active 不清 completedAt | 解构丢弃 + 返回新对象 | **运行时** |
| ⑥ if 链无穷尽检查 | switch + `never` 穷尽检查 | **编译器兜底**(类型驱动运行时安全) |
| ⑦ find 返回 any | 返回类型如实标 `Todo \| undefined`,拒绝 `!` | 纯类型 |
| ⑧ 直连全局 localStorage | KVStorage 接口 + 依赖注入 + 内存实现 | **架构** |

分层的意义:**纯类型手段修的是"说谎的类型"(①②③⑦),运行时手段修的是"越界的副作用"(④⑤),编译器兜底修的是"未来的遗漏"(⑥),架构手段修的是"对环境的硬依赖"(⑧)**。any 只是症状,每个坏味道背后的病根不同,药也不同 —— 这是本 day 最想留给你的东西。

**Q(隐含):为什么"允许的修复"清单这么窄(其余行为必须不变)?**

重构的信任基础是"行为等价"。render 的输出格式、find 的语义、JSON 序列化的格式,调用方可能已经依赖(快照测试、联调协议、存储里的旧数据)。把修复面收窄到"明确是 bug 的两处 + 明确是缺陷设计的一处",其余一律保持 —— 这样 diff 里每一处变化都能回答"为什么变"。**大改是重写,不是重构**;而现实工作里你几乎没有重写的授权。

## 四、验收自查清单

- [ ] `pnpm test` 中 day29 全绿;`pnpm typecheck` 中 day29 错误清零
- [ ] 行为约定:render 输出 `'[ ] 标题'` / `'[x] 标题'` 不变;find 命中/未命中语义不变;序列化仍是 JSON 字符串
- [ ] 修复项:done→active 后 `completedAt` 键消失;addTodo 不改入参、返回新数组、priority 缺省 'medium'、tags 缺省 []
- [ ] 源码扫描零命中:宽化断言四种形态 + 全局存储调用
- [ ] 每个 export 都有 JSDoc(数数测试:12 个 export,一个不少)
- [ ] `toggleTodo` / `renderTodo` 都有 never 穷尽检查(测试测不出这条,规则项)
- [ ] `findTodo` 返回 `Todo | undefined`,没用非空断言
- [ ] 对照第三节的手段分类表,你自己那份"8 坏味道 × 修复手段"和参考差在哪一栏?
