# Day 18 — 第二阶段综合:通知中心完整类型库 + 阶段复盘

## 业务场景

第二阶段(Day 9-17)的考点散落在六天里,今天把它们**串成一个库**:
一个通知中心,从"运营在后台填表创建通知"到"通知发出、事件广播、Store 聚合"的完整链路。

```
表单(Day 9)──► 状态机(Day 10)──► API 提交(Day 17)
                    │                    │
                    ▼                    ▼
            事件广播(Day 11/14)   Store 聚合(Day 12/15)
                                        │
                                        ▼
                            provide/inject 注入组件树(Day 14)
```

solution.ts 里**库代码已经搭好**(createSignal / Emitter / InjectionKey / 信封 / Result,
全部带 JSDoc,不用你实现)—— 这是复盘的意义:把它们当**已掌握的工具**组装,
你要写的是六个任务里的业务类型与逻辑。

---

## 任务 1 — 🟢 状态机(Day 10)

通知生命周期:`draft → review → scheduled → sent / failed`,失败可回 `draft`。

1. `NotificationStatus` 五值字面量联合;`NotificationRecord`(id / title / status / isRead)。
2. `TransitionTable`:合法转移表,**每个 key 的值是各自的具体字面量元组**,例如:
   `draft: readonly ['review', 'scheduled']`;`sent: readonly []`(draft→review|scheduled;
   review→scheduled|draft;scheduled→sent|failed;sent→无;failed→draft)。
   **坑**:写成 `Record<NotificationStatus, readonly NotificationStatus[]>` 语法上没错,
   但它把每个 key 的值类型统一抹平成宽联合,`LegalNext` 就推不出精确结果了 ——
   字面量信息必须留在类型里,这是任务 4 的前提。运行时查表时再 widen(先把表项赋给
   `readonly NotificationStatus[]` 类型的变量)就不会被 `includes` 的参数类型卡住。
3. `canTransition(from, to)` / `nextStates(from)`(签名已给,补运行时)。
4. `LegalNext<S>` —— 从转移表**类型级推导**某状态的合法下一步:
   `LegalNext<'draft'>` = `'review' | 'scheduled'`;`LegalNext<'sent'>` = `never`。
   提示:`TransitionTable[S][number]`(索引访问 + mapped)。
5. `advance(from, to)`(签名已给)—— 类型层用 `LegalNext<S>` 拦住非法转移,
   运行时再查一次表(防御),查不过就抛错。

## 任务 2 — 🟢 表单 + Props(Day 9 / 13)

6. `Channel` 三值联合;`CreateNotificationInput` **判别联合**,按 channel 条件必填:
   email 要 `subject` / `to`;sms 要 `phone`;push 要 `deviceId` / `title`(三者都有 `body`)。
7. `describeInput(input)`:switch + `never` 穷尽检查(签名已给)。
8. `NotificationItemProps`:组件 Props 模拟 —— `{ record: NotificationRecord; compact?: boolean; onToggleRead: (id: string) => void }`。
9. `FormState<T>`:`{ values: T; touched: Partial<Record<keyof T, boolean>>; errors: Partial<Record<keyof T, string>> }`
   —— 注意 exactOptionalPropertyTypes:touched/errors 的值不允许显式 undefined。
10. `makeInitialForm(values)`(签名已给)。

## 任务 3 — 🟡 事件映射(Day 11 / 14)

11. `NotificationCenterEvents`:事件名 → 参数元组:
    - `notify:sent` → `[id: string, channel: Channel]`
    - `notify:failed` → `[id: string, reason: string]`
    - `draft:saved` → `[]`(零参数事件)
12. `NotificationCenterEmitter` = `Emitter<NotificationCenterEvents>`(Emitter 已给)。

## 任务 4 — 🟡 Store(Day 12 / 15)

13. `NotificationStore`:`{ state: Signal<{ records: NotificationRecord[] }>; add(input): NotificationRecord; markRead(id): boolean; unreadCount(): number }`。
    **每个方法的返回类型显式标注**(Day 15 的规矩)。
14. `createNotificationStore(initial)`(签名已给,补运行时):add 生成 `status: 'draft'`、
    `isRead: false` 的新记录;markRead 找不到返回 false;unreadCount 数未读。

## 任务 5 — 🟡 provide/inject(Day 14)

15. `STORE_KEY`:照 Day 14 的 InjectionKey 模式声明,携带 `NotificationStore`。
16. `provideStore(store)` / `useStore()`(签名已给)—— 基于 contextStack 脚手架实现。

## 任务 6 — 🔴 API 提交(Day 17,占位签名是错的,从测试反推)

17. `publishNotification(record, transport)`:
    - 行为:POST `/notifications`;信封用 `'data' in` 收窄;成功返回 `{ ok: true, data }`,
      失败返回 `{ ok: false, error: { code, message } }`(message 缺省 `'未知错误'`)
    - **占位签名是错的**,从测试反推:参数类型、返回类型全部自己定
    - 复用已给的 `ApiEnvelope` / `Result`,不要重新定义

---

## 阶段复盘自查(Day 9-17)

写完后在下表打勾,拿不准的写进 NOTES.md,周末复盘时对着看:

| 考点 | 今天出现在 | 自评(闭眼能写 / 要看提示 / 不会) |
|---|---|---|
| 条件字段 / 判别联合(Day 1/9) | 任务 2 | |
| 状态机 + 合法转移(Day 10) | 任务 1 | |
| 类型级推导 LegalNext(Day 10/12) | 任务 1 | |
| 事件名 → 参数元组(Day 11/14) | 任务 3 | |
| Store + 显式返回标注(Day 12/15) | 任务 4 | |
| InjectionKey 模式(Day 14) | 任务 5 | |
| 信封收窄 + Result(Day 17) | 任务 6 | |
| exactOptionalPropertyTypes 的坑(Day 15) | 任务 2/9 | |

## 验收点

- [ ] `pnpm typecheck` 零错,`pnpm vitest run src/day18` 全过
- [ ] `advance('sent', 'draft')` 编译报错(LegalNext<'sent'> 是 never)
- [ ] `NotificationItemProps` 的回调参数类型错误会编译报错(测试有反例)
- [ ] Store 三个方法的返回类型显式标注
- [ ] publishNotification 的签名是你自己反推出来的,零 as
- [ ] 所有 export 有中文 JSDoc + `@example`
- [ ] 阶段复盘自查表填完

## 写完后

这是第二阶段收官:贴 `solution.ts` + 填好的自查表,说:"点评 + 按自查表给下周建议"。
建议节奏:任务 1+2 45 分钟 → 任务 3+4+5 40 分钟 → 任务 6 25 分钟。
