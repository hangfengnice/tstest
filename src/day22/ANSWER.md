# Day 22 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm test` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

## 一、参考实现

已通过本 day 全部验收测试(23/23,vitest typecheck 模式双跑 46/46)+ `pnpm typecheck` 该目录零错误。

```ts
// 🟢 1. 事件名 → handler 名:Capitalize 直接内嵌在占位符里
export type EventPropName<K extends string> = `on${Capitalize<K>}`

// 🟢 2. BEM 类名:模板占位符遇到联合自动做笛卡尔积,不用手写分布
export type BemClass<B extends string, M extends string> = `${B}__${M}`

// 🟡 3. 单下划线转驼峰:模板即模式,false 分支原样透传
export type SnakeToCamel1<T extends string> =
  T extends `${infer Head}_${infer Tail}` ? `${Head}${Capitalize<Tail>}` : T

// 🟡 4. 反向转换:剥 on 前缀前先验证剩余部分首字母是大写(防 'only')
export type HandlerToEvent<T extends string> =
  T extends `on${infer Rest}`
    ? Rest extends Capitalize<Rest>
      ? Uncapitalize<Rest>
      : T
    : T

// 🟡 5. 路由参数提取:${string} 是最短匹配,锚定第一个 ':'
export type ExtractRouteParam<T extends string> =
  T extends `${string}:${infer P}` ? P : never

// 🔴 6. 递归版:和 SnakeToCamel1 只差"Tail 递归调用自己"这一处
export type SnakeToCamel<T extends string> =
  T extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : T

// 🔴 7. 合卷:as 子句改键(模板拼接)+ 值列换函数签名
export type PropEventHandlers<T> = {
  [K in keyof T as `on${Capitalize<K & string>}`]: (payload: T[K]) => void
}

// 🔴 8. 运行时版:正则一行,回调参数显式标注
export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_match: string, c: string) => c.toUpperCase())
}
```

## 二、常见错误写法(点评人视角)

### 1. SnakeToCamel1 忘了 false 分支(转换类工具最经典的坑)

```ts
❌ export type SnakeToCamel1<T extends string> =
     T extends `${infer H}_${infer T2}` ? `${H}${Capitalize<T2>}` : never
```

现象:`SnakeToCamel1<'login'>` 变成 **never** —— 'login' 没有下划线,模式匹配失败,
掉进了你写的 never。测试直接挂("没有下划线:原样透传")。转换类工具的约定:
**匹配不上就原样透传**(false 分支返回 T),"提取类"工具才是匹配不上给 never
(对比 ExtractRouteParam)。两类工具的兜底方向相反,想清楚你要的是哪一类。

```ts
✅ ... ? `${H}${Capitalize<T2>}` : T
```

### 2. SnakeToCamel1 只拼不 CAPITALIZE(或拼错位置)

```ts
❌ `${H}${T2}`                // 'user_name' → 'username',不是驼峰
❌ `${Capitalize<H>}${T2}`    // 大写了 Head!→ 'Username'
```

现象:toEqualTypeOf 不匹配。驼峰的规则是"下划线**后**的段首字母大写",
Head 是第一段,保持原样。递归版同理 —— 只有 Tail 经过 Capitalize,
中间段靠递归时的 `Capitalize<SnakeToCamel<Tail>>` 链条逐段大写。

```ts
✅ `${Head}${Capitalize<Tail>}` / 递归版 `${Head}${Capitalize<SnakeToCamel<Tail>>}`
```

### 3. HandlerToEvent 无脑剥前缀('only' 陷阱)

```ts
❌ export type HandlerToEvent<T extends string> =
     T extends `on${infer Rest}` ? Uncapitalize<Rest> : T
```

现象:`HandlerToEvent<'only'>` = **'ly'**(测试挂)。字符串 'only' 确实以 'on'
开头,模式匹配是"成功"的 —— 问题不在模式,在语义。判断标准:剥掉 on 后
剩余部分的首字母必须是大写(`Rest extends Capitalize<Rest>`,
'Click' 满足、'ly' 不满足),这才是"on + 大驼峰事件名"的完整形状。
注意用的是 **Capitalize**(首字母大写)不是 Uppercase(全大写)。

```ts
✅ Rest extends Capitalize<Rest> ? Uncapitalize<Rest> : T
```

### 4. ExtractRouteParam 以为拿到最后一个参数(先猜后验)

```ts
// 猜测:'pid'(以为 ${string} 贪心吃到最后一个 ':')
// 实际:'uid/posts/:pid'
```

现象:多参数路径断言挂。结论(务必写进 JSDoc):`${string}` 通配是**最短匹配**,
一旦后面的 `:` 能对上就立刻停止,所以锚定的是**第一个**冒号;infer P 把剩余
部分**整体**吃掉。所以 '/users/:uid/posts/:pid' → 'uid/posts/:pid'。
要逐个提取参数名,得按 '/' 递归拆段过滤 —— Day 23 递归类型之后才打得动。
另两个变体错误:`${string}:${string}`(不用 infer)结果永远是宽 boolean;
只有 `` `:${infer P}` ``(漏掉前缀通配)只能匹配以 ':' 开头的路径。

```ts
✅ T extends `${string}:${infer P}` ? P : never
```

### 5. PropEventHandlers 忘了 `K & string`

```ts
❌ [K in keyof T as `on${Capitalize<K>}`]: (payload: T[K]) => void
```

现象:**TS2344**(`Type 'K' cannot be used to satisfy the constraint 'string'` 之类)
—— `keyof T` 的完整类型是 `string | number | symbol`(对象的键允许三种),
而 Capitalize 和模板占位符只吃 string。`K & string` 交掉 number/symbol 成分,
占位符才接受。这是一行里同时复习 Day 21(映射/as)和模板约束的细节。

```ts
✅ [K in keyof T as `on${Capitalize<K & string>}`]: (payload: T[K]) => void
```

### 6. PropEventHandlers 值列写成载荷类型本身

```ts
❌ [K in keyof T as ...]: T[K]
```

现象:测试里 `onClick: (_label) => void _label` 报 **TS7006**(参数隐式 any)
—— 属性类型是 `string`,不是函数, contextual typing 给不出参数类型;
且 `handlers.onClick({ id: 1 })` 那条 @ts-expect-error 会变 unused(TS2578)。
handler prop 的形状是**(payload: 载荷) => void**,值列要造一个函数类型。

```ts
✅ [K in keyof T as ...]: (payload: T[K]) => void
```

### 7. snakeToCamel 的正则缺 g 标志 / 缺捕获组

```ts
❌ s.replace(/_([a-z])/, (_, c) => c.toUpperCase())   // 没 g:只转第一个
❌ s.replace(/_./g, (_, c) => c.toUpperCase())         // 没捕获组:c 是完整匹配 '_c'
```

现象:第一个 'user_created_at' → 'userCreated_at'(第二个下划线没处理),测试挂;
没捕获组时拿不到"下划线后面的字母",toUpperCase 作用在 '_c' 上等于没转。
还有一个细节:回调参数必须显式标注(`(_match: string, c: string)`),
否则 noImplicitAny 报 TS7006 —— lib 的 replace 签名给了上下文,但自己写明
才是"零隐式 any"的姿态。

```ts
✅ s.replace(/_([a-z])/g, (_match: string, c: string) => c.toUpperCase())
```

### 8. 概念坑:Uppercase 家族对宽 string 无能为力

`Capitalize<string>` 的结果还是 `string`,不是"首字母大写的 string"。原因:
这四个工具是 TS 的内在方法(intrinsic),只对**字面量**可计算 —— "把 string 的
首字母大写"不存在有限的类型表示。所以本 day 所有工具的泛型约束都是
`extends string`,实际价值只在传入**字面量(或字面量联合)**时兑现;
这也解释了为什么 snakeToCamel 的运行时签名是 `string → string`
(见"三、思考题"最后一问)。

### 9. 递归版深度问题(概念,不踩不亏)

类型递归有实例化深度上限(约 50)。本题的下划线最多三五个,远碰不到;
但如果你把 Day 23 的 DeepReadonly 写成对 `object` 无差别递归,
函数/日期等特殊对象会把深度吃爆(Type instantiation is excessively deep)。
数组、函数要在递归**之前**分流 —— Day 23 的正题。

## 三、思考题参考答案

### BemClass:M 是联合时,为什么不用写条件类型它就分布了?

模板字面量的每个占位符都是独立的分布点:`${B}__${M}` 会在固定 B 的前提下,
让 M 的每个联合成员各生成一个字符串,再做联合 —— 即笛卡尔积。
条件类型的裸参数分布(Day 20)只是"分布"的一种来源,模板占位符是另一种,
而且**不需要任何语法铺垫**。`BemClass<'card', 'title' | 'content'>` =
'card__title' | 'card__content' 就是这么来的。

### HandlerToEvent:判断"真的剥不剥"的标准是什么?

不是"是否以 on 开头"(那是必要条件),而是"剥掉 on 之后是否恰好剩一个
大驼峰标识符":`Rest extends Capitalize<Rest>`。本质是在验证**剩余部分的形状**,
这是模式匹配里防误杀的通用手法 —— 前缀匹配 + 后缀形状校验。

### ExtractRouteParam:先猜后验的结论

猜测多半是 'pid' 或 'uid';实际是 **'uid/posts/:pid'**。原因:${string} 最短
匹配 + infer P 整体吃尾。这个实验的教训:**模板里的"通配"不是正则的贪心/惰性
语义,是 TS 自己的推断规则** —— 写类型前先想清楚 infer 的切割点在哪。

### PropEventHandlers 两问

1. 键名转换放在 **as 子句**(键重映射的位置),值列负责 handler 的函数签名 ——
   键和值各司其职,一行映射类型同时完成改名和换形;
2. 键写 `K & string` 因为 `keyof T` 可能含 number/symbol,模板占位符只吃 string
   —— `K & string` 是从联合里收窄出 string 成分的标准写法。

### snakeToCamel:运行时正则 vs 类型层模式

`/_([a-z])/g` 和 `` `${infer H}_${infer T}` ``(递归)是同一个"模式"的两种写法:
都在下划线处切一刀、后段首字母大写拼回。差别在方向:运行时函数对任意输入
执行,返回宽 string;字面量 'userCreatedAt' 是**类型层的计算结果**,
只有当输入类型在编译期已知(字面量)时才能得出 —— 所以函数签名不能承诺
`SnakeToCamel<S>`,那是类型层的能力,不是运行时签名能表达的。

### 预备知识实验(README 开头)

`type C = `${'on' | 'off'}${'click' | 'change'}`` = 'onclick' | 'onchange' |
'offclick' | 'offchange' —— 两个占位符各分布一次,2×2 笛卡尔积。

## 四、验收自查清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全绿
- [ ] 零 `any`、零 `as`(replace 回调参数有显式类型标注)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] `ExtractRouteParam` 的"先猜后验"结论(最短匹配、整段尾巴)写在 JSDoc
- [ ] `PropEventHandlers` 两个思考题(as 子句 / `K & string`)回答完整
- [ ] `EventPropName<123>`、`ExtractRouteParam<123>` 的 @ts-expect-error
      依然精准命中(约束拦截,无 TS2578 unused)
- [ ] `handlers.onClick({ id: 1 })` 的 @ts-expect-error 精准命中
      (载荷 string 不能当 { id: number } 用)
