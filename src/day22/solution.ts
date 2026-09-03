/**
 * Day 22 — 模板字面量类型:组件库事件系统与命名转换
 *
 * 学习目标:
 *   1. 模板拼接 + Capitalize 家族(onXxx / BEM)
 *   2. infer + 模板:拆解提取(路由参数 / snake_case)
 *   3. 递归模板字面量(任意多个下划线)
 *   4. 合卷:映射类型 + as 重映射 + 模板(PropEventHandlers)
 *
 * 规则:
 *   - 不允许 any、不允许 as
 *   - 所有 export 必须有 JSDoc + @example
 */

// =============================================================
// 业务数据(已给出,不是考点)
// =============================================================

/**
 * 组件库事件表 —— 事件名(小驼峰)→ 载荷类型
 *
 * @example
 *   const e: ComponentEvents['itemSelect'] = { id: 7 }
 */
export type ComponentEvents = {
  click: string
  itemSelect: { id: number }
  remove: { id: number; silent: boolean }
}

// =============================================================
// 🟢 Part 1 — EventPropName / BemClass
// =============================================================

// TODO: EventPropName —— 事件名 → handler prop 名(on + 首字母大写)
// 规格:EventPropName<'click'> = 'onClick'
//       EventPropName<'click' | 'itemSelect'> = 'onClick' | 'onItemSelect'
// 提示:Capitalize<K> 可以内嵌在模板占位符里
export type EventPropName<K extends string> = never & K // ← 替换(never & K 恒等于 never,写 & K 只是让骨架通过 noUnusedParameters 检查)

// TODO: BemClass —— 块名 + 元素名 → BEM 类名
// 规格:BemClass<'card', 'title' | 'content'> = 'card__title' | 'card__content'
// JSDoc 必须回答:M 是联合时,为什么不用写条件类型它就分布了?
export type BemClass<B extends string, M extends string> = never & B & M // ← 替换(never & B & M 恒等于 never,见上)

// =============================================================
// 🟡 Part 2 — SnakeToCamel1 / HandlerToEvent / ExtractRouteParam
// =============================================================

// TODO: SnakeToCamel1 —— 单下划线 snake_case → camelCase
// 规格:SnakeToCamel1<'user_name'> = 'userName'
//       SnakeToCamel1<'login'> = 'login'(无下划线原样透传)
// 提示:`${infer Head}_${infer Tail}` 在第一个下划线处拆成两段,再 Capitalize 拼回
export type SnakeToCamel1<T extends string> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: HandlerToEvent —— handler 名 → 事件名(反向转换)
// 规格:HandlerToEvent<'onClick'> = 'click'
//       HandlerToEvent<'onItemSelect'> = 'itemSelect'
//       HandlerToEvent<'only'> = 'only' ← 陷阱!剥前缀前先确认剩余部分首字母是大写
// 提示:Rest extends Capitalize<Rest> 判断"是不是真 handler 名"(Day 20 的模式匹配)
export type HandlerToEvent<T extends string> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: ExtractRouteParam —— 从路由提取参数名(限定参数段在末尾)
// 规格:ExtractRouteParam<'/users/:id'> = 'id'
//       ExtractRouteParam<'/settings/profile'> = never
//       ExtractRouteParam<'/users/:uid/posts/:pid'> = 'uid/posts/:pid' ← 先猜再验!
// JSDoc 必须记录:多参数路径的真实行为 + ${string} 按最短匹配锚定第一个 ':'
export type ExtractRouteParam<T extends string> = never & T // ← 替换(never & T 恒等于 never,见上)

// =============================================================
// 🔴 Part 3 — SnakeToCamel / PropEventHandlers / snakeToCamel
// =============================================================

// TODO: SnakeToCamel —— 递归版,任意多个下划线
// 规格:SnakeToCamel<'user_created_at'> = 'userCreatedAt'
//       SnakeToCamel<'order_total_amount_cents'> = 'orderTotalAmountCents'
//       SnakeToCamel<'name'> = 'name'(递归终止)
// 提示:和 SnakeToCamel1 只差一处 —— Tail 部分递归调用自己
export type SnakeToCamel<T extends string> = never & T // ← 替换(never & T 恒等于 never,见上)

// TODO: PropEventHandlers —— 事件表 → handler props(合卷大题:映射 + as 改键 + 模板拼接)
// 规格:PropEventHandlers<{ click: string; itemSelect: { id: number } }>
//       = { onClick: (payload: string) => void; onItemSelect: (payload: { id: number }) => void }
// JSDoc 必须回答:1) 键名转换放在哪个子句? 2) 键为什么要写 K & string?
export type PropEventHandlers<T> = never & T // ← 替换(never & T 恒等于 never,见上)

/**
 * 运行时版 snake_case → camelCase(签名已给,不是考点;实现是)
 *
 * 要求:replace 回调参数显式标注类型(禁隐式 any);
 * 做完把"运行时正则 vs 类型层 ${infer H}_${infer T} 是同一个模式"的观察写进本 JSDoc。
 *
 * @example
 *   snakeToCamel('user_created_at')  // => 'userCreatedAt'
 */
export function snakeToCamel(s: string): string {
  // TODO: 正则一行;回调参数类型标注好
  void s
  throw new Error('TODO')
}
