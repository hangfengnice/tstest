# Day 3 复盘笔记

> 记录于 2026-09-06~07(由 Claude 起草全程记录)。「自评」节留给学习者本人填写。

## 今天我主动设计了什么

- **守卫选型全部一次写对**:`StreamEvent` 判别联合、`LegacyFrame` 无判别符用 `in`、
  `formatTimestamp` 的 `instanceof Date` 前置、`classifyError` 子类在前 ——
  **instanceof 的"子类先判"顺序一次写对**,这是当天最难的考点
- **`Number.isNaN` 内置守卫**:没有掉进 `value === NaN`(恒 false)的坑
- **`classifyError` 二版自主修正**:补上五成员字面量联合的返回注解
  —— 顺带踩通"返回注解提供上下文类型,字面量保鲜"机制
- `tool_result` 括号最终自己修掉;测试文件顺手做了 prettier 格式化
- 死代码两轮清理干净(尾部 throw、冗余 else if)

## 哪里依赖了 AI

- **文案精读(连续第三天的模式化失分)**:Day 2 idle → Day 3 '调用'后的空格 →
  '成功'两侧的括号。三次全是"模板字符串与规格的字符级差异",类型系统管不了文案,
  只有逐字符对照测试断言能防
- **classifyError 没读测试就猜**:成员名猜成 'error'(规格 'generic')、
  返回类型写了宽 `string`(拓宽)。开工指引明确说了"先读测试 157-176 行"——
  **反推类题目,测试就是图纸,跳过图纸等于闭卷考试**
- **拓宽机制专题**:Claude 讲解三层结构(let/const 差异、函数返回默认拓宽、
  上下文类型保鲜),并与 Day 2 的 `fallback: T` 收 `0` 拓成 `number` 统一成同一规则
- 两处指派给 Claude 代改(先 commit 快照再 diff 学习):函数归入'对象'分支、
  done 三元 → 查表

## 踩的坑(带错误码,周末复盘用)

| 错误码/现象 | 现象 | 根因 |
|---|---|---|
| ts(2344) | `return 'syntax'` 推断拓宽,`expectTypeOf` 判 string ≠ 字面量联合 | 无上下文类型时函数返回值拓宽;修法 = 显式注解返回联合(一次给全函数上下文,且能当场抓拼写错误) |
| 文案 diff ×3 | `'调用formatter'` / `'formatter (成功)'` ≠ 规格 | 模板字符串的空格、括号是规格的一部分;**写模板前把测试断言原文贴在旁边逐字符对照** |
| 成员名猜错 | 'error' vs 'generic' | 没读测试;反推题的答案全在 expectTypeOf/toBe 里 |
| (概念坑) | `typeof null === 'object'` | JS 历史 bug;null 必须先判,否则掉对象分支(同理 NaN 要在 number 分支内用 Number.isNaN 分流) |
| (概念坑) | `new SyntaxError() instanceof Error === true` | instanceof 查整条原型链;子类在前父类在后是固定次序 |

## 关键演进

**describePrimitive 的 null 判断**:

```ts
// V1(绕路 + 宽松相等):
typeof value === 'object' && value == undefined
// V2(直球):
value === null
```

想清楚"typeof 为 object 且宽松等于 undefined 的值只有 null",就直接写出唯一正解。
**绕路条件往往是没想透的信号。**

**done 分支**(Claude 代改,diff 学习):三层三元 → 模块顶层 `as const` 查表,
和 Day 1 精修版 `typeToIcon` 同构 —— 同一技能三天内第二次出现,该长在手上了。

## 自评(必填 —— 周末复盘的真实锚点,Claude 不代写)

> 按新规则,这一节由我自己填:

- [ ] 今天哪里最没底:
今天对泽 test.ts 部分 感觉问题不大
- [ ] 哪里靠 AI 提示才过(上面没写全的):
没 就是部分 细节 ai 更强  现实中可能出现问题了 才能出现
- [ ] 明天 Day 4(自定义守卫 is 谓词)想重点验证的旧知识点:

你可以根据我当前的表现进行 估算 我自己觉得还行

## 一句话带走

> unknown 的世界里守卫是唯一的门:typeof 管原始值、in 管形状、
> instanceof 管原型链 —— 而 null 和 NaN 是两扇假门,进门先验它们。
