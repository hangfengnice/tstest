# Day 24 — type-challenges easy 精选:元组操作 + Awaited

## 重学导读

**前置知识**：Day 19–23；知道 readonly 元组与普通数组的区别。

**今天要学会**：从元组保留位置和长度信息，并区分类型解包与运行时行为。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 元组信息 | 元组记录每个位置，length 可是数字字面量；普通数组只记录元素类型，长度是 number。 |
| 只读输入 | 接受 readonly 元组不会妨碍读取、拼接成新数组；只读约束不等于运行时冻结。 |
| 空输入与解包 | First<[]> 为 never 是类型计算规则；运行时函数若接收空数组，需要另定抛错或 undefined 规则。本题 firstOf 只接非空元组。 |

### 动手顺序

先做 First/Length → 数字索引取联合 → 可变元组拼接 → 递归 Awaited → 对照函数验收运行时结果。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么普通数组无法给出固定长度？嵌套 Promise 类型与 async 返回值的实际展开有什么区别？
- **迁移**：用三项只读导航定义推导项目数和允许的导航名，说明去掉字面量信息后的变化。
- **验收**：在项目根目录运行 `pnpm check:day 24`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

> 本日五道题全部出自 [type-challenges](https://github.com/type-challenges/type-challenges) 的 easy 难度(题号见各题)。
> 做过原题也没关系:这次每题都绑定了一个 chipRunner 的真实业务场景,并且**必须配上运行时函数一起交付** —— 类型工具不是摆设,要让调用处的值和类型同时正确。

## 业务场景

chipRunner 里四个天天见的需求:

1. **表单字段顺序**:`FORM_FIELDS = ['title', 'content', 'tags'] as const` —— "第一个展示的字段是什么""一共几个字段"要从元组类型推导,而不是另写一份 `first = 'title'` / `count = 3`(两份数据迟早不同步)。
2. **权限系统**:`PERMISSIONS` 权限表是 `as const` 元组,`Permission` 类型必须从它推导 —— 后端加权限只需改一处,类型自动跟上。
3. **面包屑导航**:两段路径元组拼成一段,类型上必须精确到每个元素。
4. **请求层封装**:`$fetch` / `.then` 链的返回值可能是多层 `Promise`,要推导"最终拿到的值"的类型。

---

## Part 1 — 🟢 基础:元组的基本功

### 第 1 题 First<T>(type-challenges #14)

`First<T extends readonly unknown[]>`:取元组**第一个元素**的类型。空元组 `[]` 必须返回 `never`。
配套运行时：`firstOf` 仅接收非空元组，返回精确首项类型；不为运行时空数组虚假承诺 never 返回值。

### 第 2 题 Length<T>(type-challenges #18)

`Length<T extends readonly unknown[]>`:取元组的**长度字面量**(`Length<typeof FORM_FIELDS>` 是 `3`,不是 `number`)。
配套运行时:`lengthOf(tuple): Length<T>`。

提示:元组类型有一个属性签名可以利用,`T['length']` —— 想想为什么普通 `string[]` 上它就是 `number`。

## Part 2 — 🟡 进阶:元组与联合的转换

### 第 3 题 TupleToUnion<T>(type-challenges #10)

`TupleToUnion<T extends readonly unknown[]>`:元组 → 联合。本仓库用它定义 `Permission = TupleToUnion<typeof PERMISSIONS>`(已在 solution.ts 给出)。
验证边界:`TupleToUnion<string[]>` 应该是 `string`(非元组时退化为元素类型)。

### 第 4 题 Concat<A, B>(type-challenges #533)

`Concat<A extends readonly unknown[], B extends readonly unknown[]>`:拼接两个元组,产出**精确的新元组**(`readonly ['src']` + `readonly ['App.vue']` = `readonly ['src', 'App.vue']`)。
配套运行时:`concatTuples(a, b): Concat<A, B>`(实现时思考:展开运算符 `[...a, ...b]` 的推断类型和 `Concat<A, B>` 什么关系?需不需要 `as`?)。

## Part 3 — 🔴 边界:递归解包

### 第 5 题 Awaited<T>(type-challenges #189)

`Awaited<T>`:推导"await 之后拿到的值"的类型。TS 4.5 起内置了同名工具,今天我们**重新发明**它(在 solution.ts 里 export 的 `Awaited` 会遮蔽内置版)。

- `Awaited<Promise<number>>` = `number`
- `Awaited<Promise<Promise<Promise<number>>>>` = `number`（类型层构造的嵌套示例；运行时 Promise/await 会采纳内部 Promise 的最终结果）
- `Awaited<Promise<string> | number>` = `string | number`(条件类型对联合自动分发)
- `Awaited<null>` = `null`(非 Promise 原样透传)
- 进阶(选做):thenable —— 有 `.then` 方法的非 Promise 对象;type-challenges 原题要求处理,本仓库测试不强制

配套运行时:`unwrapAll<T>(input: T): Promise<Awaited<T>>`,把任意嵌套的 Promise 解到最终值。
提示:`async` 函数里 `return input` 时,TS 会不会自动帮你拍平一层?实验一下,想想为什么返回类型要写 `Promise<Awaited<T>>` 而不是 `Promise<T>`。

---

## 提示区(卡住 10 分钟以上再看)

- `First<T>` 有两条路:索引访问 `T[0]`(空元组时是什么?)+ 检查 `T` 是否是空元组;或者模式匹配 `T extends [infer F, ...unknown[]]`
- 元组类型的长度在类型系统里是一个**数字字面量**:`typeof FORM_FIELDS['length']` 悬停看看
- `TupleToUnion` 就一行:元组的"数字索引取出所有元素"用 `T[number]`
- `Concat` 用可变元组 `[...A, ...B]` 语法写在类型位置
- `Awaited` 的递归点在 `Promise<infer V>` 的 `V` 上:`T` 是 Promise 就对 `V` 再来一次,不是就返回 `T` 本身

## 验收清单

- [ ] `pnpm check:day 24` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] 普通练习代码不使用 `any`；Awaited 若采用标准库 thenable 模型，允许参考实现中两处推断用 any，须说明原因。简单 Promise 版可在 unwrapAll 使用一次有说明的断言；concatTuples 如需断言也须说明构造依据
- [ ] `First<[]>` 是 `never`;`Length<string[]>` 是 `number`;`TupleToUnion<string[]>` 是 `string`
- [ ] `Awaited` 通过全部四条类型断言 + `unwrapAll` 运行时解包嵌套 Promise
- [ ] 所有 export 有 JSDoc + `@example`;JSDoc 里回答:"为什么 `as const` 是这一切的前提?"(没有它会退化成什么)

## 写完后

贴 `src/day24/solution.ts` 过来,说:"点评 + 解释为什么"。

**建议节奏**:Part 1 20 分钟 → Part 2 30 分钟 → Part 3 30 分钟。卡超过 10 分钟来要提示,不要答案。

---

[上一题：Day 23](../day23/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 25](../day25/README.md)
