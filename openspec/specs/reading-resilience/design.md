# reading-resilience 技术设计

## 概览

恢复逻辑以存档状态为真相，不依赖原进程仍然存活。读取 reading 时，系统识别超过阈值仍处于 `writing` 的单家或总述，以及长时间无进展的自动起卦，并通过原子更新转成用户可恢复的状态。

## 模块与文件

- `src/sanyi/store.ts`
  - `WRITING_INTERRUPTION_TIMEOUT_MS = 330_000`：落笔中断阈值。
  - `CAST_PROGRESS_TIMEOUT_MS = 120_000`：起卦无进展阈值。
  - `WRITING_INTERRUPTION_ERROR`：公开失败说明。
  - `ReadingStore.readRecovering`：读取、识别目标并比较后写回恢复结果。
  - `recoveryTargets`、`recoverReading`：计算和应用恢复，但不导出为公共 API。
- `src/sanyi/reading-service.ts`：问事单家、总述和起卦的 `startedAt`/`castProgressAt` 写入与重试。
- `src/sanyi/bazi-reading-service.ts`：八字三家、总述、换日和重试时写入新的开始时刻。
- `src/sanyi/naming/service.ts`：起名三家、合参和重试的开始时刻。
- `src/sanyi/api.ts`：所有 reading 读取和操作通过服务层触发恢复读取。
- `src/sanyi/storage.ts`：`updateDocument` 用比较后写入保护跨实例并发恢复。

## 数据流

1. 三家、起名各家或总述进入 `writing` 时，把当前 ISO 时间写入 `startedAt`。
2. 问事创建、续掷或恢复时更新 `castProgressAt`；每一掷完成后再次更新。
3. 用户刷新或 API 操作调用 `readRecovering(id, now)`。
4. 存储层先读取快照并记录需恢复状态的键、开始时刻和当前掷数。
5. 超过 330 秒的 `writing` 状态改为 `failed`，移除 `startedAt` 和旧输出，错误为“落笔中断，请重试”。
6. 超过 120 秒无进展且未暂停的 `awaiting-throws` 改为 `castPaused: true`。
7. 更新前再次比较状态、开始时刻、掷数和进展时刻；若另一实例已推进，则不覆盖新状态。
8. 八字或起名没有活动写作状态后，整卦从 `writing` 调整为 `done`，从而开放现有免费重试按钮。

## 关键决策

- 恢复发生在读取路径，不要求额外定时任务或平台回调。
- 330 秒比 Vercel 300 秒函数上限多留 30 秒，避免仍在收尾写入的任务被过早判死。
- 中断不增加用户的 `retries`，因为它不是一次主动免费重试。
- 只有带 `startedAt` 的新状态参与落笔恢复；旧存档保持原行为。
- 恢复更新使用乐观并发比较，避免旧快照覆盖刚完成的结果。

## 约束与已知限制

- 恢复需要后续读取触发；没有访问的停滞 reading 不会主动变更。
- 起卦恢复只暂停并开放继续按钮，不会在读取请求中同步续掷。
- 旧存档没有 `startedAt` 时无法判断落笔是否过期，按兼容原则不自动失败。
- 状态恢复只处理平台中断，不替代 provider 自身的超时和自动重试逻辑。

## 测试

- `tests/sanyi-resilience.test.ts`：问事、八字、起名、总述和起卦的阈值、并发与重试次数。
- `tests/sanyi-store.test.ts`：存储读取、更新和付款声明。
- `tests/sanyi-auto-cast.test.ts`：暂停后的断点续掷。
- `tests/frontend-reading-experience.test.ts`：等待和失败状态的用户展示。
