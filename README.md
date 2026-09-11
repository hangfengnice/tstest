# tstest — 30 天 TypeScript 高强度练习

个人练习仓库,目标是补齐 TS / 类型工程化短板,服务主项目 [chipRunner](../chipRunner)(Nuxt4 AI 流式对话)。

## 严格模式配置

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitAny": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "useUnknownInCatchVariables": true
}
```

## 目录结构

```
src/
  day01/   — 联合 / 交叉 / 字面量 / type vs interface
  day02/   — ...
  ...
  day30/   — 综合项目
```

每题:`solution.ts`(我写) + `solution.test.ts`(验收) + `README.md`(题面) + `NOTES.md`(复盘) + `ANSWER.md`(参考答案 + 点评要点,写完测试全绿后才能打开)

进度总览见 [PROGRESS.md](./PROGRESS.md)。

## 离线期间资产(2026-09-11 订阅断档前备好)

断档期工作流:`自己写 → pnpm test/typecheck 全绿 → 冷却 30 分钟 → 对照该 day 的 ANSWER.md`。

- [docs/TS-ERROR-CHEATSHEET.md](./docs/TS-ERROR-CHEATSHEET.md) — 报错自查速查表(按错误码 / 按主题 / 排错方法论),卡住先查这里
- [docs/WEEKLY-REVIEW-PLAYBOOK.md](./docs/WEEKLY-REVIEW-PLAYBOOK.md) — 周复盘 DIY 手册(git 轨迹 + 自评节 + 5 分钟重做法)
- 各 day 的 `ANSWER.md` — 点评人纸质版:参考实现 / 常见错误写法 / 思考题答案 / 自查清单

## 命令

```bash
pnpm install          # 安装依赖
pnpm test             # 跑全部测试 + 类型检查
pnpm test:watch       # 监听模式
pnpm typecheck        # 仅类型检查
```

## 学习约定

详见 [CLAUDE.md](./CLAUDE.md)。

- 永远先自己写,禁止直接抄答案
- 禁止 any 逃避;必须 `unknown` + 类型守卫
- 每周日复盘一次