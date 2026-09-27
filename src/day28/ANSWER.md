# Day 28 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 28` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试:运行时 30/30,vitest typecheck 模式 30/30,`pnpm typecheck` 中 day28 错误清零。

```ts
/**
 * Day 28 — 综合实战(二):Mini Todo 功能实现
 */

// =============================================================
// 🟢 类型(与 Day 27 相同,自包含重定义)
// =============================================================

/** 待办优先级 —— 三档字面量联合。 */
export type TodoPriority = 'low' | 'medium' | 'high'

/**
 * 进行中的待办 —— status 判别符 'active',没有 completedAt。
 *
 * @example
 *   const t: ActiveTodo = { status: 'active', id: 't1', title: 'x', priority: 'low', createdAt: '2026-09-03T00:00:00Z' }
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
 * 已完成的待办 —— status 判别符 'done',多一个 completedAt。
 *
 * @example
 *   const t: DoneTodo = { status: 'done', id: 't1', title: 'x', priority: 'low', createdAt: 'x', completedAt: 'y' }
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

/** 待办可辨识联合。 */
export type Todo = ActiveTodo | DoneTodo

/** 过滤器 —— 三个预设 + tag: 前缀的自定义标签过滤器。 */
export type FilterStatus = 'all' | 'active' | 'done' | `tag:${string}`

/**
 * 新建待办的输入 —— 不含 id / createdAt / status(这些由工厂生成)。
 * 调用方自带的字段一个都不要:判别符由工厂负责,身份和时间戳由系统负责。
 *
 * @example
 *   const input: CreateTodoInput = { title: '写周报', priority: 'high' }
 */
export type CreateTodoInput = {
  title: string
  priority: TodoPriority
  tags?: string[]
}

/**
 * KV 存取端口(诚实版)—— 只管原始字符串,与浏览器 localStorage 同构。
 *
 * 为什么放弃 Day 27 的泛型 get<T>?
 * 那份签名是"调用方说什么就是什么"的许诺:JSON.parse 出来的东西
 * 要变成 T,实现侧只剩 as 强转一条路。诚实的契约是:存储层只搬运
 * 字符串;"字符串 → Todo[]"这层**恢复**交给 loadFromStorage 用
 * unknown + 类型守卫完成 —— 类型和校验放在一起,而不是分开骗自己。
 *
 * @example
 *   declare const storage: KVStorage
 *   storage.set('todos', JSON.stringify([]))
 *   const raw = storage.get('todos') // string | null
 */
export interface KVStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

// =============================================================
// 🟢 工厂
// =============================================================

/**
 * 创建一条进行中的待办 —— id/createdAt/status 由工厂生成。
 *
 * 关键要求:不传 tags 时,产出对象上【没有】tags 键。
 * 不能无脑 `...input`:input.tags 的类型是 string[] | undefined,
 * 直接展开会把 tags: undefined 写进对象 —— exactOptionalPropertyTypes
 * 下这本身就是类型错误,运行时也会让 'tags' in obj 变 true(JSON
 * 序列化时倒是会被丢掉,但内存里的对象已经"带了一个不存在的标签")。
 *
 * @example
 *   const t = createTodo({ title: '写周报', priority: 'high' })
 *   // => { status: 'active', id: '<uuid>', title: '写周报', priority: 'high', createdAt: '<iso>' }
 *   // 注意:对象上没有 tags 键
 */
export function createTodo(input: CreateTodoInput): ActiveTodo {
  const base: ActiveTodo = {
    status: 'active',
    id: crypto.randomUUID(),
    title: input.title,
    priority: input.priority,
    createdAt: new Date().toISOString(),
  }
  // 有 tags 才拼进去;没有就让键不存在(条件展开 / 三元都行,核心是"别写 undefined")
  return input.tags === undefined ? base : { ...base, tags: input.tags }
}

// =============================================================
// 🟡 纯函数三连
// =============================================================

/**
 * 切换待办状态 —— active 补 completedAt;done 丢弃 completedAt。
 * 不可变:返回新对象,不修改入参。用 switch + never 穷尽检查。
 *
 * 为什么 done → active 必须丢 completedAt?
 * "已完成的时间"挂在进行中的待办上是脏数据:下次统计"完成耗时"时
 * 它会带着**上一世**的完成时间混进来。状态机回退,回退掉的状态字段
 * 要一起清场。
 *
 * @example
 *   toggleTodo(activeTodo).status // => 'done'
 *   'completedAt' in toggleTodo(doneTodo) // => false
 */
export function toggleTodo(todo: Todo): Todo {
  switch (todo.status) {
    case 'active':
      return { ...todo, status: 'done', completedAt: new Date().toISOString() }
    case 'done': {
      // 解构丢弃 completedAt:rest 里物理上没有这个键
      // (比 delete 干净、比逐字段手抄防漏;TS 对"带 rest 的解构"里的
      //  未使用变量网开一面,不会触发 noUnusedLocals)
      const { completedAt: _dropped, ...rest } = todo
      return { ...rest, status: 'active' }
    }
    default: {
      // 穷尽检查:将来加第三种状态,下面这行立刻编译报错
      const _exhaustive: never = todo
      return _exhaustive
    }
  }
}

/**
 * 判断待办是否命中过滤器 —— 'all' 恒真;'active'/'done' 看 status;
 * 'tag:x' 看 tags 是否包含 x(tags 可能不存在)。
 *
 * 实现顺序有讲究:先排除三个预设字面量,filter 的类型就被收窄成
 * `tag:${string}` —— 不需要 startsWith 判别,slice(4) 直接抠标签名。
 * "用类型收窄替代字符串判别"是字面量联合送给运行时的红利。
 *
 * @example
 *   matchesFilter(activeTodo, 'active') // => true
 *   matchesFilter(taggedTodo, 'tag:work') // => true
 *   matchesFilter(untaggedTodo, 'tag:work') // => false(tags 不存在也不炸)
 */
export function matchesFilter(todo: Todo, filter: FilterStatus): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return todo.status === 'active'
  if (filter === 'done') return todo.status === 'done'
  // 到这里 filter 只剩 `tag:${string}`;'tag:' 空标签抠出空串,照样比
  const tag = filter.slice(4)
  return todo.tags?.includes(tag) ?? false
}

/**
 * 过滤待办列表 —— 永远返回新数组(即使 'all' 也不返回原引用)。
 * Array.prototype.filter 天然满足;手写 'all' 时 return todos 是
 * 最常见的引用泄漏:调用方改返回值 = 改原数组。
 *
 * @example
 *   filterTodos(todos, 'active') // => 只有进行中的
 *   filterTodos(todos, 'tag:work') // => 带-work-标签的
 */
export function filterTodos(todos: readonly Todo[], filter: FilterStatus): Todo[] {
  return todos.filter((todo) => matchesFilter(todo, filter))
}

// =============================================================
// 🔴 存储与 unknown 守卫
// =============================================================

/**
 * 内存 KV 存储 —— Node 环境没有 localStorage,用依赖注入代替全局引用。
 * get 取不到返回 null;remove 不存在的键不报错(与 localStorage 同构)。
 *
 * @example
 *   const storage = createMemoryStorage()
 *   storage.set('k', 'v')
 *   storage.get('k') // => 'v'
 *   storage.get('nope') // => null
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
 * 序列化保存 —— JSON.stringify 后存入。
 *
 * @example
 *   saveToStorage(storage, 'todos', todos)
 */
export function saveToStorage(
  storage: KVStorage,
  key: string,
  todos: readonly Todo[],
): void {
  storage.set(key, JSON.stringify(todos))
}

/** 优先级白名单(运行时校验用;类型层的 TodoPriority 编译后不存在) */
const PRIORITIES: readonly string[] = ['low', 'medium', 'high']

/**
 * 优先级的运行时守卫 —— value is TodoPriority 的窄化。
 *
 * @example
 *   isPriority('low') // => true
 *   isPriority('urgent') // => false
 */
function isPriority(value: unknown): value is TodoPriority {
  // 先 typeof 收窄成 string,includes 的参数类型才对得上
  return typeof value === 'string' && PRIORITIES.includes(value)
}

/**
 * 单条待办的守卫 —— 逐字段校验。
 * 依赖 TS 4.9+ 的 in 窄化:'x' in value 之后才能在 unknown 域上访问 value.x。
 *
 * @example
 *   isTodo({ status: 'active', id: 't1', title: 'x', priority: 'low', createdAt: 'x' }) // => true
 */
function isTodo(value: unknown): value is Todo {
  if (typeof value !== 'object' || value === null) return false
  // 必备键逐个探(分开写,每个 if 都让后续的属性访问合法化)
  if (!('status' in value)) return false
  if (!('id' in value)) return false
  if (!('title' in value)) return false
  if (!('createdAt' in value)) return false
  if (!('priority' in value)) return false
  // status 必须是两个字面量之一(注意:宽 string 的 'archived' 在这里被拦)
  if (value.status !== 'active' && value.status !== 'done') return false
  // 字符串字段
  if (typeof value.id !== 'string') return false
  if (typeof value.title !== 'string') return false
  if (typeof value.createdAt !== 'string') return false
  // 优先级三档
  if (!isPriority(value.priority)) return false
  // tags 若存在,必须是 string[]
  if ('tags' in value) {
    if (!Array.isArray(value.tags)) return false
    // Array.isArray 收窄出 any[];显式放到 readonly unknown[] 上,
    // 回调参数拿 unknown 而不是隐式 any
    const tags: readonly unknown[] = value.tags
    if (!tags.every((tag) => typeof tag === 'string')) return false
  }
  // done 分支必须有 string 类型的 completedAt
  if (value.status === 'done') {
    if (!('completedAt' in value)) return false
    if (typeof value.completedAt !== 'string') return false
  }
  return true
}

/**
 * 未知数据的类型守卫 —— 逐字段校验,任何一处不合法返回 false。
 * 校验点:数组、对象形状、status 字面量、priority 三档、
 * tags 若存在必须是 string[]、done 必有 string 类型的 completedAt。
 *
 * 为什么用 every 而不是下标循环?noUncheckedIndexedAccess 下
 * arr[i] 的类型带 undefined,下标循环每一步都要先排空;every 的
 * 回调参数天然是元素类型,绕开这个噪音,校验逻辑更聚焦。
 *
 * @example
 *   isTodoArray(JSON.parse('[{"status":"active",...}]')) // => true 或 false
 */
export function isTodoArray(value: unknown): value is Todo[] {
  return Array.isArray(value) && value.every(isTodo)
}

/**
 * 从存储恢复待办列表 —— 键不存在返回 [];
 * JSON 解析结果接 unknown,过 isTodoArray 守卫;
 * 解析失败或校验不过 throw new Error(信息含"损坏")。
 *
 * 为什么坏数据要 throw 而不是静默返回 []?
 * "持久化的数据被污染"和"用户还没有待办"是两种完全不同的世界状态:
 * 后者是正常业务,前者意味着序列化/存储环节出了 bug —— 静默吞掉
 * 等于把数据丢失伪装成空列表,调用方永远发现不了。
 *
 * @example
 *   saveToStorage(storage, 'todos', todos)
 *   loadFromStorage(storage, 'todos') // => 深相等的 todos
 *   loadFromStorage(storage, 'missing') // => []
 */
export function loadFromStorage(storage: KVStorage, key: string): Todo[] {
  const raw = storage.get(key)
  if (raw === null) return []
  // JSON.parse 返回 any —— 第一时间收进 unknown,任何后续访问都必须过守卫
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`待办数据已损坏:键 "${key}" 不是合法 JSON`)
  }
  if (!isTodoArray(parsed)) {
    throw new Error(`待办数据已损坏:键 "${key}" 的形状不符合 Todo[]`)
  }
  // 守卫通过,parsed 在这里被窄化为 Todo[]
  return parsed
}
```

## 二、常见错误写法(点评人视角)

### 1. 区分对象展开与显式重建可选属性

`{ ...input }` 不会凭空添加缺失的 tags；原先“没传 tags 也会展开出 undefined 键”的解释有误。
但下面的写法会主动创建 tags 属性，即使它的值是 undefined：

```ts
// 不符合“不传 tags 就不产生该键”的要求
const result = { ...base, tags: input.tags }
```

如果输入本身存在 `tags: undefined`，对象展开会保留该键。条件构造可以显式清理它：

```ts
return input.tags === undefined ? base : { ...base, tags: input.tags }
```

类型标注不会改变运行时对象。`exactOptionalPropertyTypes` 检查的是 TypeScript 调用方，
外部输入仍需校验；“属性缺失”与“属性存在但值为 undefined”要分别验证。

### 2. done → active 用 spread 顺手写,**编译器不救你**

```ts
// ❌
case 'done':
  return { ...todo, status: 'active' }
```

现象:**编译零报错**(spread 属性不参与多余属性检查),但测试红 —— `'completedAt' in r` 是 `true`,脏数据随切换累积。
为什么错:spread 把 DoneTodo 的 completedAt 原样带出,只改 status 等于"换了马甲没换身份"。这是本题最阴的坑:**类型系统在这行是沉默的,只有测试和 `in` 检查能抓住它**。修法二选一:

```ts
// ✅ 解构丢弃(推荐):rest 里物理上没有这个键,TS 对带 rest 的未使用变量不报 noUnusedLocals
const { completedAt: _dropped, ...rest } = todo
return { ...rest, status: 'active' }

// ✅ 逐字段重建:啰嗦但每个字段都要过一遍脑子(字段多时容易漏)
```

### 3. matchesFilter 直接 `todo.tags.includes(...)`

```ts
// ❌
return todo.tags.includes(tag)
// error TS18048: 'todo.tags' is possibly 'undefined'
```

即使 typecheck 关掉,运行时也会在"无标签待办"上直接 `TypeError: Cannot read properties of undefined`。可选字段的访问链必须处理 undefined:

```ts
// ✅
return todo.tags?.includes(tag) ?? false
```

### 4. filterTodos 的 'all' 分支返回原数组

```ts
// ❌
if (filter === 'all') return todos
```

现象:`expect(r).not.toBe(mixed)` 红。
为什么错:`todos` 的类型是 `readonly Todo[]`,返回类型却是 `Todo[]` —— 签名本身就承诺了"给你一个你自己的数组"。更实际的风险:调用方对返回值 sort/push,原数组跟着遭殃。`Array.prototype.filter` 永远新建数组,一行同时满足语义和签名。

### 5. 守卫里直接 `PRIORITIES.includes(value.priority)`

```ts
// ❌
if (!PRIORITIES.includes(value.priority)) return false
// error TS2345: Argument of type 'unknown' is not assignable to parameter of 'string'
```

为什么错:`value.priority` 在 unknown 域上,`readonly string[].includes` 只收 string。**收窄要一步步来**:先 `typeof value.priority === 'string'`,再 includes。这也是守卫代码的通用节奏 —— typeof/in/Array.isArray 是三把凿子,每一下都让类型更窄一点。

### 6. loadFromStorage 用 `as` 强转 JSON.parse 的结果

```ts
// ❌
const todos = JSON.parse(raw) as Todo[]
return todos
```

现象:编译过、往返测试也过 —— 但"合法 JSON 形状不对 → throw"的测试红:形状校验被 as 整个跳过了,`{ id: 1, title: '形状不对' }` 畅通无阻地变成了"Todo[]"。
为什么错:`as` 是**给编译器的断言,不是给运行时的校验**。跨进程边界的数据(JSON、localStorage、URL 参数、第三方 API)必须走 unknown + 守卫。规则里的"JSON.parse 的结果先接 unknown"就是防这一手。

### 7. 坏数据静默降级返回 []

```ts
// ❌
catch {
  return []  // 想着"容错",实际是把数据损坏伪装成空列表
}
```

现象:"坏 JSON → throw(信息含"损坏")"测试红。
为什么错:用户"还没有待办"和"持久化数据烂了"是两个世界:前者正常渲染空列表,后者应该上报、报警、提示用户。"静默吞异常"在持久化层是最贵的错误 —— 等用户发现时,可能已经拿空列表覆盖保存,旧数据彻底没了。**报错信息带上"损坏"和键名,是为了在日志里一眼定位是哪个键、哪种烂法**。

### 8. isTodoArray 漏校验某个字段

守卫的完备性是逐条对着测试红的:漏 `status` 字面量检查 → `status: 'archived'` 混进来;漏 `priority` → `'urgent'`;漏 done 分支的 completedAt → "done 了但不知道何时 done";漏 tags 的元素类型 → `[1, 2]` 混进标签。**写守卫的顺序建议:先键存在(in),再值类型(typeof),再字面量域(对比白名单),最后分支专属字段** —— 和类型的结构完全同构,照着类型抄就是清单。

### 9. noUncheckedIndexedAccess 下的下标循环

```ts
// ❌ 在守卫里用下标遍历
for (let i = 0; i < value.length; i++) {
  const tag = value[i]  // 类型:string | undefined —— 每步都要先排空
  ...
}
```

不是错,是**税**:这个编译选项让每次 `arr[i]` 都带 undefined,校验代码被排空逻辑淹没。`every` / `some` / `for...of` 的回调参数和迭代变量天然是元素类型,绕开这个税 —— 校验逻辑才能保持"一行一个断言"的密度。

## 三、思考题参考答案

本 day 的 README 没有单独列思考题,但有两处"设计课"值得复盘:

**Q:为什么 Day 27 的 `get<T>(key): T | null` 今天要改成诚实的 `get(key): string | null`?**

类型参数 T 的本质是"把**调用方的断言**参数化"。跨进程边界的数据,调用方的断言和磁盘上的现实可能脱节 —— 泛型签名把这层脱节藏进了类型系统,实现侧只能用 `as` 自欺。诚实版的分工:KVStorage 只管字符串(和 localStorage 完全同构,可替换、可测试),**"字符串 → Todo[]"的恢复连同校验一起**放在 loadFromStorage。一句话:**泛型适合"调用方自己知道类型且自己负责"的场景;外部数据必须走校验**。

**Q:为什么存储要做成接口 + 注入,而不是直接 localStorage?**

1. Node 测试环境没有 localStorage,直连全局等于测试必炸(Day 29 的坏代码就这么干的);
2. 面向 KVStorage 接口编程后,createMemoryStorage 只是其中一个实现 —— 换成真实 localStorage 的适配器、SessionStorage、甚至带 TTL 的缓存,调用方代码一行不改。
这就是"依赖倒置"在最小尺度上的样子:**代码依赖契约,不依赖环境**。

## 四、验收自查清单

- [ ] `pnpm check:day 28` 通过（类型检查 + 运行时测试）
- [ ] 零 `any`、零 `as`(JSON.parse 的结果先接 unknown,过了守卫才用)
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] `createTodo` 不传 tags 时产出对象无 tags 键(`'tags' in t === false`)
- [ ] `toggleTodo` 不修改入参;done → active 后 `completedAt` 键消失(第 2 条坑:编译器在这里是沉默的)
- [ ] `matchesFilter` 对无标签待办不炸(可选链 + 空串标签边界)
- [ ] `filterTodos` 永远返回新数组(即使 'all')
- [ ] 守卫完备:status 字面量 / priority 三档 / tags 元素类型 / done 必有 completedAt,逐条能对上测试里的每条红
- [ ] `loadFromStorage` 对坏数据 throw 且信息含"损坏",对空键返回 []
- [ ] 全文没有 `localStorage` 全局引用(Node 环境没有)
- [ ] 对照第二节:9 条常见错误,第 2、6、7 条是"测试红但编译沉默"的 —— 你的实现是靠什么抓住它们的?
