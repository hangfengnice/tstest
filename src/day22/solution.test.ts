import { describe, it, expect, expectTypeOf } from 'vitest'
import { snakeToCamel } from './solution.js'
import type {
  ComponentEvents,
  EventPropName,
  BemClass,
  SnakeToCamel1,
  HandlerToEvent,
  ExtractRouteParam,
  SnakeToCamel,
  PropEventHandlers,
} from './solution.js'

// =============================================================
// 🟢 Part 1 — EventPropName / BemClass
// =============================================================

describe('Day 22 — 🟢 EventPropName(事件名 → handler 名)', () => {
  it('单个事件:on + 首字母大写', () => {
    expectTypeOf<EventPropName<'click'>>().toEqualTypeOf<'onClick'>()
  })

  it('事件联合:自动分布成 handler 联合', () => {
    expectTypeOf<EventPropName<'click' | 'itemSelect'>>().toEqualTypeOf<
      'onClick' | 'onItemSelect'
    >()
  })

  it('非字符串必须编译报错(约束拦截)', () => {
    // @ts-expect-error —— 123 不满足约束 string
    type Bad = EventPropName<123>
    const probe: Bad[] = []
    void probe
  })
})

describe('Day 22 — 🟢 BemClass(BEM 类名拼接)', () => {
  it('块 + 单个元素', () => {
    expectTypeOf<BemClass<'card', 'title'>>().toEqualTypeOf<'card__title'>()
  })

  it('元素联合:不用写条件类型,联合自动分布', () => {
    expectTypeOf<BemClass<'card', 'title' | 'content'>>().toEqualTypeOf<
      'card__title' | 'card__content'
    >()
  })
})

// =============================================================
// 🟡 Part 2 — SnakeToCamel1 / HandlerToEvent / ExtractRouteParam
// =============================================================

describe('Day 22 — 🟡 SnakeToCamel1(单下划线转驼峰)', () => {
  it('一个下划线:拆开 + 首字母大写拼回', () => {
    expectTypeOf<SnakeToCamel1<'user_name'>>().toEqualTypeOf<'userName'>()
  })

  it('没有下划线:原样透传', () => {
    expectTypeOf<SnakeToCamel1<'login'>>().toEqualTypeOf<'login'>()
  })
})

describe('Day 22 — 🟡 HandlerToEvent(handler 名 → 事件名,反向转换)', () => {
  it('剥掉 on 前缀并小写首字母', () => {
    expectTypeOf<HandlerToEvent<'onClick'>>().toEqualTypeOf<'click'>()
    expectTypeOf<HandlerToEvent<'onItemSelect'>>().toEqualTypeOf<'itemSelect'>()
  })

  it('陷阱:only 以 on 开头但不是 handler 名,必须原样返回', () => {
    expectTypeOf<HandlerToEvent<'only'>>().toEqualTypeOf<'only'>()
  })

  it('普通事件名(无 on 前缀)原样返回', () => {
    expectTypeOf<HandlerToEvent<'change'>>().toEqualTypeOf<'change'>()
  })
})

describe('Day 22 — 🟡 ExtractRouteParam(路由参数提取)', () => {
  it('末尾参数段:提取参数名', () => {
    expectTypeOf<ExtractRouteParam<'/users/:id'>>().toEqualTypeOf<'id'>()
  })

  it('无参数:never', () => {
    expectTypeOf<ExtractRouteParam<'/settings/profile'>>().toEqualTypeOf<never>()
  })

  it('边界观察:多参数路径拿到的是第一个 : 之后的整段尾巴(先猜再验!)', () => {
    // 既不是 'uid' 也不是 'pid':${string} 按最短匹配锚定到第一个 ':'
    // 把你的原始猜测和真实行为都写进 JSDoc
    expectTypeOf<
      ExtractRouteParam<'/users/:uid/posts/:pid'>
    >().toEqualTypeOf<'uid/posts/:pid'>()
  })

  it('非字符串必须编译报错(约束拦截)', () => {
    // @ts-expect-error —— 123 不满足约束 string
    type Bad = ExtractRouteParam<123>
    const probe: Bad[] = []
    void probe
  })
})

// =============================================================
// 🔴 Part 3 — SnakeToCamel / PropEventHandlers / snakeToCamel
// =============================================================

describe('Day 22 — 🔴 SnakeToCamel(递归版,任意多个下划线)', () => {
  it('两个下划线', () => {
    expectTypeOf<SnakeToCamel<'user_created_at'>>().toEqualTypeOf<'userCreatedAt'>()
  })

  it('三个下划线', () => {
    expectTypeOf<
      SnakeToCamel<'order_total_amount_cents'>
    >().toEqualTypeOf<'orderTotalAmountCents'>()
  })

  it('无下划线:原样透传(递归的终止条件)', () => {
    expectTypeOf<SnakeToCamel<'name'>>().toEqualTypeOf<'name'>()
  })
})

describe('Day 22 — 🔴 PropEventHandlers(事件表 → handler props,合卷大题)', () => {
  it('键名 onXxx 生成 + 载荷类型进函数签名', () => {
    expectTypeOf<
      PropEventHandlers<{ click: string; itemSelect: { id: number } }>
    >().toEqualTypeOf<{
      onClick: (payload: string) => void
      onItemSelect: (payload: { id: number }) => void
    }>()
  })

  it('对完整事件表 ComponentEvents 生成三个 handler props', () => {
    expectTypeOf<PropEventHandlers<ComponentEvents>>().toEqualTypeOf<{
      onClick: (payload: string) => void
      onItemSelect: (payload: { id: number }) => void
      onRemove: (payload: { id: number; silent: boolean }) => void
    }>()
  })

  it('handler 的参数类型由事件载荷决定(传错载荷编译报错)', () => {
    const handlers: PropEventHandlers<ComponentEvents> = {
      onClick: (_label) => void _label,
      onItemSelect: (_item) => void _item,
      onRemove: (_payload) => void _payload,
    }
    // @ts-expect-error —— click 的载荷是 string,不能当 { id: number } 用
    handlers.onClick({ id: 1 })
    void handlers
  })
})

describe('Day 22 — 🔴 snakeToCamel(运行时版)', () => {
  it('多下划线逐个转驼峰', () => {
    expect(snakeToCamel('user_created_at')).toBe('userCreatedAt')
    expect(snakeToCamel('order_total_amount_cents')).toBe('orderTotalAmountCents')
  })

  it('无下划线原样返回', () => {
    expect(snakeToCamel('name')).toBe('name')
  })

  it('运行时正则与类型层模式是同一个"模式"的两种写法', () => {
    // 类型层:SnakeToCamel<'user_created_at'> = 'userCreatedAt'
    // 运行时:snakeToCamel('user_created_at') = 'userCreatedAt'
    // 两层对同一输入产出同一个字符串 —— 注意方向:运行时返回宽 string,
    // 收窄到字面量是类型层的"计算结果",不是函数签名能承诺的
    const input = 'user_created_at' as const
    const typed: SnakeToCamel<typeof input> = 'userCreatedAt'
    expect(snakeToCamel(input)).toBe(typed)
  })
})
