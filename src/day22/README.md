# Day 22 — 模板字面量类型:组件库事件系统与命名转换

> 字符串从今天起是"可计算的类型":拼接(`on${...}`)、大小写变换(Capitalize 家族)、
> 拆解提取(infer + 模板)。Vue 的 `defineEmits`、组件库的 `onXxx` props、
> Nuxt 的路由参数、后端 snake_case → 前端 camelCase —— 全是这一套。
> 今天同时是第三阶段前半程(19-21)的合卷:映射类型 + as 重映射 + infer 都会登场。

## 业务场景

chipRunner 要把散落的 UI 组件收编成**内部组件库**(Nuxt 模块),四条硬约定:

1. **事件系统**:组件内部事件名用小驼峰(`click` / `itemSelect` / `itemRemove`),
   对外暴露的 props 用 `on` 前缀大驼峰(`onClick` / `onItemSelect`)—— handler props
   的名字和类型必须从事件表**自动生成**,手写必然失同步
2. **BEM 类名**:`'card'` 块 + `'title'` 元素 → `'card__title'`
3. **字段命名**:后端 Go 服务输出 snake_case(`user_created_at`),前端全 camelCase(`userCreatedAt`),
   转换函数和转换类型要一一对应
4. **路由参数**:Nuxt 页面路由 `'/users/:id'`,权限系统要自动提取参数名(`'id'`)

给定的业务类型(不是考点):`ComponentEvents`(事件表,载荷类型各异)。

## 预备知识(先做实验,再做题)

```ts
type A = `on${Capitalize<'click'>}`   // 悬停 A → 'onClick'
type B = `a_${'x' | 'y'}`             // 悬停 B → 联合又自动分布了!(Day 20 题 7 的复习)
type C = `${'on' | 'off'}${'click' | 'change'}`  // 四个组合,猜猜是哪四个?
```

内置四个字符串工具:`Uppercase` / `Lowercase` / `Capitalize` / `Uncapitalize`,
它们只作用于**字符串字面量类型**(对宽 `string` 无能为力 —— 想想为什么)。

---

## 任务(按难度梯度)

### 🟢 基础题 1 — `EventPropName<K>`:事件名 → handler prop 名

**业务动机**:约定 1 的核心转换。

**规格**:

| 输入 | 输出 |
|---|---|
| `EventPropName<'click'>` | `'onClick'` |
| `EventPropName<'click' \| 'itemSelect'>` | `'onClick' \| 'onItemSelect'` |

**提示**:字面量 `on` 直接拼在模板里;`Capitalize<K>` 可以**内嵌在占位符里**。

### 🟢 基础题 2 — `BemClass<B, M>`:块名 + 元素名 → BEM 类名

**规格**:

| 输入 | 输出 |
|---|---|
| `BemClass<'card', 'title'>` | `'card__title'` |
| `BemClass<'card', 'title' \| 'content'>` | `'card__title' \| 'card__content'` |

**提示**:两个泛型参数都是占位符;想想 M 是联合时为什么不用写条件类型它就分布了。

### 🟡 进阶题 3 — `SnakeToCamel1<T>`:单下划线转驼峰

**业务动机**:约定 3 的第一版(后端字段最多一层下划线)。

**规格**:

| 输入 | 输出 |
|---|---|
| `SnakeToCamel1<'user_name'>` | `'userName'` |
| `SnakeToCamel1<'login'>` | `'login'`(没有下划线,原样返回) |

**提示**:模板也是模式 —— `` `${infer Head}_${infer Tail}` `` 把字符串在**第一个**下划线处
拆成两段(和 Day 20 的元组 `[first: infer F, ...rest: infer R]` 是同一个思路);
`Tail` 要首字母大写后拼回去。注意 false 分支要原样透传。

### 🟡 进阶题 4 — `HandlerToEvent<T>`:handler 名 → 事件名(反向转换)

**业务动机**:组件库收到外部传来的 prop 名(如插件包装层),要反查出事件名。

**规格**:

| 输入 | 输出 |
|---|---|
| `HandlerToEvent<'onClick'>` | `'click'` |
| `HandlerToEvent<'onItemSelect'>` | `'itemSelect'` |
| `HandlerToEvent<'only'>` | `'only'` ← **陷阱!** `only` 恰好以 `on` 开头,但它不是 handler 名 |

**提示**:剥掉 `on` 前缀 + `Uncapitalize`;**判断"真的剥不剥"的标准**:
剥掉前缀后剩下的部分,首字母是不是大写?(用 `Rest extends Capitalize<Rest>` 判断 ——
这又是 Day 20 学的"模式匹配 + 条件类型"。)

### 🟡 进阶题 5 — `ExtractRouteParam<T>`:从路由提取参数名

**业务动机**:约定 4。限定:**参数段在路径末尾**(如 `'/users/:id'`)。

**规格**:

| 输入 | 输出 |
|---|---|
| `ExtractRouteParam<'/users/:id'>` | `'id'` |
| `ExtractRouteParam<'/settings/profile'>` | `never`(无参数) |
| `ExtractRouteParam<'/users/:uid/posts/:pid'>` | `'uid/posts/:pid'` ← 先猜再看! |

**要求**:最后一行**先写下你的猜测再跑测试**。JSDoc 里记录:
多参数路径拿到的既不是 `'uid'` 也不是 `'pid'`,而是"第一个 `:` 之后的整段尾巴" ——
`${string}` 模式按**最短匹配**锚定到第一个 `:`。要精确提取每个参数,需要递归 split(Day 23 再战)。

**提示**:模式是 `` `${string}:${infer P}` `` —— 前面用 `${string}` 当"任意前缀"的通配。

### 🔴 边界题 6 — `SnakeToCamel<T>`:递归版,任意多个下划线

**业务动机**:真实后端字段不止一层下划线(`user_created_at` / `order_total_amount_cents`)。

**规格**:

| 输入 | 输出 |
|---|---|
| `SnakeToCamel<'user_created_at'>` | `'userCreatedAt'` |
| `SnakeToCamel<'order_total_amount_cents'>` | `'orderTotalAmountCents'` |
| `SnakeToCamel<'name'>` | `'name'` |

**提示**:和 `SnakeToCamel1` 的差别只有一个 —— **Tail 部分递归调用自己**。
类型别名可以引用自己(递归的深度上限约 50,本题远用不到)。

### 🔴 边界题 7 — `PropEventHandlers<T>`:事件表 → handler props(合卷大题)

**业务动机**:组件库的对外 props 由事件表自动生成 —— 这是 19/20/21/22 四天的总装。

**规格**:

| 输入 | 输出 |
|---|---|
| `PropEventHandlers<{ click: string; itemSelect: { id: number } }>` | `{ onClick: (payload: string) => void; onItemSelect: (payload: { id: number }) => void }` |
| `PropEventHandlers<ComponentEvents>` | 三个 handler 的完整 props(测试断言) |

**要求**:JSDoc 回答两个问题:
1. 键名转换用的什么(题 1 的成果放进 **as 子句** —— Day 21 重映射 + Day 22 模板的合体)
2. 为什么键要写成 `K & string`?(提示:`keyof T` 可能含 `number` / `symbol`,而模板占位符只吃 `string`)

**提示**:骨架只有一行,但它是四天技能的串聯:映射类型遍历 + as 改键 + 模板拼接 + Capitalize。

### 🔴 边界题 8 — `snakeToCamel`:运行时版(签名已给)

**业务动机**:类型层有了 `SnakeToCamel<T>`,运行时的转换函数也不能少(接口层数据是动态的)。

**规格**(签名不是考点,直接给;实现是):

```ts
snakeToCamel('user_created_at')  // => 'userCreatedAt'
snakeToCamel('name')             // => 'name'
```

**要求**:正则一行搞定;`replace` 的回调参数要有明确类型标注(禁隐式 any)。
做完对照:运行时的正则和类型层的 `` `${infer H}_${infer T}` `` 是不是**同一个"模式"的两种写法**?
把这个观察写进 JSDoc。

---

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm test` 全绿
- [ ] 零 `any`、零 `as`
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] `ExtractRouteParam` 的"先猜后验"结论写在 JSDoc(多参数路径的真实行为)
- [ ] `PropEventHandlers` 的两个思考题(`as` 子句 / `K & string`)回答完整
- [ ] 测试里的 `@ts-expect-error` 反例实现后依然精准命中(不留 unused)

## 写完后

贴 `solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:🟢 15 分钟 → 🟡 40 分钟 → 🔴 45 分钟。卡超过 15 分钟再来问,要提示不要答案。
