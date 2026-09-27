# TypeScript：从 Day 1 重新学习

面向有 JavaScript / Vue 业务经验的开发者，用 30 个主题练习数据建模、泛型、运行时校验和类型工程。

**现在开始：[学习顺序与重学方法](./docs/LEARNING-ORDER.md) → [Day 1：通知类型设计](./src/day01/README.md)。**

## 每天怎么学

读重学导读 → 读题面与测试 → 自己实现 → 运行当天验收 → 解释设计 → 隔天换场景重做。
一题可以分多次完成。Day 1–5 的旧实现、历史自评和验收记录保留；本次学习另记在[重学记录](./docs/RELEARNING-PROGRESS.md)。

## 文件怎么用

| 文件 | 用途 | 什么时候看 |
|---|---|---|
| `src/dayXX/README.md` | 前置知识、概念、题面与自测 | 开始当天学习时 |
| `solution.test.ts` | 合法/非法输入、类型与运行时验收 | 动手之前 |
| `solution.ts` | 已有实现或待填写骨架 | 自己编写时 |
| `NOTES.md` | 历史复盘、本次解释与提示记录 | 学后追加；不存在时按模板新建 |
| `ANSWER.md` | 参考实现、常见错误与解释 | Day 6–30 提供；整题通过后再看 |

Day 1–5 已有实现，没有单独 ANSWER；重写前先保存旧代码，方法见学习顺序文档。Day 16 还需要编辑声明文件，按当日题面操作。

## 常用命令（项目根目录）

```bash
pnpm install
pnpm check:day 01     # 当天：类型检查 + 运行时测试，支持 1–30
pnpm check:completed  # 依据 PROGRESS.md 回归历史已验收题
pnpm check:textbook   # 教材维护：在临时目录验证参考实现与勘误探针
pnpm test             # 全课程测试，未实现题目会失败
pnpm typecheck        # 全课程类型检查，未实现题目会失败
pnpm test:watch       # 全课程监听测试
```

按天检查继承根目录严格配置；当天导入的依赖也参与检查。只看到 Vitest 运行时全绿不够，必须同时确认类型检查通过。参考答案的教材验证通过不等于学习者练习已完成。

## 严格模式先记住三件事

- 普通数组下标可能越界，读取结果要处理 `undefined`。
- 可选属性允许省略，不自动允许显式赋 `undefined`；看属性本身的值类型。
- catch 到的异常是 `unknown`，使用前先检查。完整配置见 [tsconfig.json](./tsconfig.json)。

## 复习与维护入口

- [每日自评模板](./docs/DAILY-REVIEW-TEMPLATE.md) · [周复盘手册](./docs/WEEKLY-REVIEW-PLAYBOOK.md)
- [报错自查](./docs/TS-ERROR-CHEATSHEET.md) · [业务迁移练习](./docs/BUSINESS-PRACTICE.md)
- [历史验收记录](./PROGRESS.md) · [教材勘误](./docs/TEXTBOOK-ERRATA.md)
- [学习协作约定](./CLAUDE.md) · [原 README 附记](./docs/LEGACY-NOTES.md)

先独立尝试，卡住时要提示，写完再请求点评；自评和一句话收获由本人填写。
