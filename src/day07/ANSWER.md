# Day 7 — 参考答案 + 点评要点

> 使用规则:自己写完、`pnpm check:day 07` 全绿之后再打开这份文件。
> 对照的目的不是"对答案",是找"你没想到的第二种写法"和"你侥幸没踩的坑"。

以下参考实现已通过本 day 全部验收测试(`npx vitest run src/day07` 34/34 全绿,`pnpm typecheck` 本 day 零错误)。

## 一、参考实现

```ts
/**
 * Day 7 — 手写工具类型:MyPartial / MyRequired / MyReadonly / MyPick / MyOmit
 *
 * 规则:五个 My* 手写、零 any、零 as,export 带 JSDoc + @example
 */

// =============================================================
// Part 1 — 业务类型 + 可选 / 必填
// =============================================================

/**
 * chip 元数据 —— 本 day 全部工具类型的试验对象。
 *
 * 两个特殊字段是故意的:
 *   - readonly createdAt:验证映射类型是否保留 readonly;
 *   - description?:验证 ? 是否保留,
 *     以及 exactOptionalPropertyTypes 下"可选 ≠ 可传 undefined"。
 *
 * @example
 *   const chip: ChipMeta = {
 *     id: 'chip_1', name: 'formatter', ownerEmail: 'dev@chip.cn',
 *     createdAt: '2026-09-01T08:00:00Z',
 *     // description 缺省,合法
 *   }
 */
export type ChipMeta = {
  id: string
  name: string
  ownerEmail: string
  readonly createdAt: string
  description?: string
}

/**
 * MyPartial —— 所有属性变可选。
 *
 * 积木:`{ [K in keyof T]?: T[K] }`。
 * `[K in keyof T]` 是**同态**(homomorphic)映射:直接遍历 T 自己的键,
 * TS 实例化时逐属性复制声明 —— 修饰符(readonly / ?)天然带上。
 *
 * @example
 *   type R = MyPartial<ChipMeta>
 *   // => { id?: string; name?: string; ownerEmail?: string;
 *   //      readonly createdAt?: string; description?: string }
 *   // readonly 被保留 —— 这就是同态的意义
 */
export type MyPartial<T> = {
  [K in keyof T]?: T[K]
}

/**
 * MyRequired —— 移除可选。
 *
 * 【`-?` 的副作用:不只去掉 ?,还把属性类型里的 | undefined 一起赶走】
 * 严格模式下 `description?: string` 读出来是 `string | undefined`;
 * `-?` 之后是**纯 string**:`MyRequired<{ title?: string }> === { title: string }`,
 * 不是 `{ title: string | undefined }`。
 * Required 的语义是"现在必填且必有值",TS 为此明文规定 -? 同时剥掉 undefined。
 *
 * @example
 *   type A = MyRequired<{ title?: string }>  // => { title: string }
 */
export type MyRequired<T> = {
  [K in keyof T]-?: T[K]
}

// =============================================================
// Part 2 — 只读与投影
// =============================================================

/**
 * MyReadonly —— 加 readonly 修饰符。
 *
 * readonly 只存在于类型层:挡 `frozen.name = 'x'`(TS2540),
 * 运行时对象照样能改 —— 防手滑不防恶意。
 *
 * @example
 *   const frozen: MyReadonly<ChipMeta> = { ...chip }
 *   // frozen.name = '改名'  ← TS2540
 */
export type MyReadonly<T> = {
  readonly [K in keyof T]: T[K]
}

/**
 * MyPick —— 只保留指定键(同态映射,保留 readonly 和 ?)。
 *
 * 为什么修饰符不丢:`[P in K]` 里 K extends keyof T,
 * TS 识别出这是"从 T 身上挑键"的同态映射,按 T 的原始声明复制属性。
 *
 * @example
 *   type Card = MyPick<ChipMeta, 'id' | 'createdAt'>
 *   // => { id: string; readonly createdAt: string }
 *   type OnlyOpt = MyPick<ChipMeta, 'description'>
 *   // => { description?: string }  ← 可选语义保留
 */
export type MyPick<T, K extends keyof T> = {
  [P in K]: T[P]
}

/**
 * MyOmit —— 排除指定键(用刚写的 MyPick 组合)。
 *
 * 【实验结论(README Part 2 的考点)】
 *   1. 民间直接映射 `{ [P in Exclude<keyof T, K>]: T[P] }` 与内置 Omit 不对等:
 *      它**丢 ?** —— `description?: string` 变成必填 `description: string | undefined`,
 *      同时也**丢 readonly**(createdAt 变可写)。
 *      原因:遍历的键来自 Exclude 算出的字符串联合,不再是 `keyof T` 原样,
 *      TS 不认它同态,修饰符不复制,只能用 T[P](读可选属性 → string | undefined)垫底。
 *   2. 组合 MyPick 才与内置对等:Exclude 只算键,取属性交给同态的 MyPick,
 *      修饰符全程保留。内置 Omit 源码就是 `Pick<T, Exclude<keyof T, K>>`,
 *      官方也是这么绕的。
 *
 * @example
 *   type OnlyDescription = MyOmit<ChipMeta, 'id' | 'name' | 'ownerEmail' | 'createdAt'>
 *   // => { description?: string }  ← ? 还在
 */
export type MyOmit<T, K extends keyof T> = MyPick<T, Exclude<keyof T, K>>

// =============================================================
// Part 3 — 组合拳 + exactOptionalPropertyTypes
// =============================================================

/**
 * 编辑表单补丁类型 —— 剔除系统字段后的部分更新。
 *
 * 组合读法(从内往外):MyOmit 踢掉 id / createdAt(一个不许改、一个 readonly),
 * 外面套 MyPartial —— 补丁语义:想改哪个带哪个。
 *
 * @example
 *   const patch: EditPatch = { name: '新名字' }
 */
export type EditPatch = MyPartial<MyOmit<ChipMeta, 'id' | 'createdAt'>>

/**
 * 表单初始值:剔除系统字段,其余可编辑字段原样带出。
 *
 * 为什么不用 `{ ...meta }`:编译器其实**不报错**(展开不触发多余属性检查,
 * 这是类型层的一个"洞"),但 id / createdAt 会真的一起带出来,
 * 测试的 `toEqual({ name, ownerEmail, description })` 当场红 —— 这是运行时才能抓的坑。
 * 为什么不写 `description: meta.description`:meta.description 是 string | undefined,
 * exactOptionalPropertyTypes 下可选属性不接受显式 undefined(TS2375)。
 * 所以:显式列出可编辑字段 + 条件展开。
 *
 * @example
 *   toEditForm({ id: 'chip_1', name: 'f', ownerEmail: 'a@b.c', createdAt: 't' })
 *   // => { name: 'f', ownerEmail: 'a@b.c' } —— 没有 description 键
 */
export function toEditForm(meta: ChipMeta): EditPatch {
  return {
    name: meta.name,
    ownerEmail: meta.ownerEmail,
    // 条件展开:description 存在才带上这个键;不存在时键压根不出现
    // —— 可选属性的正确打开方式:缺省 ≠ 显式 undefined
    ...(meta.description !== undefined ? { description: meta.description } : {}),
  }
}

/**
 * 不可变合并:patch 覆盖,其余保留。
 *
 * 展开顺序即优先级:`{ ...base, ...patch }` 后面的赢。
 * "清空 description"用空串表达,不是 undefined。
 *
 * @example
 *   applyEdit(meta, { name: '新名字' })  // => { ...meta, name: '新名字' }
 */
export function applyEdit(base: ChipMeta, patch: EditPatch): ChipMeta {
  return { ...base, ...patch }
}
```

## 二、常见错误写法(点评人视角)

### 1. 直接映射版 MyOmit:丢 `?`(本 day 挖得最深的坑)

```ts
// ❌ 民间写法:键先用 Exclude 算好再映射
export type MyOmit<T, K extends keyof T> = {
  [P in Exclude<keyof T, K>]: T[P]
}
```

现象(均已用 tsc 实证):拿 `MyOmit<ChipMeta, 'id' | 'name' | 'ownerEmail' | 'createdAt'>`
和内置 Omit 对等断言时红 —— 内置是 `{ description?: string }`,这版是
`{ description: string | undefined }`(必填、还带 undefined)。两种直接可见的差异:

```ts
// 这版要求 description 必须出现:
const a: MyOmit<ChipMeta, 'id' | 'name' | 'ownerEmail' | 'createdAt'> = {}
// error TS2741: Property 'description' is missing in type '{}' but required in type ...
// 内置 Omit 下同一行合法
```

为什么:同态映射的判定条件是**遍历 `keyof T` 本身**(或约束到 keyof T 的类型参数 K)。
`Exclude<keyof T, K>` 算出来的是一个普通字符串联合,TS 不再认为你在"翻 T 的属性",
修饰符(readonly / ?)不复制,属性类型退化为索引读取 `T[P]`
—— 读可选属性天然并入 undefined。

✅ 正确姿势:Exclude 只算键,取属性交给同态的 MyPick:
`type MyOmit<T, K extends keyof T> = MyPick<T, Exclude<keyof T, K>>`。
内置 Omit 同款结构。

### 2. 同一坑的第二张脸:直接映射版连 readonly 也丢

```ts
type DirectOmit<T, K extends keyof T> = { [P in Exclude<keyof T, K>]: T[P] }
declare const t: DirectOmit<ChipMeta, 'id' | 'name'>
t.createdAt = 'hack'
// ← 这行【不报错】!readonly 修饰符被非同态映射弄丢了
```

组合 Pick 版同一行报 `TS2540: Cannot assign to 'createdAt' because it is a read-only property`(已实证)。
一句话总结:**同态映射 = 键直接来自 T,修饰符跟着走;键一旦"绕道"(Exclude / as 改名 / 拼新联合),修饰符全丢**。

### 3. toEditForm 写 `description: meta.description`(eOPT 坑)

```ts
// ❌
return { name: meta.name, ownerEmail: meta.ownerEmail, description: meta.description }
```

现象:

```
error TS2375: Type '{ name: string; ownerEmail: string; description: string | undefined; }'
is not assignable to type '...' with 'exactOptionalPropertyTypes: true'.
Consider adding 'undefined' to the types of the target's properties.
```

(已实证。)严格说这不是 eOPT 的"bug",是它的设计:可选属性表达"键可以不存在",
而 `description: undefined` 是"键存在、值为 undefined" —— 两种语义被刻意分开。

✅ 两种姿势:条件展开 `...(meta.description !== undefined ? { description: v } : {})`,
或 if 判断后逐键赋值。核心都是:**键不存在,而不是值为 undefined**。

### 4. toEditForm 直接 `{ ...meta }`(README 说"类型报错",实测要修正)

```ts
// ❌
export function toEditForm(meta: ChipMeta): EditPatch {
  return { ...meta }
}
```

实测(tsc 验证过):这行**编译器不报错** —— 展开表达式不触发多余属性检查,
`{ id, createdAt }` 多出来的键类型层放行。抓它的是测试:
`expect(form).toEqual({ name, ownerEmail, description })` 红 ——
因为实际对象里多了 id / createdAt 两个键,`toEqual` 是严格深比较。

✅ 显式构造目标形状。顺带的教训:**类型系统挡不住"带多了"的时候,
toEqual 断言就是你的第二道防线** —— 这也是为什么测试要这么写。

### 5. MyRequired 只想去 `?` 却留下 undefined(反向坑)

```ts
// ❌ 以为 -? 只是去掉问号
type MyRequired<T> = { [K in keyof T]: T[K] }   // ← 这甚至不是 Required,? 被原样保留!
```

现象:同态映射**不加任何修饰符**时,`?` 和 readonly 原样复制 ——
`{ [K in keyof T]: T[K] }` 就是 T 的同义改写,什么都没变。
要"去掉"必须显式 `-?`。而 `-?` 的完整语义是:
去掉 `?` **并且**把属性类型里的 `| undefined` 一并删除
(实测:`{ title?: string }` 经 `-?` 后,`title` 可以直接赋给 `string` 变量,零报错)。

### 6. MyPick 把 K 的约束写丢

```ts
// ❌ 没有约束:'foo' 也能传,K 不再保证是 T 的键
export type MyPick<T, K> = { [P in K]: T[P] }
//                                              ^^^^ T[P] 报 TS2536: Type 'P' cannot be used to index type 'T'
```

现象:没有 `K extends keyof T`,`T[P]` 直接报 TS2536。
`K extends keyof T` 不只是文档性的 —— 它是索引访问 `T[P]` 合法性的来源,
也是 MyPick 保持同态(从而保留修饰符)的前提。

### 7. applyEdit 手动逐字段拼(能过但错方向)

```ts
// ⚠️ 可以跑,但每加一个字段都要来这里改一遍,漏改就是静默丢字段
return { id: base.id, name: patch.name ?? base.name, ... }
```

✅ `{ ...base, ...patch }` 一行:patch 里有的键赢,没有的透传 base,
description 用 `''` 表达"清空"。注意 patch 类型是 EditPatch(全可选),
所以"没给的键"在展开后**不存在**(不是 undefined)—— 和第 3 条是同一个知识点。

## 三、思考题参考答案

### Part 1 第 3 题:`-?` 在移除 `?` 的同时还会做什么?

- 严格模式下 `description?: string` 的读取类型是 `string | undefined`;
- `-?` 之后是纯 `string`(undefined 一并被剥掉,实测可赋给 `string` 变量);
- 当前 exactOptionalPropertyTypes 下，原声明若是 `description?: string | undefined`，`-?` 后仍保留显式 undefined；
- Required 的保证是属性必填，值是否允许 undefined 由原声明和配置决定，不能无条件概括为“必有非 undefined 值”。

### Part 2 第 6 题:直接映射 vs 组合 Pick 的实验结论

- 直接映射 `{ [P in Exclude<keyof T, K>]: T[P] }`:丢 `?`(TS2741 现形)、丢 readonly(写入不报 TS2540);
- 组合 Pick:与内置 Omit 完全对等;
- 根因:同态映射的识别条件是"键直接来自 keyof T(或其类型参数)",
  Exclude 算出的新联合破坏了这个识别;
- 这个坑值得记 NOTES:它告诉你**映射类型的修饰符传播是脆弱的**,
  中间任何"键的变换"都可能静默丢信息,对等断言(expectTypeOf vs 内置)是唯一保险。

### Part 3 第 8 题:toEditForm 怎么构造(坑的层次)

- 第一层:`{ ...meta }` 带出系统字段 —— 编译器不报(实测),靠 toEqual 抓;
- 第二层:`description: meta.description` 显式 undefined —— TS2375(eOPT);
- 姿势:显式列可编辑字段 + 条件展开;键不存在 = 干净的"没有值"。

## 四、验收自查清单

- [ ] 五个 My* 全部手写,与内置版本对等断言全绿(没用内置 Partial/Required/Readonly/Pick/Omit 凑数)
- [ ] 零 `any`、零 `as`
- [ ] 所有 `export` 有 JSDoc + `@example`
- [ ] `MyRequired` 的 JSDoc 回答了 `-?` 的副作用(连 `| undefined` 一起删)
- [ ] `MyOmit` 的 JSDoc 记下了"直接映射丢 ?、组合 Pick 才与内置对等"的实验结论
- [ ] `toEditForm` 不含 id / createdAt,description 为空时**键不存在**
- [ ] 测试里 @ts-expect-error 反例保持生效
- [ ] `pnpm check:day 07` 通过（类型检查 + 运行时测试）
