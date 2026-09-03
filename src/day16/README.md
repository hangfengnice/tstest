# Day 16 — 给 JS 模块补 .d.ts(手写声明 / 模块扩充 / 全局声明)

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
3. `setConfig` 返回**旧值**(`ConfigValue | undefined`);`hasConfig` / `deleteConfig` 返回 boolean;
   `listKeys()` 返回 `string[]`。
4. `getConfig` 需要**函数重载**:
   - 不传 fallback → `unknown`(无类型 JS 的出口必须是 unknown,不是 any!)
   - 传 fallback `T` → `T`
   - 注意约束 `T extends ConfigValue` 会**保留字面量**:`getConfig('x', 'f')` 的类型是 `'f'`,
     不是 `string`(Day 6 的知识,测试里有断言)。想要拓宽的 string 就显式传泛型参数。

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

- [ ] `pnpm typecheck` 零错,`pnpm vitest run src/day16` 全过
- [ ] legacy-config.js 和 charts.d.ts **一个字没改**(git diff 可查)
- [ ] d.ts 里没有 any;无 fallback 的 getConfig 出口是 `unknown`
- [ ] 所有 export 有中文 JSDoc + `@example`(d.ts 里也要写)
- [ ] `setConfig('k', { a: 1 })` 编译报错(契约收窄生效,测试有反例)
- [ ] `RenderPieFn` 的形状和测试断言一致(readonly 数组参数!)
- [ ] NOTES.md 里记一条:约束泛型保留字面量 vs 默认推导拓宽,各自的触发条件

## 写完后

贴你改的 `legacy-config.d.ts` + `solution.ts`,说:"点评 + 解释为什么"。
建议节奏:Part 1 30 分钟(重载和字面量是难点)→ Part 2 20 分钟 → Part 3 30 分钟。
