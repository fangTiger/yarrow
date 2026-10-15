# plain-summary 技术设计

## 概览

白话总述在各家达到终态后生成，把已完成家数的断语压缩成普通用户可读的结论、异同、解释和解法。命理同一次调用生成性格画像；运势补十年走势；所有内容复用对应盘面的事实核对器。

## 模块与文件

- `src/sanyi/summary.ts`
  - `PlainSummary`、`Remedy`、`Portrait`、`SummaryInput` 定义统一结构。
  - `buildSummaryPrompt` 汇总问题、合议、盘面要点、三家断语和系统心法依据。
  - `checkSummary` 检查倾向、类型字段、中文、禁用内容与盘面事实。
  - `runSummary`、`runSummaryWithRetry` 管理结构化生成、重写和 provider 失败重试。
  - `repairSummary` 删除越界句并为必要字段提供保守兜底。
- `src/sanyi/reading-service.ts`：问事三家后生成总述，并在改事项或单家重试后重写。
- `src/sanyi/bazi-reading-service.ts`：为命理和运势组装逐运、逐年与取用依据。
- `src/sanyi/store.ts`：`SummaryState` 保存状态、依据家数、输出、重试次数和系统锚点。
- `src/agent/daxiang-corpus.ts`：提供问事解法使用的《大象传》原文。
- `web/components/PlainSummaryPanel.tsx`、`RemedyPanel.tsx`、`DestinyPortrait.tsx`：展示总述、解法和画像。

## 数据流

1. 编排服务收集状态为 `done` 的各家输出；失败家不阻塞总述。
2. 问事以已完成家把握平均值为合议；运势附逐年合议；命理附逐运合议。
3. 服务端组装 `SummaryAnchor`：问事为本卦《大象传》，八字为三家取用和调候依据。
4. `runSummary` 请求符合 `SUMMARY_SCHEMA` 的 JSON，最多三次处理结构或业务错误。
5. `checkSummary` 要求问事/运势倾向与合议一致，命理不写总吉凶且必须包含画像。
6. 正文逐段调用问事或八字核对器，并禁止法器、符咒、供奉和颜色方位趋避等内容。
7. 三次仍不合格时执行 `repairSummary`；provider 整体失败则外层自动再试一次。
8. 输出和 anchor 一起写入 reading；状态完成后结果页展示分享入口，失败时提供免费重试。

## 关键决策

- 总述只综合已落笔家，不等待失败家恢复；页面明确显示“依据 N 家断语”。
- 心法原文由程序提供，模型只写白话原则，核对时先剔除原文避免误判。
- 解法要求“做什么 + 依据 + 可选时机”，不再另设泛化建议字段。
- 合议六成及以上为“顺”、四成及以下为“不顺”，中间为“中”。
- 命理画像与总述同次生成，防止第二次调用引入新的盘面结论。

## 约束与已知限制

- 三家均未落笔时无法生成总述，状态记为失败。
- 最终修补可能删除画像；结构不足时前端不显示该块。
- 旧存档可能只有 `advice` 而没有 `remedy`，前端保留兼容展示。
- 手动总述重试最多两次，重试不收费。

## 测试

- `tests/sanyi-summary.test.ts`：Schema、提示词、倾向、边界和修补。
- `tests/sanyi-summary-service.test.ts`：问事总述编排、依据家数与重写。
- `tests/sanyi-bazi-reading-service.test.ts`、`tests/sanyi-bazi-periods.test.ts`：八字总述、画像和逐运。
- `tests/frontend-plain-summary.test.ts`：状态、重试和结果页顺序。
- `tests/frontend-destiny.test.ts`：画像、一生运势、总述与解法布局。
