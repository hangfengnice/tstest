/**
 * Day 27 — 综合实战(一):Mini Todo 类型层设计(只有类型,零实现)
 *
 * 学习目标:
 *   1. "先类型后实现":类型层是各模块之间的契约
 *   2. 可辨识联合建模待办两种状态(active / done)
 *   3. 模板字面量类型建模自定义过滤器(tag:xxx)
 *   4. 泛型方法接口(KVStorage)+ 事件映射 + 索引关联签名
 *   5. Exclude / 条件类型 infer / 映射类型 as 重映射
 *
 * 规则:
 *   - 今天不写任何运行时代码
 *   - 零 any、零 as;所有 export 必须有中文 JSDoc + @example
 *   - 判卷:pnpm test(vitest 已开 typecheck 模式)或 pnpm typecheck
 */

// =============================================================
// 🟢 基础:待办与过滤器
// =============================================================

/**
 * 待办优先级 —— 三档字面量联合。
 * JSDoc 思考题答案写在这:为什么不用 enum?
 * (提示:字面量联合零运行时开销、可被条件类型/映射类型直接消费)
 *
 * @example
 *   const p: TodoPriority = 'high'
 */
export type TodoPriority = never // ← 替换

/**
 * 进行中的待办 —— status 判别符为 'active',绝不能有 completedAt。
 *
 * @example
 *   const t: ActiveTodo = {
 *     status: 'active',
 *     id: 't1',
 *     title: '写周报',
 *     priority: 'medium',
 *     createdAt: '2026-09-03T09:00:00Z',
 *   }
 */
export type ActiveTodo = never // ← 替换

/**
 * 已完成的待办 —— status 为 'done',比 ActiveTodo 多一个 completedAt。
 *
 * @example
 *   const t: DoneTodo = {
 *     status: 'done',
 *     id: 't1',
 *     title: '写周报',
 *     priority: 'medium',
 *     createdAt: '2026-09-03T09:00:00Z',
 *     completedAt: '2026-09-03T10:00:00Z',
 *   }
 */
export type DoneTodo = never // ← 替换

/**
 * 待办可辨识联合 —— 判别符是字面量 status,收窄全靠它。
 *
 * @example
 *   declare const todo: Todo
 *   if (todo.status === 'done') {
 *     todo.completedAt // OK:已收窄到 DoneTodo
 *   }
 */
export type Todo = never // ← 替换

/**
 * 过滤器状态 —— 三个预设 + 模板字面量的自定义标签过滤器。
 * 注意 'tag:'(空标签名)也必须合法。
 *
 * @example
 *   const f1: FilterStatus = 'active'
 *   const f2: FilterStatus = 'tag:work'
 */
export type FilterStatus = never // ← 替换

// =============================================================
// 🟡 进阶:存储接口与事件映射
// =============================================================

/**
 * KV 存取接口 —— 类 localStorage 的端口(Port),get/set 都是泛型方法。
 * JSDoc 思考题答案写在这:T 为什么声明在方法上而不是接口上?
 *
 * @example
 *   declare const storage: KVStorage
 *   storage.set<Todo[]>('todos', [])
 *   const todos = storage.get<Todo[]>('todos') // Todo[] | null
 */
export type KVStorage = never // ← 替换(改写成 interface)

/**
 * 事件表 —— 事件名到载荷的映射。
 * todoToggled.status 是切换后的状态;'tag:work' 这类过滤器可进出 filterChanged。
 *
 * @example
 *   const payload: TodoEvents['filterChanged'] = { from: 'all', to: 'tag:work' }
 */
export type TodoEvents = never // ← 替换

/**
 * 全部事件名的联合。
 *
 * @example
 *   const name: EventName = 'todoAdded'
 */
export type EventName = never // ← 替换

/**
 * 监听器类型 —— K 决定载荷类型(索引查表)。
 *
 * @example
 *   const listener: TodoListener<'todoAdded'> = ({ todo }) => todo.title
 */
export type TodoListener<K extends EventName> = never // ← 替换

/**
 * 待办仓库端口 —— on/emit 的事件名与载荷类型相关联。
 * 传 'todoAdded' 时 listener 参数自动推断为 { todo: Todo }。
 *
 * @example
 *   declare const store: TodoStore
 *   store.on('todoAdded', ({ todo }) => console.log(todo.title))
 *   // @ts-expect-error 传错载荷应编译报错(示例性说明,勿照抄)
 *   store.emit('todoAdded', { id: 't1' })
 */
export type TodoStore = never // ← 替换(改写成 interface)

// =============================================================
// 🔴 边界:类型体操三连
// =============================================================

/**
 * 预设过滤器 —— 从 FilterStatus 里剔除所有 tag: 开头的自定义值。
 * 想清楚:'all' extends `tag:${string}` 结果是什么?
 *
 * @example
 *   const f: PresetFilter = 'all' // 'tag:work' 不能赋给它
 */
export type PresetFilter = never // ← 替换

/**
 * 从标签过滤器里抠出标签名 —— 条件类型 + infer。
 * TagName<'tag:work'> = 'work';TagName<'tag:'> = '';TagName<'all'> = never。
 *
 * @example
 *   type T1 = TagName<'tag:work'> // 'work'
 *   type T2 = TagName<'all'>      // never
 */
export type TagName<S extends FilterStatus> = never // ← 替换

/**
 * handler 表 —— 映射类型 + as 重映射 + Capitalize,
 * 把 TodoEvents 翻译成 { onTodoAdded; onTodoToggled; onFilterChanged }。
 *
 * @example
 *   declare const handlers: TodoHandlers
 *   handlers.onTodoAdded({ todo: { status: 'active', id: 't1', title: 'x', priority: 'low', createdAt: 'x' } })
 */
export type TodoHandlers = never // ← 替换
