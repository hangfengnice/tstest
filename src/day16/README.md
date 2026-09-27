# Day 16 — 给 JS 模块补 .d.ts(手写声明 / 模块扩充 / 全局声明)

## 重学导读

**前置知识**：Day 4 unknown 守卫；理解 TS 类型不会自动修改 JS。

**今天要学会**：让声明忠实描述现有 JS 能保证的行为，把未知输出交给守卫。

### 先理解三个概念

| 概念 | 怎么理解 |
|---|---|
| 声明文件 | d.ts 提供类型契约，不生成实现；把输出写成某类型并不代表 JS 运行时会检查它。 |
| 输入与输出 | 可以限制新调用写入的值，但不能据此假设历史数据也符合限制。fallback 仅处理缺失，不能证明已存在值的类型。 |
| 扩充与导入 | 模块扩充补充已有模块声明；全局声明描述全局名字。仅有声明、没有真实模块时，类型导入不会触发运行时加载。 |

### 动手顺序

先读 legacy-config.js → 填输入输出契约 → 用守卫实现业务读取 → 再扩充图表模块与全局声明。

先读 [验收测试](./solution.test.ts)，再编辑 [练习实现](./solution.ts)。已有实现时先按[重学方法](../../docs/LEARNING-ORDER.md)保存历史，再独立重写；不要用旧代码的通过结果代替本轮练习。

### 学完自测

- **解释**：为什么 getConfig 传了字符串默认值仍不能保证得到字符串？d.ts 声明一个不存在的方法会让它出现吗？
- **迁移**：找一个旧 JS 工具，分别列出可以收窄的输入与必须保持 unknown 的输出。
- **验收**：在项目根目录运行 `pnpm check:day 16`，同时看类型检查与运行时测试。
- **记录**：按[每日自评模板](../../docs/DAILY-REVIEW-TEMPLATE.md)记录本次结果；参考答案在整题通过后再看。

下面保留完整题目与验收要求。一天可拆成多次学习，导读中的先后顺序不减少整题要求。

---

## 业务场景

chipRunner 引入了两个历史包袱:

1. **legacy-config.js**(2017 年的配置模块,纯 JS,一个字不许改)—— 运行时是好的,
   但每个导出对 TS 来说都是黑盒,谁都不敢碰。
2. **legacy-charts**(通过 `<script>` 标签加载的老图表库)—— vendor 只留了一份
   **不完整的** ambient 声明(见 `charts.d.ts`):有 `renderBar`,没有 `renderPie`,
   而 `renderPie` 在运行时明明存在。
3. 老页面还把一份配置挂在**全局变量** `__LEGACY_CONFIG__` 上,没有任何类型。

今天练的是给这三种"无类型历史资产"补类型的标准姿势。

### 为什么不用 allowJs + checkJs?

见 `legacy-config.js` 顶部的注释。核心:checkJs 靠 JSDoc 猜,动态 JS 推出来多半是 any;
而手写 .d.ts 是**契约** —— 你可以声明一个**比真实实现更窄**的合法输入集,
把狂野 API 驯服成类型安全 API(本仓库 tsconfig 也没开 allowJs)。

### 本目录的文件分工

| 文件 | 角色 |
|---|---|
| `legacy-config.js` | 真 JS,不许改,运行时真跑 |
| `legacy-config.d.ts` | **主战场**:把 never 占位换成精确类型 |
| `charts.d.ts` | vendor 的不完整 ambient 声明(只读,别改) |
| `solution.ts` | 守卫 wrapper + 两处声明扩充 |

---

## Part 1 — 🟢 基础:把 legacy-config.d.ts 写精确

1. `CONFIG_VERSION` 精确到**字面量** `'3.2.1'`(const 声明配字面量类型,读 js 源码就知道值)。
2. `ConfigValue = string | number | boolean` 作为值的合法契约 —— 运行时其实什么都收,
   契约上"我们不接受对象"。(这就是"声明比实现更窄")
3. `setConfig` 返回**旧值**(`unknown`，可能来自未受类型约束的 JS 调用);`hasConfig` / `deleteConfig` 返回 boolean;
   `listKeys()` 返回 `string[]`。
4. `getConfig` 的 fallback 是可选的 `ConfigValue`，返回值始终是 `unknown`。
   - fallback 只在存储值为 `undefined` 时生效，不会校验或转换已有值。
   - 例如先存入数字，再传字符串默认值，返回的仍然是数字。
   - 输入约束不能证明历史数据的类型；这里无需泛型或重载，精确的业务返回值由 Part 2 的守卫保证。

## Part 2 — 🟡 进阶:守卫 wrapper(Day 4 复习)

5. `ThemeMode` / `FeatureFlags` / `isThemeMode`(`is` 谓词签名已给)。
6. `readThemeMode()`:读 `theme` 键 —— 未配置返回 `'auto'`,**非法值抛错**(坏配置要大声失败,别静默吞)。
7. `readFeatureFlags()`:读 `flags.compact` / `flags.beta` 两个键,任何一个不是布尔就抛错。

## Part 3 — 🔴 边界:模块扩充 + 全局声明

8. 在 solution.ts 里用 `declare module 'legacy-charts' { ... }` **扩充** vendor 的 ambient 声明,
   补上 `renderPie(el: string, points: readonly ChartPoint[]): number`,
   然后 `RenderPieFn = typeof renderPie`(需要 `import type { renderPie } from 'legacy-charts'`)。
   体会两件事:
   - 扩充块里的 `ChartPoint` 直接指向被扩充模块自己的导出,不需要 import
   - 'legacy-charts' 没有真实模块文件,只能 `import type`(值位置 import 会在运行时炸)
9. `declare global` 给 `__LEGACY_CONFIG__` 补类型:`LegacyGlobalInfo = { host: string; timeoutMs: number }`。
   把骨架里的 `var __LEGACY_CONFIG__: never` 换掉,测试会读写它。

---

## 验收点

- [ ] `pnpm check:day 16` 通过（类型检查 + 运行时测试；未完成的占位代码报错是预期现象）
- [ ] legacy-config.js 和 charts.d.ts **一个字没改**(git diff 可查)
- [ ] d.ts 里没有 any；getConfig 无论是否传 fallback 都返回 `unknown`，setConfig 的旧值也返回 `unknown`
- [ ] 所有 export 有中文 JSDoc + `@example`(d.ts 里也要写)
- [ ] `setConfig('k', { a: 1 })` 编译报错(契约收窄生效,测试有反例)
- [ ] `RenderPieFn` 的形状和测试断言一致(readonly 数组参数!)
- [ ] NOTES.md 里解释：为什么默认值不能证明已有配置的类型？如何通过守卫得到可信的业务类型？

## 写完后

贴你改的 `legacy-config.d.ts` + `solution.ts`,说:"点评 + 解释为什么"。
建议节奏:Part 1 30 分钟(区分输入契约与输出保证)→ Part 2 20 分钟 → Part 3 30 分钟。

---

[上一题：Day 15](../day15/README.md) · [学习目录](../../docs/LEARNING-ORDER.md) · [下一题：Day 17](../day17/README.md)
