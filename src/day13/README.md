# Day 13 — Vue Props 类型设计(纯 TS 模拟)

## 业务场景

你写了 6 年 Vue,`defineProps` / `withDefaults` 天天写。今天的问题是:**这两层语法糖在类型层做了什么**?不 import vue,用纯 TS 把 Props 的类型机制复刻一遍。

业务对象:一个 `MyButton` 组件。

- **必选**:`type: 'primary' | 'ghost'`(风格)、`label: string`(文案)
- **可选**:`size?: 'sm' | 'md' | 'lg'`(默认 `'md'`)、`disabled?: boolean`(默认 `false`)、`loading?: boolean`(无默认)
- 默认值对象:`{ size: 'md', disabled: false }`(withDefaults 的第二个参数)

要做的三件事:Props 接口 → 默认值融合(`可选传入 → 组件内必有值`)→ 手写简化版 `ExtractPropTypes`(Vue 从**运行时 props 定义**反推类型的机制)。

---

## Part 1 — 🟢 基础:Props 接口

1. `ButtonProps`(形状见上)。注意两个严格模式细节(测试有反例):
   - 可选字段**不能显式传 `undefined`**(exactOptionalPropertyTypes);
   - 必选字段缺失、字面量不在联合内,都是编译错误。

## Part 2 — 🟡 进阶:默认值对象与 ResolveProps

2. `buttonDefaults = { size: 'md', disabled: false }` —— **必须 `as const`**。
   - 测试断言它满足 `Partial<ButtonProps>`;再给一个**不加 as const 的反例**(宽化成 string 后不满足)。
   - 想清楚:`Partial<T>` 和默认值对象是什么关系?为什么默认值对象只能是"部分字段"?
3. `ResolveProps<T, D extends Partial<T>>` —— withDefaults 之后组件内部看到的类型:
   - 有默认值的字段:从"可选"变成"**必有值**",类型保持 `T[K]`(不是默认值的字面量);
   - 没默认值的字段:原样保留(该可选还是可选)。
   - **两个坑**(踩了才知道):
     a. `Omit<T, keyof D> & { [K in keyof D]: T[K] }` 里直接写 `T[K]` 会被 TS 拦 —— "K 不能索引 T"(想想条件类型守门);
     b. 坑 a 修好后,对**可选属性**做索引访问会混进 `undefined`(表示"可能不存在")—— 但有默认值的字段必有值,想想 `NonNullable`。
4. `resolveButtonProps(props)` —— 签名已给,填实现:spread 合并,可选字段缺省时取默认值。

## Part 3 — 🔴 边界:手写简化版 ExtractPropTypes

Vue 除了从 TS 类型生成 props,还能反过来:**运行时 props 定义对象 → TS 类型**。测试里已经定义好按钮的运行时定义(模拟 `props: { type: { type: String, required: true }, ... }`):

```ts
const buttonPropDefs = {
  type: { type: (): 'primary' | 'ghost' => 'primary', required: true as const },
  label: { type: (): string => '', required: true as const },
  size: { type: (): 'sm' | 'md' | 'lg' => 'md' },
  disabled: { type: (): boolean => false },
}
```

5. `PropDefinition<T>` 接口:`type: () => T`(类型构造器)、`required?: true`(**字面量 true**,不是 boolean —— 想想为什么,和测试里的 `true as const` 呼应)、`default?: T`。
6. `InferPropType<D>`:`D extends PropDefinition<infer V> ? V : never` —— 用 `infer` 抓出泛型实参。
7. `ExtractPropTypes<D>`(组件内部视角):所有 prop 都有值 —— 同构映射逐字段推断。
8. `ExtractPublicPropTypes<D>`(父组件传参视角):`required: true` 的必选,其余可选 —— **key remapping**(`[K in keyof D as 条件 ? K : never]`)把键过滤到两个分支,一个不加 `?`、一个加 `?`。

---

## 验收清单

- [ ] `pnpm typecheck` 零错,`pnpm test` 全过
- [ ] 零 `any`(本题应该零 `as`,测试里仅 `true as const` 和 `as const` 两处刻意用法)
- [ ] 所有 export 有 JSDoc + `@example`
- [ ] 可选字段不收显式 `undefined`;必选缺失 / 字面量越界都编译报错
- [ ] `buttonDefaults` 加 as const;能赋给 `Partial<ButtonProps>`;不加 as const 的对象赋不进去
- [ ] `ResolveProps`:有默认值的字段变必有值、类型是 `T[K]`;`resolveButtonProps` 运行时正确合并
- [ ] `ExtractPropTypes` 推出全必有值的形状;`ExtractPublicPropTypes` 只让 required 字段必选
- [ ] 能说清 `Partial<T>`、`ResolveProps`、`ExtractPublicPropTypes` 三个视角分别对应 Vue 的哪一层

## 写完后

贴 `src/day13/solution.ts` 过来,说:"点评 + 解释为什么这样改"。

**建议节奏**:Part 1 10 分钟 → Part 2 30 分钟(两个坑自己踩)→ Part 3 40 分钟(infer + key remapping 是本周新面孔)。
