/**
 * Day 29 — 综合实战(三):重构练习(坏代码见 README,不要粘进来)
 *
 * 学习目标:
 *   1. 识别并修复 8 类坏味道(any 字段 / 宽判别符 / 状态不自洽 /
 *      any 参数 + 就地可变 / 漏分支 / 无穷尽检查 / 返回 any / 直连全局)
 *   2. 行为保持:render 格式、find 语义、序列化行为不变
 *   3. 允许的修复:done→active 丢 completedAt、addTodo 纯函数化、
 *      存储依赖注入
 *
 * 规则:
 *   - 宽化类型(as 强转、冒号宽型、尖括号宽型、宽型数组)零容忍,测试正则判卷
 *   - 禁止直连浏览器的全局存储对象(测试正则判卷)
 *   - 所有 export 必须有中文 JSDoc + @example(测试数数)
 *   - toggleTodo / renderTodo 必须有 never 穷尽检查
 */

// =============================================================
// 🟢 类型(修坏味道①②③)
// =============================================================

/** 待办优先级 —— 三档字面量联合,修掉 any 字段。 */
export type TodoPriority = never // ← 替换

/** 进行中的待办 —— status 字面量判别;不允许有 completedAt。 */
export type ActiveTodo = never // ← 替换

/** 已完成的待办 —— status 字面量判别;completedAt 只在这里。 */
export type DoneTodo = never // ← 替换

/** 待办可辨识联合 —— 修掉宽 string/any 判别符。 */
export type Todo = never // ← 替换

/** 新建输入 —— priority 可选(默认 'medium'),其余字段由工厂生成。 */
export type CreateTodoInput = never // ← 替换

// =============================================================
// 🟡 行为(修坏味道④⑤⑥⑦)
// =============================================================

/**
 * 新增待办(纯函数)—— 追加到【新数组】返回,不改入参;
 * id 用 crypto.randomUUID(),priority 缺省 'medium',tags 缺省 []。
 *
 * @example
 *   const next = addTodo(todos, { title: '写周报' })
 *   // => [...todos, 新的 active 待办,priority: 'medium', tags: []]
 */
export function addTodo(todos: readonly Todo[], input: CreateTodoInput): Todo[] {
  void todos
  void input
  throw new Error('TODO')
}

/**
 * 切换状态(不可变)—— active 补 completedAt;done 丢弃 completedAt。
 * switch + never 穷尽检查(修坏味道⑤⑥的分支漏网)。
 *
 * @example
 *   toggleTodo(active).status // => 'done'
 */
export function toggleTodo(todo: Todo): Todo {
  void todo
  throw new Error('TODO')
}

/**
 * 渲染待办为展示行 —— 穷尽两个分支:
 * active => '[ ] 标题';done => '[x] 标题'(与坏代码输出格式一致)。
 *
 * @example
 *   renderTodo(activeTodo) // => '[ ] 写周报'
 *   renderTodo(doneTodo)   // => '[x] 写周报'
 */
export function renderTodo(todo: Todo): string {
  void todo
  throw new Error('TODO')
}

/**
 * 按 id 查找待办 —— 命中返回元素,未命中返回 undefined。
 * 不要用非空断言,类型直接标 Todo | undefined(修坏味道⑦)。
 *
 * @example
 *   findTodo(todos, 't1') // => Todo | undefined
 */
export function findTodo(todos: readonly Todo[], id: string): Todo | undefined {
  void todos
  void id
  throw new Error('TODO')
}

// =============================================================
// 🔴 架构(修坏味道⑧)
// =============================================================

/**
 * KV 存取端口 —— 只管原始字符串,与 localStorage 同构;
 * Node 测试环境没有 localStorage,所以存储必须可注入。
 */
export type KVStorage = never // ← 替换(改写成 interface)

/**
 * 内存 KV 存储 —— 内部一张 Map;get 取不到返回 null,
 * remove 不存在的键不报错。
 *
 * @example
 *   const s = createMemoryStorage()
 *   s.set('k', 'v')
 *   s.get('k') // => 'v'
 */
export function createMemoryStorage(): KVStorage {
  throw new Error('TODO')
}

/**
 * 保存待办列表 —— JSON.stringify 后写入注入的存储(修坏味道⑧:
 * 不再直连全局 localStorage,序列化行为与坏代码一致)。
 *
 * @example
 *   saveTodos(createMemoryStorage(), 'todos', todos)
 */
export function saveTodos(
  storage: KVStorage,
  key: string,
  todos: readonly Todo[],
): void {
  void storage
  void key
  void todos
  throw new Error('TODO')
}
