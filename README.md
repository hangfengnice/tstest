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

每题:`solution.ts`(我写) + `solution.test.ts`(验收) + `README.md`(题面) + `NOTES.md`(复盘)

进度总览见 [PROGRESS.md](./PROGRESS.md)。

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