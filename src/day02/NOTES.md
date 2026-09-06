# Day 2 复盘笔记

> 记录于 2026-09-05(9/6 按新规则由 Claude 起草全程记录)。「自评」节留给学习者本人填写。
> 周末复盘时以此为准,可随时补充修正。

## 今天我主动设计了什么

- **Part 1 全部独立完成**:`Conversation` / `Pagination` / `Paged<T>` 一次写对,
  `Paged` 的泛型化(包括"为什么要参数化"的思考)没有借助提示
- **`Result<T, E>` 一次写对**:标准两态判别联合,`ok: true/false` 各自携带字段
- **`RequestState` 四态联合**(第二版):经点评后自主修正,拆成四个完整对象分支
- **`mapResult` / `unwrapOr` 实现**:在"填空骨架"提示下自主完成,签名、泛型声明、
  `if (result.ok)` 收窄、失败分支原样透传(toBe 引用断言)全部自己落实
- **`renderState` 的 `never` 穷尽检查**:default 分支 + `_exhaustiveCheck: never`
- **测试 146 行的显式类型参数修复**:`mapResult<number, ApiError, string>(...)` 自己动手改,
  并保留了原调用注释作对照

## 哪里依赖了 AI

- **实验 2(泛型上 Extract 不收窄)**:从"题面读不懂"开始,经两轮翻译 + 完整走读才理解;
  结论注释由 Claude 代写。收获在"函数体内 K 对所有调用负责 / 只有调用点 K 落定才收窄"这个模型
- **「拍平 vs 联合」的判断**:第一版 `RequestState` 写成了"一个对象 + data?/error? 可选字段"——
  同一文件里 `Result` 用了判别联合、`RequestState` 却拍平,说明**会写联合,但没意识到该用**。
  经证据链点评(测试判死 / ?. 兜底 / 非法状态 / ts2578)后第二版修正
- **联合推断首分支效应(E=unknown)**:四轮探针实验(纯透传 → 泛型顺序 → 回调注解 →
  interface 分支 → 交换分支顺序)由 Claude 主导设计,学习者围观了完整方法论:
  **假设 → 变体实验 → 逐一排除 → 交换变量实锤**。这个"用探针逼 tsc 交代推断结果"的手法
  (`const probe: 'X' = value`)值得内化
- **error 文案硬编码**:`return \`出错了(500):服务器开小差了\``(无插值)骗过了测试,
  自己没发现,终评被抓后自主修复,并补了 404 对照断言
- **专业 JSDoc**:由 Claude 代写,六条心法(存在理由不复读字段 / 记录"为什么" /
  真实业务值 example / @typeParam / 坑固化 / export 无例外)——待内化

## 踩的坑(带错误码,周末复盘用)

| 错误码 | 现象 | 根因 |
|---|---|---|
| ts(2322) | return 完整 EmailNotification 对象,报不能赋给 `Extract<Email...> \| Extract<Sms...> \| Extract<Push...>` | 泛型 K 未落定,`T extends U ? T : never` 无法判定 → 条件类型**挂起**;函数体内必须对所有 K 成立 |
| ts(2578) ×2 | Unused '@ts-expect-error'(idle.data / loading.error 断言) | `RequestState` 拍平成可选字段,分支本不该有的字段仍可访问——**建模弱让断言落空**(与 Day 1 同码不同因:那次是 `as never` 擦报错) |
| ts(2304) | Cannot find name 'T' | 函数体用了 T/E,但没在**函数名后**声明 `<T, E>`(类型别名的参数声明在别名后,函数的在函数名后) |
| ts(2344) | `Result<string, unknown>` ≠ `Result<string, ApiError>` | **联合推断首分支效应**:TS 5.6 从联合实参推断泛型,只认联合第一个分支的类型参数(T 在 data 分支所以能推),E 落回 unknown;修复 = 显式类型参数 |
| 无码 | 测试全绿,但 error 文案硬编码 | **测试是规格的采样,通过 ≠ 实现正确**;修复 = 插值 + 补 404 对照断言防复发 |

## 关键演进(三版对比,今天最值钱的部分)

**RequestState 建模**:

```ts
// V1(拍平):一个对象,可选字段凑合       → V2(联合):四个完整分支
{ status: 'idle'|'loading'|'success'|'error',    { status: 'idle' }
  data?: T, error?: ApiError }                    | { status: 'success'; data: T }
                                                  | { status: 'error'; error: ApiError }
```

连锁反应:`renderState` 里 `state.data?.pagination.total ?? 0` 这类**运行时补偿全部消失**,
`case 'success'` 内 `state.data` 类型必为 T——**类型建模强了,运行时就不兜底;`?.` 和 `??`
是建模欠账的利息**。非法状态(`{ status: 'success', error: ... }`)也从"能编译"变成"无法表示"。

**测试 148 悬案的侦查过程**(方法论样本):现象 `E=unknown` → 纯透传复现(排除签名)→
泛型顺序无关 → 回调注解无关 → 别名/展开/interface 无关 → **交换分支顺序后 E 能推、T 不能**
→ 实锤:推断只认联合第一分支。修复:测试 146 行显式类型参数(唯一不降规格的通道)。

## 自评(必填 —— 周末复盘的真实锚点,Claude 不代写)

> 按新规则,这一节由我自己填:

- [ ] 今天哪里最没底: 

RequestState 没想到 “四态可辨识联合
mapResult 一开始一点思路没有

- [ ] 哪里靠 AI 提示才过(上面没写全的):
RequestState 
mapResult

- [ ] 明天 Day 3(类型守卫)想重点验证的旧知识点:

RequestState 
mapResult  类似这种的题

## 一句话带走

> 判别联合拆得越细,运行时兜底越少——看到自己写 `?.` 和 `??`,先怀疑类型建模;
> 测试全绿只说明采到的点对了,不说明实现对了。
