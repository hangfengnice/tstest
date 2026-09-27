# 教材准确性检查与勘误

初次检查：2026-09-22；重学修订：2026-09-27。以下记录本轮确认并修正的问题；Day 16 一项汇总此前已完成的修订。

## 范围与方法

- 核对各天题面、主要参考实现、相关解释和错误速查表，重点检查类型承诺与运行时行为是否一致。
- 在临时目录组合 Day 1–5 当前实现与 Day 6–30 主参考实现，运行全部类型检查和测试。参考答案省略的已给库代码从骨架补入；不覆盖学习者实现。
- 为容易混淆的语言规则增加最小编译／运行时探针，并对照 TypeScript、Zod 官方说明。
- 验证环境：TypeScript **5.9.3**、Vitest **2.1.9**、Zod **4.5.4**、Node **24.19.0**。package.json 的版本范围不等于实际安装版本；旧文档中的“TS 5.6 实测”属于历史记录。

本轮不是对所有代码块逐个自动验证：主参考实现已全部验证，错误示例、替代实现和练习提示按相关问题定向核对。Day 9 的重载替代实现另行替换进临时目录，执行同一套类型检查及该天的运行时测试。测试通过也不等于证明所有输入下都正确。

## 已修正的问题

| 编号 | 位置 | 原问题 | 修正与验证依据 |
|---|---|---|---|
| E01 | [Day 28 题面](../src/day28/README.md)、参考答案、速查表 | 认为展开未包含 tags 的对象会产生 `tags: undefined` | 展开保留已有自有可枚举属性，不创建缺失属性；显式 `tags: input.tags` 才会主动创建键。探针分别检查属性缺失与显式 undefined。 |
| E02 | [Day 27 题面](../src/day27/README.md) | 泛型 `get<T>` 被作为可信存储接口介绍，局限要到后一天或答案中才解释 | 明示这是讨论用初版契约；要求构造同键跨类型读取反例，并说明 Day 28 的字符串存储与校验分工。 |
| E03 | [Day 19 题面](../src/day19/README.md)、参考答案、[速查表](./TS-ERROR-CHEATSHEET.md) | 把必填元组首项类型说成 `string \| undefined`，认为所有索引访问都受 noUncheckedIndexedAccess 影响 | 必填元组位置与有限映射的必填键不自动增加 undefined；普通数组下标与类型级 `T[K]` 要区分。无参函数经泛型参数元组取首项得到 undefined，才是与本题模式匹配的 unknown 的差异。编译探针覆盖这些区别。 |
| E04 | 速查表：字面量推断 | 认为无约束 `<T>(value: T): T` 必然拓宽字符串字面量 | 直接返回 T 的调用可保留字面量；已拓宽的 let 实参仍是 string。用 `expectTypeOf<typeof literal>()` 读取变量类型，避免测试函数的泛型参数再次影响推断。 |
| E05 | [Day 6 题面](../src/day06/README.md)、答案、速查表 | 把 satisfies 描述成保证所有属性保留字面量；把泛型约束称为“下限” | satisfies 校验兼容性并保留表达式推断结果，上下文参与推断；同一对象的 level 可保持字面量，而 retries 仍为 number。约束要求实参类型可赋给约束类型。 |
| E06 | Day 6 答案 | 把 as const 描述成无条件 deep readonly；把 Record 当作泛型默认参数例子 | 说明 const 断言只作用于适用字面量结构，不会冻结运行时对象或递归改写外部引用类型；Record 的参数必填，移除错误类比。 |
| E07 | [Day 13](../src/day13/README.md)：ResolveProps 与默认值说明 | NonNullable 同时删除合法 null；声称 Partial 只允许部分字段、默认值不能覆盖全部字段 | 改为 Exclude<…, undefined>，新增 nullable 字段类型测试；Partial 允许零个、部分或全部字段，实际默认键需要由精确的 D 保存。同步修改题面、骨架提示和参考实现。 |
| E08 | [Day 14](../src/day14/README.md)、[Day 17](../src/day17/README.md) 的幽灵属性说明 | 声称与 Vue 原版完全一致、所有不同泛型 key 都不兼容、幽灵字段运行时必为 undefined | 明确这是教学模型，接口不生成运行时字段；本题创建值时不提供该字段。兼容性取决于载荷结构，而非泛型参数的名字；编译探针检查结构兼容性。另将 Day 14 的断言规则统一为事件存储一次、inject 取值一次，消除题面与答案冲突。 |
| E09 | Day 19 infer 说明、Day 24 参考答案 | 把 infer 的位置限制称为与泛型的“唯一区别”；三层 Promise 剥一层的结果少算一层；Awaited 的课程引用错误 | 明确 infer 由条件类型模式匹配推导，并用于成功分支；三层剥一层剩两层。递归 Awaited 引用改为 Day 24，探针验证剥层类型和 await 行为。 |
| E10 | [Day 25](../src/day25/README.md)：fetch 与 z.infer | 混淆 Response 与 JSON；认为 z.infer 必须用于 const、不能用于函数参数 | fetch 返回 Response；json() 类型取决于声明环境，浏览器 lib.dom 是 Promise<any>，本地 undici-types 是 Promise<unknown>。建议边界显式接 unknown。z.infer 读取静态 schema 类型，let 和保留具体类型的函数参数同样可用；编译探针验证。 |
| E11 | Day 25：safeParseApi | 使用 safeParse 却声称任何输入都不抛错；忽略用户 transform/refinement 的异常；称 try/catch 无法提供结构化结果 | 参考实现添加外层 try/catch，把意外异常转成指定失败结果；新增两个回归用例。正常 issues 仍逐字段格式化。说明 parse + 错误收窄也能实现结构化处理；同步接口不负责调用前的异常或异步解析。 |
| E12 | [Day 26](../src/day26/README.md)：Store 题面与答案 | 题面禁止 as、答案用一次；骨架擦除了 action 首参 state；把 getter 描述成对外的无参函数 | 统一允许最终返回处一次有依据的断言，骨架保留 state 参数；getter 以属性访问器暴露结果。移除“所有实现都不可能零断言”的未经证明结论。修改后的参考实现通过类型和运行时验收。 |
| E13 | 速查表：收窄与断言 | “宽 string 永远不能收窄”“异构存储在类型系统中无解”等过度概括 | 改为检查具体分支重叠和关联是否保留；区分当前实现的证明困难与语言层面的绝对不可能。 |
| E14 | [Day 16](../src/day16/README.md)，此前已修正 | 默认值 T 被错误地当作返回值 T 的保证；旧值被当成一定受输入类型约束 | getConfig 和 setConfig 旧值出口使用 unknown；守卫建立业务类型。19 项测试及类型检查通过，旧的返回 T 签名会被类型测试拒绝。 |
| E15 | [Day 9](../src/day09/ANSWER.md)：重载方案与对象类型 | 替代重载不接受联合类型变量；把泛型方案称为唯一解；将结构类型误解为精确对象类型 | 增加公开联合参数重载及回归测试，将替代实现纳入自动验收；说明变量可以携带额外属性，字面量的多余属性检查不是精确类型保证。 |
| E16 | [Day 23](../src/day23/ANSWER.md)、Day 26 深层映射说明 | 认为同态映射会破坏数组、readonly 映射不能处理数组；认为 Path 只能接受元组 | 改为说明同态 readonly 映射转换数组与元组，optional 映射对数组元素的影响；路径推导关键是具体节点字面量，联合元素数组也可用。新增类型探针。 |
| E17 | [Day 11](../src/day11/README.md)、Day 12、速查表 | 认为 interface 一律不能满足 Record；认为反向映射必须内联、抽成别名或 options 接口就无法推导 | 区分无索引签名与显式索引签名的接口；移除错误的内联要求及未经验证的版本归因。编译探针验证索引签名及抽取后的推导。 |
| E18 | [Day 22](../src/day22/ANSWER.md)、Day 27 | 认为模板匹配只能得到宽 boolean；认为字符串 enum 不能用于模板字面量 | 条件类型可以得到 true / false 字面量；字符串 enum 可通过模板字面量转换为字符串联合。新增类型探针。 |
| E19 | [Day 19](../src/day19/README.md)、[Day 21](../src/day21/README.md) | 把 JSON 序列化缓存键当成通用无冲突方案；把 Object.keys 包装描述为任意对象均完整覆盖 | 明示缓存键的碰撞和不可序列化输入；限定 toRefsOwn 为自有可枚举字符串键普通数据对象，并说明它是值包装快照。运行时探针覆盖 undefined / null 缓存键碰撞。 |
| E20 | Day 6、11、13、14、17、19、20、29、30 答案 | 多处“唯一方案”“一定”等绝对化结论或解释错误 | 修正 infer 与索引访问的分工、重载与条件参数的替代关系、幽灵字段存在性、忽略额外参数的函数兼容性、遗漏 undefined 分支的判断，以及纯函数、穷尽检查、never 和 any 的说明；不再由局部测试推导普遍保证。 |

## 复现命令与结果

```bash
pnpm check:textbook
```

入口是 [verify-textbook.mjs](../scripts/verify-textbook.mjs)，最小规则探针在
[textbook-probes.test.ts](../scripts/textbook-probes.test.ts)。此命令供教材维护使用；日常学习仍用 `pnpm check:day XX`。

脚本在临时目录替换参考实现、运行 TypeScript 和 Vitest，结束后清理临时目录。
它会校验参考代码块数量；答案结构变化时显式报错，不静默选错代码。

2026-09-22 验证记录：TypeScript 检查通过；31 个测试文件、588 项运行时测试全部通过，包含 14 项勘误探针。
Day 9 重载替代实现的全项目类型检查及该天 20 项运行时测试也通过。
另运行 `pnpm check:completed`，Day 1–5 类型检查与 85 项运行时测试通过；`git diff --check` 通过。

## 官方说明与本地证据

- [TypeScript：noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)：未显式声明的索引字段可能加入 undefined，不能泛化为所有访问。
- [TypeScript：条件类型](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)：条件类型的可赋值判断、infer 与分发规则。
- [TypeScript 4.9：satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)：校验兼容性并保留推断信息；具体例子以本仓库编译探针为准。
- [TypeScript 3.4：const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html)：const 断言的适用范围和可变引用边界。
- [Zod：refinements](https://zod.dev/api#refinements)：用户校验函数不应抛异常；抛出的异常不会被普通校验结果自动接管。本地 Zod 4.5.4 的探针及 Day 25 测试验证该行为。
- fetch 声明直接核对本地 TypeScript `lib.dom.d.ts` 与 `undici-types/fetch.d.ts`，不把某个环境的类型当作所有环境通用结论。

后续更改题目时，同时检查题面、骨架提示、参考答案和相关测试，并重跑此命令。新结论记录版本、最小反例与验证方式；不要仅因为答案与旧测试相互吻合就认定教材正确。


## 2026-09-27：从第一天重学的补充勘误

- **Day 21 Partial**：内置实现的值列是 T[P]。原题、骨架、参考实现与测试曾额外允许显式 undefined，和精确可选配置不符。统一修正，并新增直接赋值反例、与内置 Partial 双向赋值及原类型含 undefined 的正例。单纯比较属性读取结果不足以检查可选写入规则。
- **Day 7 / 21 Required**：移除可选标记不等于删除所有 undefined；当前配置下显式声明的 undefined 保留。增加最小编译探针。
- **Day 30 Q10**：保留原题 b: 2 与 b: 3 的冲突例子，答案修正为 keyof never。测试直接检查题面表达式，再检查 Q10，防止人工答案与测试共同写错。
- **Day 24 firstOf**：区分 First<[]> 的类型计算与运行时函数输入契约。运行时仅接受非空元组，新增空元组调用的编译反例；同时明确 Awaited 的 thenable 参考方案与简单方案各自允许的局部用法。
- **阅读一致性**：修正 Omit 对联合的解释、类型投影不删除运行时字段、数组下标与 every 回调的区别、JSON.parse 的 unknown 接收边界、Vue Props 教学模型范围和递归深度的过度概括。

依据：[精确可选属性](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)、[冲突判别属性导致交叉约化](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html)，以及当前安装的 lib.es5.d.ts 与本仓库编译探针。


### 本次验证结果（2026-09-27）

- `pnpm check:textbook`：全课程临时组合的类型检查通过，31 个测试文件、592 项运行时测试通过，其中勘误探针 16 项；Day 9 替代重载方案额外通过类型检查及 20 项测试。
- `pnpm check:completed`：Day 1–5 类型检查与 85 项运行时测试通过。
- 文档结构检查：41 份入口/学习文档、281 个本地链接、30 份每日导读检查通过；`git diff --check` 通过。
- 本次未把参考答案写入学习者实现，未把文档维护标记为重学完成；未完成练习仍保留占位。
